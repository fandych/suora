import { ipcMain } from "electron"
import { getPreferenceValue, setPreferenceValue } from "@electron/database/drizzle/system-repository"

export function registerPreferenceIpc() {
  ipcMain.handle("preferences:get", () => getPreferenceValue())
  ipcMain.handle("preferences:save", async (_event, value: string) => { await setPreferenceValue(value); return value })
}
