import { ipcMain } from "electron"
import { startAiFetch, abortAiFetch } from "@electron/others/ai-fetch"
export function registerAiIpc() { ipcMain.handle("ai:fetch:start", async (event, payload) => startAiFetch(event.sender, payload)); ipcMain.handle("ai:fetch:abort", (_event, requestId: string) => abortAiFetch(requestId)) }
