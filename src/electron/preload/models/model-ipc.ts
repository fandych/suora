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

function redactProvider<T extends { apiKey: string } | null>(provider: T): T extends null ? null : Omit<NonNullable<T>, "apiKey"> & {
  apiKey: string
  apiKeyConfigured: boolean
} {
  if (!provider) {
    return null as T extends null ? null : never
  }

  return {
    ...provider,
    apiKeyConfigured: Boolean(provider.apiKey),
    apiKey: "",
  } as unknown as T extends null ? null : never
}

export function registerModelIpc() {
  ipcMain.handle("models:list", async () => (await modelService.list()).map((provider) => redactProvider(provider)))
  ipcMain.handle("models:get", async (_event, id: unknown) =>
    redactProvider(await modelService.get(parseIpcInput(entityIdSchema, id))),
  )
  ipcMain.handle("models:create", (_event, value?: unknown) =>
    modelService.create(parseIpcInput(providerCreateSchema, value ?? {}).providerType).then((provider) => redactProvider(provider)),
  )
  ipcMain.handle("models:save", (_event, value: unknown) => {
    const provider = parseIpcInput(providerSaveSchema, value)
    return modelService
      .save({
        ...provider,
        updatedAt: Date.now(),
      })
      .then((saved) => redactProvider(saved))
  })
  ipcMain.handle("models:delete", (_event, id: unknown) => modelService.remove(parseIpcInput(entityIdSchema, id)))
  ipcMain.handle("models:discover", async (_event, value: unknown) => {
    const payload = parseIpcInput(providerDiscoverySchema, value)
    await ensureWorkspace()
    const persistedProvider = payload.id ? await modelService.get(payload.id) : null
    const apiKey = payload.apiKey || (payload.apiKeyConfigured ? persistedProvider?.apiKey || "" : "")
    return modelService.discover({
      id: payload.id || "discovery-preview",
      title: payload.providerType,
      description: "",
      providerType: payload.providerType,
      baseUrl: payload.baseUrl,
      apiKey,
      apiKeyConfigured: Boolean(apiKey),
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
