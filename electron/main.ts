import { app, BrowserWindow } from "electron"

import { applyMigrations, closeDatabase, openDatabase } from "@electron/database/db-core"
import { setupIpc } from "@electron/ipc"
import { closeBrowserWindow } from "@electron/others/browser-window"
import { applySecurityPreferences, getPreferenceSettingsSnapshot } from "@electron/others/preferences"
import { configureAutoUpdater } from "@electron/others/updater"
import { createWindow } from "@electron/others/window"
import { configureAppStoragePaths, ensureWorkspace } from "@electron/others/workspace"

configureAppStoragePaths()

app.whenReady().then(async () => {
  await ensureWorkspace()
  applyMigrations(openDatabase())
  applySecurityPreferences()
  setupIpc()
  configureAutoUpdater()

  await createWindow()

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow()
    }
  })
})

app.on("certificate-error", (event, _webContents, _url, _error, _certificate, callback) => {
  const settings = getPreferenceSettingsSnapshot()
  if (settings.ignoreSslErrors) {
    event.preventDefault()
    callback(true)
  } else {
    callback(false)
  }
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception in main process:", error)
})

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection in main process:", reason)
})

app.on("before-quit", () => {
  try {
    closeBrowserWindow()
  } catch {
    // Ignore shutdown errors
  }
  try {
    closeDatabase()
  } catch {
    // Ignore shutdown errors
  }
})
