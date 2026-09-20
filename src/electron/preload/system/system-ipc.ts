import { app, ipcMain } from "electron"
import { getSystemDiagnostics } from "@/electron/app/system/diagnostics"
import { systemService } from "@/electron/app/system/service"
import {
  parseIpcInput,
  recentlyDeletedKindSchema,
  recentlyDeletedRestoreSchema,
} from "@/electron/preload/system/ipc-input-schemas"

export function registerSystemIpc() {
  ipcMain.handle("system:info", () => ({
    isDev: !app.isPackaged,
    platform: process.platform,
    version: app.getVersion(),
    productName: app.getName(),
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
  }))
  ipcMain.handle("system:diagnostics", async () => getSystemDiagnostics())
  ipcMain.handle("system:recentlyDeleted:list", (_event, kind: unknown) =>
    systemService.listRecentlyDeleted(
      kind === undefined || kind === null ? undefined : parseIpcInput(recentlyDeletedKindSchema, kind),
    ),
  )
  ipcMain.handle("system:recentlyDeleted:restore", (_event, value: unknown) =>
    systemService.restoreRecentlyDeleted(parseIpcInput(recentlyDeletedRestoreSchema, value).entryId),
  )
}
