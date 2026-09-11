import { ipcMain } from "electron"
import { createModelWithDrizzle, deleteModelWithDrizzle, getModelWithDrizzle, listModelsWithDrizzle, saveModelWithDrizzle } from "@electron/database/drizzle/document-model-repository"
import { discoverProviderModels } from "@electron/services/model-discovery"
import { ensureWorkspace } from "@electron/infrastructure/workspace-service"
import { entityIdSchema, parseIpcInput, providerCreateSchema, providerDiscoverySchema, providerSaveSchema } from "@electron/ipc/system/ipc-input-schemas"

export function registerModelIpc() {
  ipcMain.handle("models:list", () => listModelsWithDrizzle())
  ipcMain.handle("models:get", (_event, id: unknown) => getModelWithDrizzle(parseIpcInput(entityIdSchema, id)))
  ipcMain.handle("models:create", (_event, value?: unknown) => createModelWithDrizzle(parseIpcInput(providerCreateSchema, value ?? {})))
  ipcMain.handle("models:save", (_event, value: unknown) => saveModelWithDrizzle(parseIpcInput(providerSaveSchema, value)))
  ipcMain.handle("models:delete", (_event, id: unknown) => deleteModelWithDrizzle(parseIpcInput(entityIdSchema, id)))
  ipcMain.handle("models:discover", async (_event, value: unknown) => { const payload = parseIpcInput(providerDiscoverySchema, value); await ensureWorkspace(); return discoverProviderModels(payload) })
}
