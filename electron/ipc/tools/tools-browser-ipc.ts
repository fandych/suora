import { ipcMain } from "electron"
import { clickBrowserElement, fillBrowserElement, getBrowserPageSnapshot, getBrowserWindowState, navigateBrowserWindow } from "@electron/others/browser-window"
export function registerToolBrowserIpc() {
  ipcMain.handle("tools:browserNavigate", async (_event, payload: { sessionId?: string; url?: string; visible?: boolean }) => navigateBrowserWindow(payload))
  ipcMain.handle("tools:browserState", async (_event, sessionId?: string) => getBrowserWindowState(sessionId || "global"))
  ipcMain.handle("tools:browserPage", async (_event, payload: { sessionId?: string; includeText?: boolean; includeLinks?: boolean }) => getBrowserPageSnapshot(payload))
  ipcMain.handle("tools:browserClick", async (_event, payload: { sessionId?: string; selector: string }) => clickBrowserElement(payload.selector, payload.sessionId || "global"))
  ipcMain.handle("tools:browserFill", async (_event, payload: { sessionId?: string; selector: string; value: string }) => fillBrowserElement(payload.selector, payload.value, payload.sessionId || "global"))
}
