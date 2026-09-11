import { createModelProvider, discoverProviderModelCatalog, getDefaultProviderBaseUrl, getProviderModelDiscoveryState, getProviderPreset, listModelProviders, providerAllowsNoKey } from "@/data/repositories/model-config-repository"
import { providerPresets } from "@/data/repositories/model-provider-presets"

export const modelQueryService = {
  create: createModelProvider,
  discover: discoverProviderModelCatalog,
  getDefaultBaseUrl: getDefaultProviderBaseUrl,
  getDiscoveryState: getProviderModelDiscoveryState,
  getPreset: getProviderPreset,
  list: listModelProviders,
  allowsNoKey: providerAllowsNoKey,
  presets: providerPresets,
}
