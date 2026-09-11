import { app } from "electron"
import electronUpdater from "electron-updater"

const { autoUpdater } = electronUpdater

export function configureAutoUpdater() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
}

export function getUpdaterState() {
  return {
    enabled: app.isPackaged,
    channel: "latest",
  }
}

export function checkForUpdates() {
  if (!app.isPackaged) {
    return { skipped: true, reason: "not-packaged" }
  }

  return autoUpdater.checkForUpdates()
}
