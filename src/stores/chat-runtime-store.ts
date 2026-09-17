import type { ChatRuntimeSettings } from "@/types/chat"
import { create } from "zustand"
import { emitDataChanged } from "@/services/data-events"
import { showToast } from "@/services/toast-service"
import { getChatErrorPresentation } from "@/lib/chat/error-presentation"
import type { ChatAgentEvent, ChatAttachment } from "@/types/chat"
import {
  applyEventToAssistantResponseParts,
  finalizeAssistantResponseParts,
  type AssistantResponsePart,
} from "@/lib/chat/response-parts"
import { ChatApi } from "@/services/chat-service"
import { subscribeToChatRuntime as subscribeToElectronChatRuntime } from "@/services/chat-runtime-listener"
import { createChat, getChatDetail, saveChatSessionSettings } from "@/services/chat-service"
import { hasAppBridge } from "@/services/bridge"

export type ChatRuntimeSnapshot = {
  isResponding: boolean
  isStopping: boolean
  toolEvents: ChatAgentEvent[]
  streamingText: string
  assistantResponseMessageId: string | null
  assistantResponseParts: AssistantResponsePart[]
  pendingBrowserContinue: boolean
}

type ChatRuntimeStore = {
  revision: number
  snapshots: Record<string, ChatRuntimeSnapshot>
  setSnapshot: (chatId: string, snapshot: ChatRuntimeSnapshot) => void
}

export const useChatRuntimeStore = create<ChatRuntimeStore>((set) => ({
  revision: 0,
  snapshots: {},
  setSnapshot: (chatId, snapshot) => set((state) => ({ snapshots: { ...state.snapshots, [chatId]: snapshot } })),
}))

type ChatRuntimeEntry = ChatRuntimeSnapshot & {
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
  onAttachmentsConsumed: () => void
}

const runtimeEntries = new Map<string, ChatRuntimeEntry>()
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
  useChatRuntimeStore.setState((state) => ({ revision: state.revision + 1 }))
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
  const current = runtimeEntries.get(chatId)!
  const snapshot: ChatRuntimeSnapshot = {
    isResponding: current.isResponding,
    isStopping: current.isStopping,
    toolEvents: current.toolEvents,
    streamingText: current.streamingText,
    assistantResponseMessageId: current.assistantResponseMessageId,
    assistantResponseParts: current.assistantResponseParts,
    pendingBrowserContinue: current.pendingBrowserContinue,
  }
  useChatRuntimeStore.getState().setSnapshot(chatId, snapshot)
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

export function subscribeToChatRuntimeStore(listener: () => void) {
  return useChatRuntimeStore.subscribe(listener)
}

export function getRunningChatIds() {
  return new Set([...runtimeEntries.entries()].filter(([, entry]) => entry.isResponding).map(([chatId]) => chatId))
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

function beginChatRun(chatId: string, runId: string | null) {
  const entry = getOrCreateEntry(chatId)
  if (entry.isResponding) {
    if (runId && (!entry.runId || entry.runId === runId)) {
      setEntryState(chatId, { runId })
      return
    }
    throw new Error("This chat is already generating a response.")
  }

  setEntryState(chatId, {
    isResponding: true,
    runId,
    toolEvents: [],
    streamingText: "",
    assistantResponseMessageId: null,
    assistantResponseParts: [{ id: "assistant-stream", type: "text", content: "", isPending: true }],
  })
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
  if (entry.runId) void ChatApi.cancelRuntime(entry.runId)
}

export function patchChatRuntimeParts(
  chatId: string | null,
  updater: (parts: AssistantResponsePart[]) => AssistantResponsePart[],
) {
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

function handleRuntimeEvent(payload: Parameters<Parameters<typeof subscribeToElectronChatRuntime>[0]>[0]) {
  const entry = runtimeEntries.get(payload.chatId)
  if (!entry || (entry.runId && entry.runId !== payload.requestId)) return

  if (!entry.runId) {
    setEntryState(payload.chatId, { runId: payload.requestId })
  }

  if (
    payload.type === "text-delta" ||
    payload.type === "tool-call" ||
    payload.type === "tool-result" ||
    payload.type === "error"
  ) {
    const parts = applyEventToAssistantResponseParts(entry.assistantResponseParts, payload, entry.toolEvents.length + 1)
    setEntryState(payload.chatId, {
      assistantResponseParts: parts,
      streamingText: parts
        .filter((part) => part.type === "text")
        .map((part) => part.content)
        .join(""),
      toolEvents: payload.type === "error" ? [...entry.toolEvents, payload] : entry.toolEvents,
    })
  }

  if (payload.type === "completed") {
    const assistant = payload.detail.messages.at(-1)
    if (assistant?.role === "assistant") {
      setEntryState(payload.chatId, {
        assistantResponseMessageId: assistant.id,
        assistantResponseParts: assistant.parts as AssistantResponsePart[],
        streamingText: assistant.content,
      })
    }
    emitDataChanged("/chats")
  }

  if (payload.type === "completed" || payload.type === "error" || payload.type === "cancelled") {
    const current = getOrCreateEntry(payload.chatId)
    setEntryState(payload.chatId, {
      isResponding: false,
      isStopping: false,
      assistantResponseParts: finalizeAssistantResponseParts(current.assistantResponseParts),
    })
    scheduleRuntimeCleanup(payload.chatId, payload.requestId)
  }
}

if (hasAppBridge()) {
  subscribeToElectronChatRuntime(handleRuntimeEvent)
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

  beginChatRun(workingChatId, null)

  try {
    const result = await ChatApi.sendMessage(workingChatId, {
      content: input.draft,
      attachments: input.attachments,
    })
    beginChatRun(workingChatId, result.requestId)
    input.onAttachmentsConsumed()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const errorKind = "request"
    const presentation = getChatErrorPresentation(message, errorKind)
    const entry = getOrCreateEntry(workingChatId)
    setEntryState(workingChatId, {
      toolEvents: [...entry.toolEvents, { type: "error", error: message, errorKind }],
    })
    showToast({
      title: presentation.title,
      description: presentation.detail,
      type: "error",
    })
    throw error
  }

  return workingChatId
}
