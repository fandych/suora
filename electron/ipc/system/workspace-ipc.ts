import { ipcMain } from "electron"
import { getDatabasePath, getWorkspacePath } from "@electron/others/infrastructure/workspace-paths"
import { getProxySettings, setProxySettings } from "@electron/others/infrastructure/proxy-service"
import { ensureWorkspace } from "@electron/others/infrastructure/workspace-service"
export function registerWorkspaceIpc() {
  ipcMain.handle("workspace:getPaths", async () => { await ensureWorkspace(); return { workspacePath: getWorkspacePath(), databasePath: getDatabasePath() } })
  ipcMain.handle("workspace:setProxySettings", (_event, settings) => { setProxySettings(settings); return { ok: true } })
  ipcMain.handle("workspace:getProxySettings", () => getProxySettings())
}
