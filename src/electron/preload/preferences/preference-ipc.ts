import { ipcMain } from "electron"
import { z } from "zod"
import { preferenceService } from "@/electron/app/preferences/service"

export function registerPreferenceIpc() {
  ipcMain.handle("preferences:get", () => preferenceService.get())
  ipcMain.handle("preferences:save", (_event, value: unknown) =>
    preferenceService.save(z.string().max(256 * 1024).parse(value)),
  )
}
