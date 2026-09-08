import { ipcMain } from "electron"
import { executeQuery } from "@electron/database/db-core"
import { ensureWorkspace } from "@electron/others/workspace"
import type { QueryPayload } from "@electron/types"
export function registerDatabaseIpc() { ipcMain.handle("db:execute", async (_event, payload: QueryPayload) => { await ensureWorkspace(); return executeQuery(payload) }) }
