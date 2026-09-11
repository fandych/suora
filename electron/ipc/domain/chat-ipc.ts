import { ipcMain } from "electron"
import { appendChatMessageWithDrizzle, createChatWithDrizzle, deleteChatWithDrizzle, ensureChatWithDrizzle, getChatSettingsWithDrizzle, getChatWithDrizzle, listChatsWithDrizzle, saveChatSettingsWithDrizzle, updateChatMessagePartsWithDrizzle } from "@electron/database/drizzle/chat-repository"
import { parseAppendAssistantPayload, parseAppendUserPayload, parseUpdateMessagePartsPayload } from "@electron/services/chat-schemas"
import type { ChatRuntimeSettingsPayload } from "@electron/types"
import { chatEnsureSchema, entityIdSchema, parseIpcInput } from "@electron/ipc/system/ipc-input-schemas"

export function registerChatIpc() {
  ipcMain.handle("chats:list", () => listChatsWithDrizzle())
  ipcMain.handle("chats:get", (_event, id: unknown) => getChatWithDrizzle(parseIpcInput(entityIdSchema, id)))
  ipcMain.handle("chats:create", () => createChatWithDrizzle())
  ipcMain.handle("chats:ensure", (_event, value: unknown) => ensureChatWithDrizzle(parseIpcInput(chatEnsureSchema, value)))
  ipcMain.handle("chats:delete", (_event, id: unknown) => deleteChatWithDrizzle(parseIpcInput(entityIdSchema, id)))
  ipcMain.handle("chats:appendUser", (_event, value: unknown) => appendChatMessageWithDrizzle(parseAppendUserPayload(value), "user"))
  ipcMain.handle("chats:appendAssistant", (_event, value: unknown) => appendChatMessageWithDrizzle(parseAppendAssistantPayload(value), "assistant"))
  ipcMain.handle("chats:updateMessageParts", (_event, value: unknown) => updateChatMessagePartsWithDrizzle(parseUpdateMessagePartsPayload(value)))
  ipcMain.handle("chats:getSettings", () => getChatSettingsWithDrizzle())
  ipcMain.handle("chats:saveSettings", (_event, value: ChatRuntimeSettingsPayload | { defaultRuntime?: ChatRuntimeSettingsPayload; chats?: Record<string, { runtime?: ChatRuntimeSettingsPayload; selectedAgentId?: string }> }) => saveChatSettingsWithDrizzle(value))
}
