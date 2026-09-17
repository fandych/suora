import { ipcMain } from "electron"
import { modelService } from "@/electron/app/models/service"
import { ensureWorkspace } from "@/electron/infrastructure/workspace-service"
import { entityIdSchema, parseIpcInput } from "@/electron/preload/system/ipc-input-schemas"
import {
  providerCreateSchema,
  providerDiscoverySchema,
  providerSaveSchema,
  providerTypeSchema,
} from "@/electron/preload/models/model-ipc-schema"

export function registerModelIpc() {
  ipcMain.handle("models:list", () => modelService.list())
  ipcMain.handle("models:get", (_event, id: unknown) => modelService.get(parseIpcInput(entityIdSchema, id)))
  ipcMain.handle("models:create", (_event, value?: unknown) =>
    modelService.create(parseIpcInput(providerCreateSchema, value ?? {}).providerType),
  )
  ipcMain.handle("models:save", (_event, value: unknown) => {
    const provider = parseIpcInput(providerSaveSchema, value)
    return modelService.save({
      ...provider,
      models: [],
      updatedAt: Date.now(),
    })
  })
  ipcMain.handle("models:delete", (_event, id: unknown) => modelService.remove(parseIpcInput(entityIdSchema, id)))
  ipcMain.handle("models:discover", async (_event, value: unknown) => {
    const payload = parseIpcInput(providerDiscoverySchema, value)
    await ensureWorkspace()
    return modelService.discover({
      id: "discovery-preview",
      title: payload.providerType,
      description: "",
      providerType: payload.providerType,
      baseUrl: payload.baseUrl,
      apiKey: payload.apiKey,
      enabled: false,
      models: [],
      updatedAt: Date.now(),
    })
  })
  ipcMain.handle("models:preset:list", () => modelService.presets())
  ipcMain.handle("models:preset:get", (_event, providerType: unknown) =>
    modelService.preset(parseIpcInput(providerTypeSchema, providerType)),
  )
  ipcMain.handle("models:preset:defaultBaseUrl", (_event, providerType: unknown) =>
    modelService.defaultBaseUrl(parseIpcInput(providerTypeSchema, providerType)),
  )
  ipcMain.handle("models:preset:allowsNoKey", (_event, providerType: unknown) =>
    modelService.allowsNoKey(parseIpcInput(providerTypeSchema, providerType)),
  )
  ipcMain.handle("models:configured", () => modelService.configured())
  ipcMain.handle("models:preset:discoveryState", (_event, provider: unknown) => {
    const payload = parseIpcInput(providerDiscoverySchema, provider)
    return modelService.discoveryState(payload)
  })
}
