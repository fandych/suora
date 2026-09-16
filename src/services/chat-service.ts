import type { ChatDetail, ChatSummary } from "@/types/chat"
import type { ChatAttachment, ChatMessagePart, ChatRuntimeSettings, ChatSessionSettings } from "@/types/chat"

type ChatEnsurePayload = {
  chatId: string
  title: string
  chatbotId: string
  summary?: string
  sourceType?: "manual" | "channel"
  sourceRef?: string | null
}

export type SendChatMessage = {
  content: string
  attachments?: ChatAttachment[]
}

export type SendMessageResult = {
  requestId: string
  sessionId: string
}

export type RetryableChatToolActivity = {
  toolName: string
  input?: Record<string, unknown>
}

export const ChatApi = {
  listAll: () => window.app!.chats.list() as Promise<ChatSummary[]>,
  get: (chatId: string) => window.app!.chats.get(chatId) as Promise<ChatDetail>,
  create: () => window.app!.chats.create() as Promise<ChatDetail>,
  ensure: async (payload: ChatEnsurePayload) => {
    const detail = (await window.app!.chats.ensure(payload)) as ChatDetail | null
    if (!detail) throw new Error(`Chat ${payload.chatId} could not be ensured.`)
    return detail
  },
  remove: (chatId: string) => window.app!.chats.delete(chatId),
  appendUser: async (chatId: string, content: string, parts?: ChatMessagePart[]) => {
    const detail = (await window.app!.chats.appendUser({ chatId, content, parts })) as ChatDetail | null
    if (!detail) throw new Error(`Chat ${chatId} was not found.`)
    return detail
  },
  appendAssistant: async (chatId: string, content: string, parts?: ChatMessagePart[]) => {
    const detail = (await window.app!.chats.appendAssistant({ chatId, content, parts })) as ChatDetail | null
    if (!detail) throw new Error(`Chat ${chatId} was not found.`)
    return detail
  },
  updateMessageParts: async (chatId: string, messageId: string, parts: ChatMessagePart[]) => {
    const detail = (await window.app!.chats.updateMessageParts({ chatId, messageId, parts })) as ChatDetail | null
    if (!detail) throw new Error(`Chat ${chatId} was not found.`)
    return detail
  },
  getSettings: () => window.app!.chats.getSettings() as Promise<string | null>,
  saveSettings: (payload: unknown) => window.app!.chats.saveSettings(payload),
  getSessionSettings: (chatId?: string | null) =>
    window.app!.chats.getSessionSettings(chatId) as Promise<ChatSessionSettings>,
  saveSessionSettings: (payload: { chatId?: string | null; runtime: ChatRuntimeSettings; selectedAgentId: string }) =>
    window.app!.chats.saveSessionSettings(payload) as Promise<ChatSessionSettings>,
  sendMessage: (sessionId: string, message: SendChatMessage) =>
    window.app!.chats.sendMessage({ sessionId, message }) as Promise<SendMessageResult>,
  cancelRuntime: (requestId: string) => window.app!.chats.cancelRuntime(requestId),
  retryToolActivity: (sessionId: string, activity: RetryableChatToolActivity) =>
    window.app!.chats.retryToolActivity({ sessionId, activity }) as Promise<string>,
  onRuntimeEvent: (listener: (...args: unknown[]) => void) => window.app!.chats.onRuntimeEvent(listener),
  offRuntimeEvent: (listener: (...args: unknown[]) => void) => window.app!.chats.offRuntimeEvent(listener),
}

export const listChats = ChatApi.listAll
export const getChatDetail = async (chatId: string) => {
  const detail = await ChatApi.get(chatId)
  if (!detail) throw new Error(`Chat ${chatId} was not found.`)
  return detail
}
export const createChat = ChatApi.create
export const ensureChatDetail = ChatApi.ensure
export const appendUserChatMessage = ChatApi.appendUser
export const appendAssistantChatMessage = ChatApi.appendAssistant
export const updateChatMessageParts = ChatApi.updateMessageParts
export const deleteChat = ChatApi.remove
export const getChatSessionSettings = ChatApi.getSessionSettings
export const saveChatSessionSettings = (chatId: string | null, settings: ChatSessionSettings) =>
  ChatApi.saveSessionSettings({ chatId, runtime: settings.runtime, selectedAgentId: settings.selectedAgentId })

export type { ChatDetail, ChatSummary }
