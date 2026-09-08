import { ipcMain, shell } from "electron"
import { assertSafeHttpUrl } from "@electron/others/url-security"
export function registerToolExternalIpc() { ipcMain.handle("tools:openExternal", async (_event, url: string) => { const safeUrl = await assertSafeHttpUrl(url); await shell.openExternal(safeUrl.toString()); return { ok: true, url: safeUrl.toString() } }) }
