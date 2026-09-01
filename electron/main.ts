import { app, BrowserWindow } from "electron"

import { applyMigrations, closeDatabase, openDatabase } from "@electron/database/db-core"
import { setupIpc } from "@electron/ipc"
import { configureAutoUpdater } from "@electron/others/updater"
import { createWindow } from "@electron/others/window"
import { configureAppStoragePaths, ensureWorkspace } from "@electron/others/workspace"

configureAppStoragePaths()

app.whenReady().then(async () => {
  await ensureWorkspace()
  applyMigrations(openDatabase())
  setupIpc()
  configureAutoUpdater()

  await createWindow()

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow()
    }
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("before-quit", () => {
  closeDatabase()
})
