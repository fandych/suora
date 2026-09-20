import { ipcMain } from "electron"
import { startAiFetch, abortAiFetch } from "@/electron/app/chats/ai-fetch-service"
import { aiFetchStartSchema, entityIdSchema, parseIpcInput } from "@/electron/preload/system/ipc-input-schemas"

export function registerAiIpc() {
  ipcMain.handle("ai:fetch:start", async (event, payload) =>
    startAiFetch(event.sender, parseIpcInput(aiFetchStartSchema, payload)),
  )
  ipcMain.handle("ai:fetch:abort", (_event, requestId: string) =>
    abortAiFetch(parseIpcInput(entityIdSchema, requestId)),
  )
}
