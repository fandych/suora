import { appendAssistantChatMessage, appendUserChatMessage, createChat, deleteChat, getChatDetail, listChats, updateChatMessageParts } from "@/data/repositories/chat-repository"
import { getChatSessionSettings, saveChatSessionSettings } from "@/data/repositories/chat-settings-repository"

export const chatApplicationService = {
  getDetail: getChatDetail,
  list: listChats,
  updateMessageParts: updateChatMessageParts,
  getSessionSettings: getChatSessionSettings,
  saveSessionSettings: saveChatSessionSettings,
  create: createChat,
  delete: deleteChat,
  appendAssistant: appendAssistantChatMessage,
  appendUser: appendUserChatMessage,
}
