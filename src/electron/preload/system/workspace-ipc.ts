import { ipcMain } from "electron"
import { getDatabasePath, getWorkspacePath } from "@/electron/infrastructure/workspace-paths"
import { getProxySettings, setProxySettings } from "@/electron/infrastructure/proxy-service"
import { ensureWorkspace } from "@/electron/infrastructure/workspace-service"
import { parseIpcInput, proxySettingsSchema } from "@/electron/preload/system/ipc-input-schemas"

export function registerWorkspaceIpc() {
  ipcMain.handle("workspace:getPaths", async () => {
    await ensureWorkspace()
    return { workspacePath: getWorkspacePath(), databasePath: getDatabasePath() }
  })
  ipcMain.handle("workspace:setProxySettings", (_event, settings) => {
    setProxySettings(parseIpcInput(proxySettingsSchema, settings))
    return { ok: true }
  })
  ipcMain.handle("workspace:getProxySettings", () => getProxySettings())
}
