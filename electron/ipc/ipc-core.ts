import { app, ipcMain } from "electron"

import { startAiFetch, abortAiFetch } from "@electron/others/ai-fetch"
import { executeQuery } from "@electron/database/db-core"
import { executeIntegration } from "@electron/others/integrations"
import { getDatabasePath, getWorkspacePath } from "@electron/others/paths"
import { getProxySettings, setProxySettings } from "@electron/others/proxy"
import type { IntegrationExecutePayload, QueryPayload } from "@electron/types"
import { checkForUpdates, getUpdaterState } from "@electron/others/updater"
import { ensureWorkspace } from "@electron/others/workspace"

export function registerCoreIpc() {
  ipcMain.handle("system:info", () => ({
    isDev: !app.isPackaged,
    platform: process.platform,
    version: app.getVersion(),
  }))

  ipcMain.handle("workspace:getPaths", async () => {
    await ensureWorkspace()
    return {
      workspacePath: getWorkspacePath(),
      databasePath: getDatabasePath(),
    }
  })

  ipcMain.handle("db:execute", async (_event, payload: QueryPayload) => {
    await ensureWorkspace()
    return executeQuery(payload)
  })

  ipcMain.handle("workspace:setProxySettings", (_event, settings) => {
    setProxySettings(settings)
    return { ok: true }
  })

  ipcMain.handle("workspace:getProxySettings", () => getProxySettings())
  ipcMain.handle("ai:fetch:start", async (_event, payload) => startAiFetch(payload))
  ipcMain.handle("ai:fetch:abort", (_event, requestId: string) => abortAiFetch(requestId))
  ipcMain.handle("integration:execute", async (_event, payload: IntegrationExecutePayload) => executeIntegration(payload))
  ipcMain.handle("updater:getState", () => getUpdaterState())
  ipcMain.handle("updater:check", async () => checkForUpdates())
}
