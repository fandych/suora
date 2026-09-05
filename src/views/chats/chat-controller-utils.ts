import { buildAttachmentSummary, getTextParts, type ChatAttachmentRecord, type ChatMessagePart } from "@/data/domain/chat-message-parts"
import type { ChatDetail, ChatMessageRecord, ProviderConfigRecord } from "@/data/domain/models"
import type { ChatRuntimeSettings } from "@/data/repositories/chat-settings-repository"
import type { ChatAttachment } from "@/services/ai-service"
import type { AssistantResponsePart } from "@/views/chats/components/chat-assistant-response-group"

export function buildAttachmentSourceKey(file: File) {
  return [file.name, file.size, file.lastModified, file.type || "application/octet-stream"].join(":")
}

export async function fileToChatAttachment(file: File): Promise<ChatAttachment> {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}`))
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
    reader.readAsDataURL(file)
  })

  const sourceKey = buildAttachmentSourceKey(file)

  return {
    id: sourceKey,
    sourceKey,
    name: file.name,
    mediaType: file.type || "application/octet-stream",
    kind: file.type.startsWith("image/") ? "image" : "file",
    data,
  }
}

function toPersistedAttachmentRecord(attachment: ChatAttachment): ChatAttachmentRecord {
  return {
    id: attachment.id,
    sourceKey: attachment.sourceKey,
    name: attachment.name,
    mediaType: attachment.mediaType,
    data: attachment.data,
    kind: attachment.kind,
  }
}

export function createPersistedUserPayload(draft: string, attachments: ChatAttachment[]) {
  const trimmedDraft = draft.trim()
  const parts: ChatMessagePart[] = [
    ...(trimmedDraft ? [{ id: "user-text", type: "text", content: trimmedDraft } satisfies ChatMessagePart] : []),
    ...attachments.map((attachment, index) => ({
      id: `user-attachment-${index + 1}`,
      type: "attachment",
      attachment: toPersistedAttachmentRecord(attachment),
    } satisfies ChatMessagePart)),
  ]

  return {
    content: trimmedDraft || attachments.map((attachment) => buildAttachmentSummary(toPersistedAttachmentRecord(attachment))).join("\n"),
    parts,
  }
}

export function mergeChatAttachments(current: ChatAttachment[], next: ChatAttachment[]) {
  const attachmentMap = new Map(current.map((attachment) => [attachment.sourceKey, attachment]))
  next.forEach((attachment) => attachmentMap.set(attachment.sourceKey, attachment))
  return Array.from(attachmentMap.values())
}

export function hasVisibleAssistantContent(finalText: string, parts: AssistantResponsePart[]) {
  return finalText.trim().length > 0 || parts.some((part) => {
    if (part.type === "text") {
      return part.content.trim().length > 0
    }

    return part.activity.output !== undefined || Boolean(part.activity.error) || Boolean(part.activity.input)
  })
}

export function createPersistedAssistantPayload(finalText: string, parts: AssistantResponsePart[], completedWithAbort: boolean) {
  const hasVisibleContent = hasVisibleAssistantContent(finalText, parts)
  const persistedText = hasVisibleContent ? finalText.trim() : completedWithAbort ? "" : "No visible response was returned."
  const persistedParts = hasVisibleContent || completedWithAbort
    ? parts
    : [{ id: "assistant-empty", type: "text", content: persistedText }] satisfies AssistantResponsePart[]

  return {
    persistedText,
    persistedParts,
  }
}

function buildChatMessagePartsPlainText(parts: ChatMessagePart[]) {
  return parts.map((part) => {
    if (part.type === "text") {
      return part.content
    }

    if (part.type === "attachment") {
      return buildAttachmentSummary(part.attachment)
    }

    if (part.activity.error) {
      return `TOOL ERROR ${part.activity.toolName}\n${part.activity.error}`
    }

    if (part.activity.stopped) {
      return `TOOL STOPPED ${part.activity.toolName}\nStopped before a tool result was returned.`
    }

    if (part.activity.output !== undefined) {
      return `TOOL RESULT ${part.activity.toolName}\n${part.activity.output}`
    }

    return `TOOL CALL ${part.activity.toolName}\n${JSON.stringify(part.activity.input ?? {}, null, 2)}`
  }).filter(Boolean).join("\n\n")
}

export function buildChatMessageDisplayText(message: Pick<ChatMessageRecord, "content" | "parts">) {
  if (!message.parts?.length) {
    return message.content
  }

  const textParts = getTextParts(message.parts)
  if (textParts.length > 0) {
    return textParts.map((part) => part.content).join("\n\n")
  }

  return buildChatMessagePartsPlainText(message.parts)
}

export function buildChatTranscript(selectedChat: ChatDetail | null, assistantResponseParts: AssistantResponsePart[]) {
  const messageBlocks = (selectedChat?.messages ?? []).map((message) => `${message.role.toUpperCase()}\n${buildChatMessageDisplayText(message)}`).join("\n\n")
  const assistantText = assistantResponseParts
    .filter((part): part is Extract<AssistantResponsePart, { type: "text" }> => part.type === "text")
    .map((part) => part.content.trim())
    .filter(Boolean)
    .join("\n\n---\n\n")
  const assistantTools = assistantResponseParts
    .filter((part): part is Extract<AssistantResponsePart, { type: "tool" }> => part.type === "tool")
    .map((part) => {
      if (part.activity.error) {
        return `TOOL ERROR ${part.activity.toolName}\n${part.activity.error}`
      }

      if (part.activity.stopped) {
        return `TOOL STOPPED ${part.activity.toolName}\nStopped before a tool result was returned.`
      }

      if (part.activity.output !== undefined) {
        return `TOOL RESULT ${part.activity.toolName}\n${part.activity.output}`
      }

      return `TOOL CALL ${part.activity.toolName}\n${JSON.stringify(part.activity.input ?? {}, null, 2)}`
    })
    .filter(Boolean)
    .join("\n\n")

  const assistantBlocks = [
    assistantText ? `ASSISTANT\n${assistantText}` : "",
    assistantTools ? `ASSISTANT TOOLS\n${assistantTools}` : "",
  ].filter(Boolean).join("\n\n")

  return [messageBlocks, assistantBlocks].filter(Boolean).join("\n\n")
}

export function resolveFallbackRuntime(settingsDraft: ChatRuntimeSettings, providers: ProviderConfigRecord[]) {
  const provider = providers.find((item) => item.id === settingsDraft.model.providerId)
  const model = provider?.models.find((item) => item.id === settingsDraft.model.modelId)
  if (provider && model) {
    return null
  }

  const fallbackProvider = providers.find((item) => item.models.length > 0)
  const fallbackModel = fallbackProvider?.models[0]
  if (!fallbackProvider || !fallbackModel) {
    return null
  }

  return {
    ...settingsDraft,
    model: {
      ...settingsDraft.model,
      providerId: fallbackProvider.id,
      providerType: fallbackProvider.providerType as ChatRuntimeSettings["model"]["providerType"],
      baseUrl: fallbackProvider.baseUrl,
      apiKey: fallbackProvider.apiKey,
      modelId: fallbackModel.id,
    },
  } satisfies ChatRuntimeSettings
}