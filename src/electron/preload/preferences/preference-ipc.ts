import { ipcMain } from "electron"
import { preferenceService } from "@/electron/app/preferences/service"

export function registerPreferenceIpc() {
  ipcMain.handle("preferences:get", () => preferenceService.get())
  ipcMain.handle("preferences:save", (_event, value: string) => preferenceService.save(value))
}
