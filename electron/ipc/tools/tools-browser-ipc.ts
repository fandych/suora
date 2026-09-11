import { ipcMain } from "electron"
import { clickBrowserElement, fillBrowserElement, getBrowserPageSnapshot, getBrowserWindowState, navigateBrowserWindow } from "@electron/infrastructure/browser-window"
import { browserClickSchema, browserFillSchema, browserNavigateSchema, browserPageSchema, browserStateSchema, parseBrowserInput } from "@electron/ipc/tools/tools-browser-schemas"
export function registerToolBrowserIpc() {
  ipcMain.handle("tools:browserNavigate", async (_event, payload: unknown) => navigateBrowserWindow(parseBrowserInput(browserNavigateSchema, payload)))
  ipcMain.handle("tools:browserState", async (_event, sessionId?: string) => getBrowserWindowState(parseBrowserInput(browserStateSchema, sessionId) || "global"))
  ipcMain.handle("tools:browserPage", async (_event, payload: unknown) => getBrowserPageSnapshot(parseBrowserInput(browserPageSchema, payload)))
  ipcMain.handle("tools:browserClick", async (_event, payload: unknown) => { const input = parseBrowserInput(browserClickSchema, payload); return clickBrowserElement(input.selector, input.sessionId || "global") })
  ipcMain.handle("tools:browserFill", async (_event, payload: unknown) => { const input = parseBrowserInput(browserFillSchema, payload); return fillBrowserElement(input.selector, input.value, input.sessionId || "global") })
}
