import { ipcMain } from "electron"
import { z } from "zod"

import { listCatalogItems } from "@electron/database/drizzle/system-repository"
import { entityIdSchema, parseIpcInput } from "@electron/ipc/system/ipc-input-schemas"

const catalogRoutes = ["/agents", "/models", "/integrations", "/schedulers", "/channels"] as const
const routeSchema = z.enum(catalogRoutes)


export function registerCatalogIpc() {
  ipcMain.handle("catalog:list", async (_event, route: unknown) => {
    const parsedRoute = parseIpcInput(routeSchema, route)
    return listCatalogItems(parsedRoute === "/channels" ? "/agents" : parsedRoute)
  })
  ipcMain.handle("catalog:get", async (_event, payload: unknown) => {
    const input = parseIpcInput(z.object({ route: routeSchema, itemId: entityIdSchema }), payload)
    const rows = await listCatalogItems(input.route === "/channels" ? "/agents" : input.route)
    return rows.find((row) => row.id === input.itemId) ?? null
  })
}
