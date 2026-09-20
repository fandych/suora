import { ipcMain } from "electron"
import { z } from "zod"
import { preferenceService } from "@/electron/app/preferences/service"

export function registerPreferenceIpc() {
  ipcMain.handle("preferences:get", () => preferenceService.get())
  ipcMain.handle("preferences:save", (_event, value: unknown) =>
    preferenceService.save(
      z
        .string()
        .max(256 * 1024)
        .refine((raw) => {
          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>
            const port = parsed.mailServerPort
            return port === undefined || (typeof port === "number" && Number.isFinite(port) && port >= 1 && port <= 65535)
          } catch {
            return false
          }
        }, "Invalid preference payload.")
        .parse(value),
    ),
  )
}
