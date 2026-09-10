import { ipcMain } from "electron"
import { checkForUpdates, getUpdaterState } from "@electron/infrastructure/updater-service"
export function registerUpdaterIpc() { ipcMain.handle("updater:getState", () => getUpdaterState()); ipcMain.handle("updater:check", async () => checkForUpdates()) }
