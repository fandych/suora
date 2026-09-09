import { appendAssistantChatMessage, appendUserChatMessage, createChat, getChatDetail } from "@/data/repositories/chat-repository"
import { emitDataChanged } from "@/data/repositories/data-events"
import { saveChatSessionSettings, type ChatRuntimeSettings } from "@/data/repositories/chat-settings-repository"
import { showToast } from "@/lib/ui-toast"
import { detectChatErrorKind, getChatErrorPresentation } from "@/data/domain/chat/chat-error-state"
import { streamChatAgentResponse } from "@/services/ai-service"
import type { ChatAgentEvent, ChatAttachment } from "@/services/chat/types"
import { createPersistedAssistantPayload } from "@/services/chat/assistant-persistence"
import { createPersistedUserPayload } from "@/views/chats/chat-controller-utils"
import { applyEventToAssistantResponseParts, finalizeAssistantResponseParts, type AssistantResponsePart } from "@/services/chat/response-parts"

export type ChatRuntimeSnapshot = {
  isResponding: boolean
  isStopping: boolean
  toolEvents: ChatAgentEvent[]
  streamingText: string
  assistantResponseMessageId: string | null
  assistantResponseParts: AssistantResponsePart[]
  pendingBrowserContinue: boolean
}

type ChatRuntimeEntry = ChatRuntimeSnapshot & {
  abortController: AbortController | null
  runId: string | null
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
const RUNTIME_RETENTION_MS = 5 * 60 * 1000

const EMPTY_RUNTIME: ChatRuntimeSnapshot = {
  isResponding: false,
  isStopping: false,
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
    runId: null,
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

function scheduleRuntimeCleanup(chatId: string, runId: string) {
  window.setTimeout(() => {
    const entry = runtimeEntries.get(chatId)
    if (entry?.runId === runId && !entry.isResponding) {
      runtimeEntries.delete(chatId)
      emitRuntimeChange()
      emitRuntimePresenceChangeIfNeeded()
    }
  }, RUNTIME_RETENTION_MS)
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
  emitRuntimePresenceChangeIfNeeded()
}

export function beginChatRun(chatId: string) {
  const entry = getOrCreateEntry(chatId)
  if (entry.isResponding) {
    throw new Error("This chat is already generating a response.")
  }

  const abortController = new AbortController()
  const runId = crypto.randomUUID()
  setEntryState(chatId, {
    abortController,
    isResponding: true,
    runId,
    toolEvents: [],
    streamingText: "",
    assistantResponseMessageId: null,
    assistantResponseParts: [{ id: "assistant-stream", type: "text", content: "", isPending: true }],
  })
  return { abortController, runId }
}

export function isChatRunActive(chatId: string, runId: string) {
  return runtimeEntries.get(chatId)?.runId === runId
}

export function stopChatRun(chatId: string | null) {
  if (!chatId) {
    return
  }

  const entry = runtimeEntries.get(chatId)
  if (!entry?.isResponding || entry.isStopping) {
    return
  }
  setEntryState(chatId, { isStopping: true })
  entry.abortController?.abort()
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

  const { abortController, runId } = beginChatRun(workingChatId)

  try {
    let finalText = ""
    let errorPartIndex = 0
    let streamedParts: AssistantResponsePart[] = [{ id: "assistant-stream", type: "text", content: "", isPending: true }]

    for await (const event of streamChatAgentResponse(next.messages, input.settingsDraft, {
      abortSignal: abortController.signal,
      selectedAgentId: input.selectedAgentId || undefined,
      attachments: input.attachments,
      browserSessionId: workingChatId,
    })) {
      if (!isChatRunActive(workingChatId, runId)) {
        return workingChatId
      }
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
      if (!isChatRunActive(workingChatId, runId)) {
        return workingChatId
      }
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
    const failedParts = [...entry.assistantResponseParts, { id: `assistant-error-${runId}`, type: "text", content: `回答失败：${presentation.detail}` } satisfies AssistantResponsePart]
    const failedMessage = await appendAssistantChatMessage(workingChatId, `回答失败：${presentation.detail}`, failedParts)
    input.onAssistantMessageSaved(workingChatId, failedMessage)
    emitDataChanged("/chats")
    showToast({ title: presentation.title, description: presentation.detail, type: errorKind === "step-limit" ? "warning" : "error" })
    throw error
  } finally {
    const entry = getOrCreateEntry(workingChatId)
    setEntryState(workingChatId, {
      abortController: null,
      isResponding: false,
      isStopping: false,
      runId,
      assistantResponseParts: finalizeAssistantResponseParts(entry.assistantResponseParts),
    })
    scheduleRuntimeCleanup(workingChatId, runId)
  }

  return workingChatId
}