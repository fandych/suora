import { app, BrowserWindow } from "electron"

import { createElectronApp } from "@/electron/app"
import { applyMigrations, closeDatabase, openDatabase } from "@/electron/infrastructure/db-core"
import { closeBrowserWindow } from "@/electron/infrastructure/browser-window"
import { getPreferenceSettingsSnapshot } from "@/electron/app/preferences/runtime"
import { configureAutoUpdater } from "@/electron/infrastructure/updater-service"
import { createWindow } from "@/electron/infrastructure/main-window"
import { configureAppStoragePaths, ensureWorkspace } from "@/electron/infrastructure/workspace-service"
import { setupIpc } from "@/electron/preload/index"

configureAppStoragePaths()
const electronApp = createElectronApp()

app.whenReady().then(async () => {
  await ensureWorkspace()
  applyMigrations(openDatabase())
  await electronApp.initialize()
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
