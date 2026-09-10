import { ipcMain } from "electron"
import { z } from "zod"

import { applyMigrations, openDatabase } from "@electron/infrastructure/db-core"
import { ensureWorkspace } from "@electron/infrastructure/workspace-service"
import { entityIdSchema, parseIpcInput } from "@electron/ipc/system/ipc-input-schemas"

const catalogRoutes = ["/agents", "/models", "/integrations", "/schedulers", "/channels"] as const
const routeSchema = z.enum(catalogRoutes)

const catalogQueries: Record<typeof catalogRoutes[number], string> = {
  "/agents": "SELECT id, title, kind, summary, updated_at as updatedAt FROM agents ORDER BY updated_at DESC",
  "/models": "SELECT id, title, provider_type as providerType, updated_at as updatedAt FROM providers ORDER BY updated_at DESC",
  "/integrations": "SELECT id, title, kind, endpoint, updated_at as updatedAt FROM integrations ORDER BY updated_at DESC",
  "/schedulers": "SELECT id, title, schedule, updated_at as updatedAt FROM schedulers ORDER BY updated_at DESC",
  "/channels": "SELECT id, title, platform, json_extract(config_json, '$.catalogId') as catalogId, updated_at as updatedAt FROM channels ORDER BY updated_at DESC",
}

export function registerCatalogIpc() {
  ipcMain.handle("catalog:list", async (_event, route: unknown) => {
    const parsedRoute = parseIpcInput(routeSchema, route)
    const database = await getDatabase()
    return database.prepare(catalogQueries[parsedRoute]).all()
  })
  ipcMain.handle("catalog:get", async (_event, payload: unknown) => {
    const input = parseIpcInput(z.object({ route: routeSchema, itemId: entityIdSchema }), payload)
    const database = await getDatabase()
    const query = catalogQueries[input.route].replace(/ ORDER BY updated_at DESC$/, " WHERE id = ?")
    return database.prepare(query).get(input.itemId) ?? null
  })
}

async function getDatabase() {
  await ensureWorkspace()
  const database = openDatabase()
  applyMigrations(database)
  return database
}
