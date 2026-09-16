import { ipcMain } from "electron"
import { startAiFetch, abortAiFetch } from "@/electron/app/chats/ai-fetch-service"

export function registerAiIpc() {
  ipcMain.handle("ai:fetch:start", async (event, payload) => startAiFetch(event.sender, payload))
  ipcMain.handle("ai:fetch:abort", (_event, requestId: string) => abortAiFetch(requestId))
}
