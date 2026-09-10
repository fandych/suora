import { ipcMain } from "electron"
import { executeQuery } from "@electron/infrastructure/db-core"
import { ensureWorkspace } from "@electron/infrastructure/workspace-service"
import type { QueryPayload } from "@electron/types"
export function registerDatabaseIpc() { ipcMain.handle("db:execute", async (_event, payload: QueryPayload) => { await ensureWorkspace(); return executeQuery(payload) }) }
