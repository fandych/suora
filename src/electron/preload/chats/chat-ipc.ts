import { ipcMain } from "electron"
import { z } from "zod"
import { chatApplicationService } from "@/electron/app/chats/service"
import type { ChatRuntimeSettingsPayload } from "@/types/electron"
import { entityIdSchema, parseIpcInput } from "@/electron/preload/system/ipc-input-schemas"
import { chatEnsureSchema } from "@/electron/preload/chats/chat-ipc-schemas"
import { cancelChatRuntime, startChatRuntime } from "@/electron/app/chats/runtime"
import { retryChatToolActivity } from "@/electron/app/chats/tool-retry"

export function registerChatIpc() {
  ipcMain.handle("chats:list", () => chatApplicationService.list())
  ipcMain.handle("chats:get", (_event, id: unknown) => chatApplicationService.get(parseIpcInput(entityIdSchema, id)))
  ipcMain.handle("chats:create", () => chatApplicationService.create())
  ipcMain.handle("chats:ensure", (_event, value: unknown) =>
    chatApplicationService.ensure(parseIpcInput(chatEnsureSchema, value)),
  )
  ipcMain.handle("chats:delete", (_event, id: unknown) =>
    chatApplicationService.remove(parseIpcInput(entityIdSchema, id)),
  )
  ipcMain.handle("chats:appendUser", (_event, value: unknown) => chatApplicationService.appendUser(value))
  ipcMain.handle("chats:appendAssistant", (_event, value: unknown) => chatApplicationService.appendAssistant(value))
  ipcMain.handle("chats:updateMessageParts", (_event, value: unknown) =>
    chatApplicationService.updateMessageParts(value),
  )
  ipcMain.handle("chats:getSettings", () => chatApplicationService.getSettings())
  ipcMain.handle(
    "chats:saveSettings",
    (
      _event,
      value:
        | ChatRuntimeSettingsPayload
        | {
            defaultRuntime?: ChatRuntimeSettingsPayload
            chats?: Record<string, { runtime?: ChatRuntimeSettingsPayload; selectedAgentId?: string }>
          },
    ) => chatApplicationService.saveSettings(value),
  )
  ipcMain.handle("chats:getSessionSettings", (_event, value: unknown) =>
    chatApplicationService.getSessionSettings(typeof value === "string" ? value : null),
  )
  ipcMain.handle("chats:saveSessionSettings", (_event, value: unknown) =>
    chatApplicationService.saveSessionSettings(
      value as Parameters<typeof chatApplicationService.saveSessionSettings>[0],
    ),
  )
  ipcMain.handle("chats:sendMessage", (event, value: unknown) => startChatRuntime(value, event.sender))
  ipcMain.handle("chats:runtime:cancel", (_event, value: unknown) =>
    cancelChatRuntime(z.string().min(1).max(128).parse(value)),
  )
  ipcMain.handle("chats:retryToolActivity", (_event, value: unknown) => retryChatToolActivity(value))
}
