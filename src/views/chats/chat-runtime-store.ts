import { appendAssistantChatMessage, appendUserChatMessage, createChat, getChatDetail } from "@/data/repositories/chat-repository"
import { emitDataChanged } from "@/data/repositories/data-events"
import { saveChatSessionSettings, type ChatRuntimeSettings } from "@/data/repositories/chat-settings-repository"
import { showToast } from "@/lib/app-toast"
import { detectChatErrorKind, getChatErrorPresentation } from "@/services/chat-error-state"
import { streamChatAgentResponse, type ChatAgentEvent, type ChatAttachment } from "@/services/ai-service"
import { createPersistedAssistantPayload, createPersistedUserPayload } from "@/views/chats/chat-controller-utils"
import { applyEventToAssistantResponseParts, finalizeAssistantResponseParts } from "@/views/chats/assistant-response-parts"
import type { AssistantResponsePart } from "@/views/chats/components/chat-assistant-response-group"

export type ChatRuntimeSnapshot = {
  isResponding: boolean
  toolEvents: ChatAgentEvent[]
  streamingText: string
  assistantResponseMessageId: string | null
  assistantResponseParts: AssistantResponsePart[]
  pendingBrowserContinue: boolean
}

type ChatRuntimeEntry = ChatRuntimeSnapshot & {
  abortController: AbortController | null
}

type StartChatRunInput = {
  activeChatId: string | null
  selectedChatMessages: Awaited<ReturnType<typeof getChatDetail>>["messages"] | null
  settingsDraft: ChatRuntimeSettings
  selectedAgentId: string
  draft: string
  attachments: ChatAttachment[]
  onChatCreated: (chatId: string) => Promise<void> | void
  onUserMessageSaved: (chatId: string, detail: Awaited<ReturnType<typeof appendUserChatMessage>>) => void
  onAssistantMessageSaved: (chatId: string, detail: Awaited<ReturnType<typeof appendAssistantChatMessage>>) => void
  onFailureBeforeSave: () => void
  onAttachmentsConsumed: () => void
}

const runtimeEntries = new Map<string, ChatRuntimeEntry>()
const listeners = new Set<() => void>()
let lastRunningChatIdsKey = ""

const EMPTY_RUNTIME: ChatRuntimeSnapshot = {
  isResponding: false,
  toolEvents: [],
  streamingText: "",
  assistantResponseMessageId: null,
  assistantResponseParts: [],
  pendingBrowserContinue: false,
}

function emitRuntimeChange() {
  listeners.forEach((listener) => listener())
}

function emitRuntimePresenceChangeIfNeeded() {
  const nextKey = [...runtimeEntries.entries()]
    .filter(([, entry]) => entry.isResponding)
    .map(([chatId]) => chatId)
    .sort()
    .join(":")

  if (nextKey === lastRunningChatIdsKey) {
    return
  }

  lastRunningChatIdsKey = nextKey
  emitDataChanged("/chats")
}

function getOrCreateEntry(chatId: string) {
  const existing = runtimeEntries.get(chatId)
  if (existing) {
    return existing
  }

  const created: ChatRuntimeEntry = {
    ...EMPTY_RUNTIME,
    abortController: null,
  }
  runtimeEntries.set(chatId, created)
  return created
}

function setEntryState(chatId: string, patch: Partial<ChatRuntimeEntry>) {
  const entry = getOrCreateEntry(chatId)
  runtimeEntries.set(chatId, {
    ...entry,
    ...patch,
  })
  emitRuntimeChange()
  emitRuntimePresenceChangeIfNeeded()
}

export function subscribeToChatRuntime(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getRunningChatIds() {
  return new Set(
    [...runtimeEntries.entries()]
      .filter(([, entry]) => entry.isResponding)
      .map(([chatId]) => chatId)
  )
}

export function getChatRuntimeSnapshot(chatId: string | null): ChatRuntimeSnapshot {
  if (!chatId) {
    return EMPTY_RUNTIME
  }

  const entry = runtimeEntries.get(chatId)
  if (!entry) {
    return EMPTY_RUNTIME
  }

  return entry
}

export function clearChatRuntime(chatId: string | null) {
  if (!chatId) {
    return
  }

  runtimeEntries.delete(chatId)
  emitRuntimeChange()
}

export function stopChatRun(chatId: string | null) {
  if (!chatId) {
    return
  }

  const entry = runtimeEntries.get(chatId)
  entry?.abortController?.abort()
}

export function patchChatRuntimeParts(chatId: string | null, updater: (parts: AssistantResponsePart[]) => AssistantResponsePart[]) {
  if (!chatId) {
    return
  }

  const entry = getOrCreateEntry(chatId)
  setEntryState(chatId, {
    assistantResponseParts: updater(entry.assistantResponseParts),
  })
}

export function setPendingBrowserContinue(chatId: string | null, value: boolean) {
  if (!chatId) {
    return
  }

  setEntryState(chatId, {
    pendingBrowserContinue: value,
  })
}

export async function startChatRun(input: StartChatRunInput) {
  let workingChatId = input.activeChatId
  let historyMessages = input.selectedChatMessages

  if (!workingChatId || !historyMessages) {
    const created = await createChat()
    workingChatId = created.chat.id
    historyMessages = created.messages
    await saveChatSessionSettings(created.chat.id, {
      runtime: input.settingsDraft,
      selectedAgentId: input.selectedAgentId,
    })
    await input.onChatCreated(created.chat.id)
    emitDataChanged("/chats")
  }

  if (!workingChatId || !historyMessages) {
    throw new Error("Chat session is unavailable.")
  }

  const persistedUserPayload = createPersistedUserPayload(input.draft, input.attachments)
  const next = await appendUserChatMessage(workingChatId, persistedUserPayload.content, persistedUserPayload.parts)
  input.onUserMessageSaved(workingChatId, next)
  emitDataChanged("/chats")

  const abortController = new AbortController()
  setEntryState(workingChatId, {
    abortController,
    isResponding: true,
    toolEvents: [],
    streamingText: "",
    assistantResponseMessageId: null,
    assistantResponseParts: [{ id: "assistant-stream", type: "text", content: "", isPending: true }],
  })

  try {
    let finalText = ""
    let errorPartIndex = 0
    let streamedParts: AssistantResponsePart[] = []

    for await (const event of streamChatAgentResponse(next.messages, input.settingsDraft, {
      abortSignal: abortController.signal,
      selectedAgentId: input.selectedAgentId || undefined,
      attachments: input.attachments,
    })) {
      if (event.type === "error") {
        errorPartIndex += 1
      }

      streamedParts = applyEventToAssistantResponseParts(streamedParts, event, errorPartIndex)
      const currentEntry = getOrCreateEntry(workingChatId)
      setEntryState(workingChatId, {
        assistantResponseParts: streamedParts,
        streamingText: event.type === "text-delta" ? `${currentEntry.streamingText}${event.text}` : currentEntry.streamingText,
        toolEvents: event.type === "text-delta" ? currentEntry.toolEvents : [...currentEntry.toolEvents, event],
      })

      if (event.type === "text-delta") {
        finalText += event.text
      }
    }

    const finalizedParts = finalizeAssistantResponseParts(streamedParts)
    const completedWithAbort = abortController.signal.aborted
    const { persistedText, persistedParts } = createPersistedAssistantPayload(finalText, finalizedParts, completedWithAbort)

    if (persistedText.trim() || persistedParts.length > 0) {
      const withAssistant = await appendAssistantChatMessage(workingChatId, persistedText.trim(), persistedParts)
      input.onAssistantMessageSaved(workingChatId, withAssistant)
      emitDataChanged("/chats")
      setEntryState(workingChatId, {
        assistantResponseMessageId: withAssistant.messages[withAssistant.messages.length - 1]?.id ?? null,
        assistantResponseParts: persistedParts,
      })
    }

    input.onAttachmentsConsumed()
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      input.onAttachmentsConsumed()
      return workingChatId
    }

    input.onFailureBeforeSave()
    const message = error instanceof Error ? error.message : String(error)
    const errorKind = detectChatErrorKind(message)
    const presentation = getChatErrorPresentation(message, errorKind)
    const entry = getOrCreateEntry(workingChatId)
    setEntryState(workingChatId, {
      toolEvents: [...entry.toolEvents, { type: "error", error: message, errorKind }],
    })
    showToast({ title: presentation.title, description: presentation.detail, type: errorKind === "step-limit" ? "warning" : "error" })
    throw error
  } finally {
    const entry = getOrCreateEntry(workingChatId)
    setEntryState(workingChatId, {
      abortController: null,
      isResponding: false,
      assistantResponseParts: finalizeAssistantResponseParts(entry.assistantResponseParts),
    })
  }

  return workingChatId
}