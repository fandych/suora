import type { ChatDetail, ChatRuntimeStatus, ChatSummary } from "@/types/chat"
import type { ChatAttachment, ChatMessagePart, ChatRuntimeSettings, ChatSessionSettings } from "@/types/chat"
import { requireAppBridge } from "@/services/bridge"

type ChatGetPayload = {
  chatId: string
  limit?: number
  beforeCursor?: { createdAt: number; id: string }
}

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
  detail: ChatDetail
}

export type RetryableChatToolActivity = {
  toolName: string
  input?: Record<string, unknown>
}

export const ChatApi = {
  listAll: () => requireAppBridge().chats.list() as Promise<ChatSummary[]>,
  get: (chatId: string, options?: Omit<ChatGetPayload, "chatId">) =>
    requireAppBridge().chats.get(options ? { chatId, ...options } : chatId) as Promise<ChatDetail>,
  create: () => requireAppBridge().chats.create() as Promise<ChatDetail>,
  ensure: async (payload: ChatEnsurePayload) => {
    const detail = (await requireAppBridge().chats.ensure(payload)) as ChatDetail | null
    if (!detail) throw new Error(`Chat ${payload.chatId} could not be ensured.`)
    return detail
  },
  remove: (chatId: string) => requireAppBridge().chats.delete(chatId),
  appendUser: async (chatId: string, content: string, parts?: ChatMessagePart[]) => {
    const detail = (await requireAppBridge().chats.appendUser({ chatId, content, parts })) as ChatDetail | null
    if (!detail) throw new Error(`Chat ${chatId} was not found.`)
    return detail
  },
  appendAssistant: async (chatId: string, content: string, parts?: ChatMessagePart[]) => {
    const detail = (await requireAppBridge().chats.appendAssistant({ chatId, content, parts })) as ChatDetail | null
    if (!detail) throw new Error(`Chat ${chatId} was not found.`)
    return detail
  },
  updateMessageParts: async (chatId: string, messageId: string, parts: ChatMessagePart[]) => {
    const detail = (await requireAppBridge().chats.updateMessageParts({ chatId, messageId, parts })) as ChatDetail | null
    if (!detail) throw new Error(`Chat ${chatId} was not found.`)
    return detail
  },
  getSettings: () => requireAppBridge().chats.getSettings() as Promise<string | null>,
  saveSettings: (payload: unknown) => requireAppBridge().chats.saveSettings(payload),
  getSessionSettings: (chatId?: string | null) =>
    requireAppBridge().chats.getSessionSettings(chatId) as Promise<ChatSessionSettings>,
  saveSessionSettings: (payload: { chatId?: string | null; runtime: ChatRuntimeSettings; selectedAgentId: string }) =>
    requireAppBridge().chats.saveSessionSettings(payload) as Promise<ChatSessionSettings>,
  sendMessage: (sessionId: string, message: SendChatMessage) =>
    requireAppBridge().chats.sendMessage({ sessionId, message }) as Promise<SendMessageResult>,
  cancelRuntime: (requestId: string) => requireAppBridge().chats.cancelRuntime(requestId),
  getRuntimeStatus: (requestId: string) => requireAppBridge().chats.getRuntimeStatus(requestId) as Promise<ChatRuntimeStatus | null>,
  retryToolActivity: (sessionId: string, activity: RetryableChatToolActivity) =>
    requireAppBridge().chats.retryToolActivity({ sessionId, activity }) as Promise<string>,
  onRuntimeEvent: (listener: (...args: unknown[]) => void) => requireAppBridge().chats.onRuntimeEvent(listener),
  offRuntimeEvent: (listener: (...args: unknown[]) => void) => requireAppBridge().chats.offRuntimeEvent(listener),
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
