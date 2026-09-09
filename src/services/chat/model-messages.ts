import type { ModelMessage, UserModelMessage } from "ai"

import { getAttachmentParts, getTextParts } from "@/data/domain/chat-message-parts"
import type { ChatMessageRecord } from "@/data/domain/models"
import type { ChatAttachmentRecord } from "@/data/domain/chat-message-parts"

const MAX_RECENT_MESSAGES = 16
const MAX_MEMORY_LINES = 18
const MAX_LINE_CHARS = 320
const MAX_TOOL_OUTPUT_CHARS = 4000
const MAX_MEMORY_CHARS = 5000

function truncate(value: string, maxChars: number) {
  return value.length <= maxChars ? value : `${value.slice(0, maxChars - 1)}...`
}

function summarizeMessage(message: ChatMessageRecord) {
  if (message.parts?.length) {
    const summary = message.parts.map((part) => {
      if (part.type === "text") {
        return truncate(part.content.replace(/\s+/g, " ").trim(), MAX_LINE_CHARS)
      }

      if (part.type === "attachment") {
        return `[attachment ${part.attachment.name}]`
      }

      if (part.activity.error) {
        return `[tool ${part.activity.toolName} error: ${truncate(part.activity.error, 180)}]`
      }

      if (part.activity.output !== undefined) {
        return `[tool ${part.activity.toolName} result: ${truncate(part.activity.output, 180)}]`
      }

      return `[tool ${part.activity.toolName} running]`
    }).filter(Boolean).join(" ")

    return `${message.role.toUpperCase()}: ${truncate(summary, MAX_LINE_CHARS)}`
  }

  return `${message.role.toUpperCase()}: ${truncate(message.content.replace(/\s+/g, " ").trim(), MAX_LINE_CHARS)}`
}

function buildSessionMemory(history: ChatMessageRecord[]) {
  if (history.length <= MAX_RECENT_MESSAGES) {
    return null
  }

  const olderMessages = history.slice(0, -MAX_RECENT_MESSAGES)
  const memoryLines = olderMessages.slice(-MAX_MEMORY_LINES).map(summarizeMessage).filter(Boolean)
  if (memoryLines.length === 0) {
    return null
  }

  const content = `Session memory from earlier turns:\n${memoryLines.map((line) => `- ${line}`).join("\n")}`

  return {
    role: "system",
    content: truncate(content, MAX_MEMORY_CHARS),
  } satisfies ModelMessage
}

function toAssistantText(message: ChatMessageRecord) {
  if (!message.parts?.length) {
    return message.content
  }

  return message.parts.map((part) => {
    if (part.type === "text") {
      return part.content
    }

    if (part.type === "attachment") {
      return `[attachment ${part.attachment.name}]`
    }

    if (part.activity.error) {
      return `[tool ${part.activity.toolName} error]\n${truncate(part.activity.error, MAX_TOOL_OUTPUT_CHARS)}`
    }

    if (part.activity.output !== undefined) {
      return `[tool ${part.activity.toolName} result]\n${truncate(part.activity.output, MAX_TOOL_OUTPUT_CHARS)}`
    }

    return `[tool ${part.activity.toolName} called]\n${JSON.stringify(part.activity.input ?? {}, null, 2)}`
  }).filter(Boolean).join("\n\n")
}

function buildUserContentFromParts(message: ChatMessageRecord, attachments: ChatAttachmentRecord[]) {
  const textParts = getTextParts(message.parts)
  const attachmentParts = getAttachmentParts(message.parts)
  const fallbackAttachments = attachmentParts.length === 0 ? attachments : []
  const textContent = textParts.length > 0 ? textParts.map((part) => part.content).join("\n\n") : message.content

  if (attachmentParts.length === 0 && fallbackAttachments.length === 0) {
    return textContent
  }

  return [
    { type: "text" as const, text: textContent },
    ...attachmentParts.map((part) => ({
      type: "file" as const,
      mediaType: part.attachment.mediaType || (part.attachment.kind === "image" ? "image/png" : "application/octet-stream"),
      filename: part.attachment.name,
      data: part.attachment.data,
    })),
    ...fallbackAttachments.map((attachment) => ({
      type: "file" as const,
      mediaType: attachment.mediaType || (attachment.kind === "image" ? "image/png" : "application/octet-stream"),
      filename: attachment.name,
      data: attachment.data,
    })),
  ]
}

export function buildChatModelMessages(history: ChatMessageRecord[], attachments: ChatAttachmentRecord[] = []): ModelMessage[] {
  if (history.length === 0 && attachments.length === 0) {
    return []
  }

  const sessionMemory = buildSessionMemory(history)
  const recentMessages = history.slice(-MAX_RECENT_MESSAGES)
  const modelMessages = recentMessages.map((message, index) => {
    if (message.role === "user") {
      const content = buildUserContentFromParts(message, index === recentMessages.length - 1 ? attachments : [])
      if (Array.isArray(content)) {
        return {
          role: "user",
          content,
        } satisfies UserModelMessage
      }

      return {
        role: "user",
        content,
      } satisfies ModelMessage
    }

    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: toAssistantText(message),
      } satisfies ModelMessage
    }

    return { role: message.role, content: message.content } satisfies ModelMessage
  })

  return sessionMemory ? [sessionMemory, ...modelMessages] : modelMessages
}