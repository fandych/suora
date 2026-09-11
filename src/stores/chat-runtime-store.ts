import { create } from "zustand"
import type { ChatAgentEvent } from "@/services/chat/types"
import type { AssistantResponsePart } from "@/services/chat/response-parts"

export type ChatRuntimeSnapshot = {
  isResponding: boolean
  isStopping: boolean
  toolEvents: ChatAgentEvent[]
  streamingText: string
  assistantResponseMessageId: string | null
  assistantResponseParts: AssistantResponsePart[]
  pendingBrowserContinue: boolean
}

type ChatRuntimeStoreState = {
  entries: Record<string, ChatRuntimeSnapshot>
  revision: number
  setSnapshot: (chatId: string, snapshot: ChatRuntimeSnapshot) => void
  patch: (chatId: string, updater: (snapshot: ChatRuntimeSnapshot) => ChatRuntimeSnapshot) => void
  clear: (chatId: string) => void
}

export const EMPTY_CHAT_RUNTIME: ChatRuntimeSnapshot = { isResponding: false, isStopping: false, toolEvents: [], streamingText: "", assistantResponseMessageId: null, assistantResponseParts: [], pendingBrowserContinue: false }

export const useChatRuntimeStore = create<ChatRuntimeStoreState>((set) => ({
  entries: {}, revision: 0,
  setSnapshot: (chatId, snapshot) => set((state) => ({ entries: { ...state.entries, [chatId]: snapshot }, revision: state.revision + 1 })),
  patch: (chatId, updater) => set((state) => ({ entries: { ...state.entries, [chatId]: updater(state.entries[chatId] ?? EMPTY_CHAT_RUNTIME) }, revision: state.revision + 1 })),
  clear: (chatId) => set((state) => { const entries = { ...state.entries }; delete entries[chatId]; return { entries, revision: state.revision + 1 } }),
}))

export function getChatRuntimeStoreSnapshot(chatId: string | null) { return chatId ? useChatRuntimeStore.getState().entries[chatId] ?? EMPTY_CHAT_RUNTIME : EMPTY_CHAT_RUNTIME }