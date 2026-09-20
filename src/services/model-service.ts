import type { ProviderConfigRecord, ProviderPreset } from "@/types/agent"
import { requireAppBridge } from "@/services/bridge"

export type ProviderDiscoveryState = { capable: boolean; enabled: boolean; reason: string | null }
export type ProviderDiscoveryResult = { provider: ProviderConfigRecord; source: string; discoveredCount: number }
export const ModelApi = {
  listAll: () => requireAppBridge().models.list() as Promise<ProviderConfigRecord[]>,
  listConfigured: () => requireAppBridge().models.configured() as Promise<ProviderConfigRecord[]>,
  get: (providerId: string) => requireAppBridge().models.get(providerId) as Promise<ProviderConfigRecord | null>,
  create: (payload?: { providerType?: string }) => requireAppBridge().models.create(payload) as Promise<ProviderConfigRecord>,
  save: (payload: ProviderConfigRecord) =>
    requireAppBridge().models.save({
      ...payload,
      modelsJson: JSON.stringify(payload.models),
    }) as Promise<ProviderConfigRecord>,
  remove: (providerId: string) => requireAppBridge().models.delete(providerId),
  discover: (payload: ProviderConfigRecord) => requireAppBridge().models.discover(payload) as Promise<ProviderDiscoveryResult>,
  listPresets: () => requireAppBridge().models.listPresets() as Promise<ProviderPreset[]>,
  getPreset: (providerType: string) => requireAppBridge().models.getPreset(providerType) as Promise<ProviderPreset>,
  getDefaultBaseUrl: (providerType: string) => requireAppBridge().models.getDefaultBaseUrl(providerType) as Promise<string>,
  allowsNoKey: (providerType: string) => requireAppBridge().models.allowsNoKey(providerType) as Promise<boolean>,
  getDiscoveryState: (payload: Pick<ProviderConfigRecord, "providerType" | "baseUrl" | "apiKey" | "apiKeyConfigured" | "id">) =>
    requireAppBridge().models.getDiscoveryState(payload) as Promise<ProviderDiscoveryState>,
}

export const listModelProviders = ModelApi.listAll
export const getModelProvider = ModelApi.get
export const listConfiguredModelProviders = ModelApi.listConfigured

export type { ProviderConfigRecord, ProviderPreset }
