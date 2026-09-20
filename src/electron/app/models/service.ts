import type {
  ProviderConfigRecord,
  ProviderModelRecord,
  ProviderPreset,
} from "@/types/agent"
import {
  createModel,
  deleteModel,
  getModel,
  listModels,
  saveModel,
} from "@/electron/app/models/repository"
import { discoverProviderModels } from "@/electron/app/models/discovery"
import {
  defaultProviderTypes,
  getDefaultProviderBaseUrl,
  getProviderPreset,
  getProviderPresets,
  providerAllowsNoKey,
  providerPresets,
} from "@/electron/app/models/providers/registry"

type ProviderRow = Omit<ProviderConfigRecord, "enabled" | "models"> & { enabled: number | boolean; modelsJson: string }
const visibleProviderTypes = new Set<string>([...defaultProviderTypes, "custom"])
const unsupportedDiscoveryReasons = new Map<string, string>([
  ["azure", "Azure deployments cannot be listed from a stable shared `/models` endpoint here."],
  ["anthropic", "Anthropic model discovery is not wired through the current workspace adapter."],
  ["vercel", "Vercel AI Gateway does not expose a stable model catalog endpoint here."],
  ["google", "Gemini discovery is not wired through the current renderer flow yet."],
])

function parseModels(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? (parsed as ProviderModelRecord[]) : []
  } catch {
    return []
  }
}
function toProvider(row: ProviderRow): ProviderConfigRecord {
  return normalizeProvider({ ...row, enabled: Boolean(row.enabled), models: parseModels(row.modelsJson) })
}
function normalizeProviderModel(providerType: string, model: ProviderModelRecord): ProviderModelRecord {
  const presetModel = getProviderPreset(providerType).models.find((candidate) => candidate.id === model.id)
  return {
    ...presetModel,
    ...model,
    capabilities: model.capabilities ?? presetModel?.capabilities ?? ["toolcalling"],
    apiModes: model.apiModes ?? presetModel?.apiModes ?? ["messages"],
    contextWindow: model.contextWindow ?? presetModel?.contextWindow ?? 128000,
    maxOutputTokens: model.maxOutputTokens ?? presetModel?.maxOutputTokens ?? 8192,
    supportsParallelToolCalls: model.supportsParallelToolCalls ?? presetModel?.supportsParallelToolCalls ?? false,
    supportsReasoning: model.supportsReasoning ?? presetModel?.supportsReasoning ?? false,
  }
}
function normalizeProvider(provider: ProviderConfigRecord): ProviderConfigRecord {
  const preset = getProviderPreset(provider.providerType)
  const keyValid = provider.apiKey.trim().length > 0 || providerAllowsNoKey(provider.providerType)
  return {
    ...provider,
    title: provider.title || preset.title,
    description: provider.description || preset.description,
    baseUrl: provider.baseUrl || preset.baseUrl,
    enabled: keyValid ? provider.enabled : false,
    models: (provider.models.length > 0 ? provider.models : preset.models).map((model) => ({
      ...normalizeProviderModel(provider.providerType, model),
      enabled: keyValid ? model.enabled : false,
    })),
  }
}
function collapseProviders(providers: ProviderConfigRecord[]) {
  const defaults = new Map<string, ProviderConfigRecord>()
  const custom: ProviderConfigRecord[] = []
  for (const provider of providers) {
    if (provider.providerType === "custom") {
      if (provider.id !== "provider-custom") custom.push(provider)
      continue
    }
    const current = defaults.get(provider.providerType)
    if (!current || provider.updatedAt > current.updatedAt) defaults.set(provider.providerType, provider)
  }
  return [
    ...defaultProviderTypes
      .map((type) => defaults.get(type))
      .filter((provider): provider is ProviderConfigRecord => Boolean(provider)),
    ...custom.sort((left, right) => right.updatedAt - left.updatedAt),
  ]
}
async function ensurePresetProviders() {
  const existing = (await listModels())
    .filter((provider) => visibleProviderTypes.has(provider.providerType))
    .map(toProvider)
  const existingTypes = new Set(existing.map((provider) => provider.providerType))
  for (const preset of providerPresets)
    if (preset.providerType !== "custom" && !existingTypes.has(preset.providerType))
      await createModel({
        title: preset.title,
        providerType: preset.providerType,
        baseUrl: preset.baseUrl,
        apiKey: "",
        modelsJson: JSON.stringify(preset.models),
        enabled: false,
      })
  return collapseProviders(
    (await listModels())
      .filter((provider) => visibleProviderTypes.has(provider.providerType))
      .map(toProvider),
  )
}

export const modelService = {
  list: () => ensurePresetProviders(),
  get: async (providerId: string) => {
    const provider = await getModel(providerId)
    return provider && visibleProviderTypes.has(provider.providerType) ? toProvider(provider) : null
  },
  create: async (providerType = "custom") => {
    const preset = getProviderPreset(providerType)
    const created = await createModel({
      title: preset.title,
      providerType: preset.providerType,
      baseUrl: preset.baseUrl,
      apiKey: "",
      modelsJson: JSON.stringify(preset.models),
      enabled: false,
    })
    if (!created) throw new Error("Failed to create provider.")
    return toProvider(created)
  },
  save: async (provider: Omit<ProviderConfigRecord, "models"> & { models?: ProviderModelRecord[]; modelsJson?: string }) => {
    const models = provider.models?.length ? provider.models : parseModels(provider.modelsJson ?? "[]")
    const saved = await saveModel({ ...provider, modelsJson: JSON.stringify(models) })
    if (!saved) throw new Error(`Provider ${provider.id} was not found.`)
    return toProvider(saved)
  },
  remove: (providerId: string) => deleteModel(providerId),
  configured: async () =>
    (await ensurePresetProviders())
      .filter((provider) => provider.enabled && provider.models.some((model) => model.enabled))
      .map((provider) => ({ ...provider, models: provider.models.filter((model) => model.enabled) })),
  presets: () => getProviderPresets(),
  preset: (providerType: string) => getProviderPreset(providerType),
  defaultBaseUrl: (providerType: string) => getDefaultProviderBaseUrl(providerType),
  allowsNoKey: (providerType: string) => providerAllowsNoKey(providerType),
  discoveryState: (provider: Pick<ProviderConfigRecord, "providerType" | "baseUrl" | "apiKey" | "apiKeyConfigured">) => {
    if (provider.providerType === "ollama") return { capable: true, enabled: true, reason: null }
    if (unsupportedDiscoveryReasons.has(provider.providerType))
      return { capable: false, enabled: false, reason: unsupportedDiscoveryReasons.get(provider.providerType) ?? null }
    if (!provider.baseUrl.trim())
      return { capable: true, enabled: false, reason: "Configure a base URL before refreshing remote models." }
    if (!provider.apiKey.trim() && !provider.apiKeyConfigured && !providerAllowsNoKey(provider.providerType))
      return { capable: true, enabled: false, reason: "Configure an API key before refreshing remote models." }
    return { capable: true, enabled: true, reason: null }
  },
  discover: async (provider: ProviderConfigRecord) => {
    const discovered = await discoverProviderModels({
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
    })
    const currentById = new Map(provider.models.map((model) => [model.id, model]))
    const models = discovered.models.map((model) =>
      normalizeProviderModel(provider.providerType, {
        ...model,
        ...currentById.get(model.id),
        enabled: currentById.get(model.id)?.enabled ?? false,
      }),
    )
    const discoveredIds = new Set(discovered.models.map((model) => model.id))
    models.push(
      ...provider.models
        .filter((model) => !discoveredIds.has(model.id))
        .map((model) => normalizeProviderModel(provider.providerType, model)),
    )
    return {
      provider: normalizeProvider({ ...provider, models }),
      source: discovered.source,
      discoveredCount: discovered.models.length,
    }
  },
}

export type { ProviderConfigRecord, ProviderPreset }
