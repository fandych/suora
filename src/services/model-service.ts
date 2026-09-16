import type { ProviderConfigRecord, ProviderPreset } from "@/types/agent"

export type ProviderDiscoveryState = { capable: boolean; enabled: boolean; reason: string | null }
export type ProviderDiscoveryResult = { provider: ProviderConfigRecord; source: string; discoveredCount: number }
export const ModelApi = {
  listAll: () => window.app!.models.list() as Promise<ProviderConfigRecord[]>,
  listConfigured: () => window.app!.models.configured() as Promise<ProviderConfigRecord[]>,
  get: (providerId: string) => window.app!.models.get(providerId) as Promise<ProviderConfigRecord | null>,
  create: (payload?: { providerType?: string }) => window.app!.models.create(payload) as Promise<ProviderConfigRecord>,
  save: (payload: ProviderConfigRecord) =>
    window.app!.models.save({
      ...payload,
      modelsJson: JSON.stringify(payload.models),
    }) as Promise<ProviderConfigRecord>,
  remove: (providerId: string) => window.app!.models.delete(providerId),
  discover: (payload: ProviderConfigRecord) => window.app!.models.discover(payload) as Promise<ProviderDiscoveryResult>,
  listPresets: () => window.app!.models.listPresets() as Promise<ProviderPreset[]>,
  getPreset: (providerType: string) => window.app!.models.getPreset(providerType) as Promise<ProviderPreset>,
  getDefaultBaseUrl: (providerType: string) => window.app!.models.getDefaultBaseUrl(providerType) as Promise<string>,
  allowsNoKey: (providerType: string) => window.app!.models.allowsNoKey(providerType) as Promise<boolean>,
  getDiscoveryState: (payload: Pick<ProviderConfigRecord, "providerType" | "baseUrl" | "apiKey">) =>
    window.app!.models.getDiscoveryState(payload) as Promise<ProviderDiscoveryState>,
}

export const listModelProviders = ModelApi.listAll
export const getModelProvider = ModelApi.get
export const listConfiguredModelProviders = ModelApi.listConfigured

export type { ProviderConfigRecord, ProviderPreset }
