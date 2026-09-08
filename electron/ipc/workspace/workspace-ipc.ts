import { ipcMain } from "electron"
import { getDatabasePath, getWorkspacePath } from "@electron/others/paths"
import { getProxySettings, setProxySettings } from "@electron/others/proxy"
import { ensureWorkspace } from "@electron/others/workspace"
export function registerWorkspaceIpc() {
  ipcMain.handle("workspace:getPaths", async () => { await ensureWorkspace(); return { workspacePath: getWorkspacePath(), databasePath: getDatabasePath() } })
  ipcMain.handle("workspace:setProxySettings", (_event, settings) => { setProxySettings(settings); return { ok: true } })
  ipcMain.handle("workspace:getProxySettings", () => getProxySettings())
}
