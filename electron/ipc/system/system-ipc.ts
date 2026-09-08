import { app, ipcMain } from "electron"
import { getSystemDiagnostics } from "@electron/others/system-diagnostics"
export function registerSystemIpc() {
  ipcMain.handle("system:info", () => ({ isDev: !app.isPackaged, platform: process.platform, version: app.getVersion(), productName: app.getName(), electronVersion: process.versions.electron, chromeVersion: process.versions.chrome, nodeVersion: process.versions.node }))
  ipcMain.handle("system:diagnostics", async () => getSystemDiagnostics())
}
