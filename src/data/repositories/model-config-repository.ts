import type { ProviderConfigRecord } from "@/data/domain/models"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { defaultProviderTypes, providerPresets } from "@/data/repositories/model-provider-presets"
import { suoraIpc } from "@/lib/ipc"

const visibleProviderTypes = new Set<string>([...defaultProviderTypes, "custom"])
const unsupportedDiscoveryReasons = new Map<string, string>([
  ["azure", "Azure deployments cannot be listed from a stable shared `/models` endpoint here."],
  ["anthropic", "Anthropic model discovery is not wired through the current workspace adapter."],
  ["vercel", "Vercel AI Gateway does not expose a stable model catalog endpoint here."],
  ["google", "Gemini discovery is not wired through the current renderer flow yet."],
])

function normalizeProviderModel(providerType: string, model: ProviderConfigRecord["models"][number]) {
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

function mergePresetModels(providerType: string, models: ProviderConfigRecord["models"]) {
  if (models.length === 0) {
    const preset = getProviderPreset(providerType)
    return preset.models.map((model) => normalizeProviderModel(providerType, model))
  }

  return models.map((model) => normalizeProviderModel(providerType, model))
}

function mergeDiscoveredModels(providerType: string, currentModels: ProviderConfigRecord["models"], discoveredModels: ProviderConfigRecord["models"]) {
  const currentById = new Map(currentModels.map((model) => [model.id, model]))
  const mergedDiscoveredModels = discoveredModels.map((model) => normalizeProviderModel(providerType, {
    ...model,
    ...currentById.get(model.id),
    enabled: currentById.get(model.id)?.enabled ?? false,
  }))
  const discoveredIds = new Set(discoveredModels.map((model) => model.id))
  const extras = currentModels
    .filter((model) => !discoveredIds.has(model.id))
    .map((model) => normalizeProviderModel(providerType, model))

  return [...mergedDiscoveredModels, ...extras]
}

function providerAllowsNoKey(providerType: string) {
  return providerType === "ollama" || providerType === "custom" || providerType === "openrouter"
}

function normalizeProvider(provider: ProviderConfigRecord) {
  const preset = getProviderPreset(provider.providerType)
  const isKeyValid = provider.apiKey.trim().length > 0 || providerAllowsNoKey(provider.providerType)
  return {
    ...provider,
    title: provider.title || preset.title,
    baseUrl: provider.baseUrl || preset.baseUrl,
    enabled: isKeyValid ? provider.enabled : false,
    models: mergePresetModels(provider.providerType, provider.models).map((model) => ({
      ...model,
      enabled: isKeyValid ? model.enabled : false,
    })),
  }
}

function collapseProviders(providers: ProviderConfigRecord[]) {
  const defaults = new Map<string, ProviderConfigRecord>()
  const customProviders: ProviderConfigRecord[] = []

  for (const provider of providers) {
    if (provider.providerType === "custom") {
      if (provider.id !== "provider-custom") {
        customProviders.push(provider)
      }
      continue
    }

    const current = defaults.get(provider.providerType)
    if (!current || provider.updatedAt > current.updatedAt) {
      defaults.set(provider.providerType, provider)
    }
  }

  return [
    ...defaultProviderTypes.map((providerType) => defaults.get(providerType)).filter((provider): provider is ProviderConfigRecord => Boolean(provider)),
    ...customProviders.sort((left, right) => right.updatedAt - left.updatedAt),
  ]
}

async function ensurePresetProviders() {
  const existing = (await suoraIpc.models.list()).filter((provider) => visibleProviderTypes.has(provider.providerType))
  if (existing.length > 0) {
    return collapseProviders(existing)
  }

  for (const preset of providerPresets) {
    if (preset.providerType !== "custom") {
      await suoraIpc.models.create({
        title: preset.title,
        providerType: preset.providerType,
        baseUrl: preset.baseUrl,
        apiKey: "",
        enabled: false,
        models: preset.models,
      })
    }
  }

  return collapseProviders((await suoraIpc.models.list()).filter((provider) => visibleProviderTypes.has(provider.providerType)))
}

export function getProviderPreset(providerType: string) {
  return providerPresets.find((preset) => preset.providerType === providerType) ?? providerPresets[0]
}

export function getDefaultProviderBaseUrl(providerType: string) {
  return getProviderPreset(providerType).baseUrl
}

export function getProviderModelDiscoveryState(provider: Pick<ProviderConfigRecord, "providerType" | "baseUrl" | "apiKey">) {
  if (provider.providerType === "ollama") {
    return { capable: true, enabled: true, reason: null }
  }

  if (unsupportedDiscoveryReasons.has(provider.providerType)) {
    return {
      capable: false,
      enabled: false,
      reason: unsupportedDiscoveryReasons.get(provider.providerType) ?? "Remote model discovery is not supported for this provider.",
    }
  }

  if (!provider.baseUrl.trim()) {
    return {
      capable: true,
      enabled: false,
      reason: "Configure a base URL before refreshing remote models.",
    }
  }

  if (!provider.apiKey.trim() && provider.providerType !== "openrouter" && provider.providerType !== "custom") {
    return {
      capable: true,
      enabled: false,
      reason: "Configure an API key before refreshing remote models.",
    }
  }

  return { capable: true, enabled: true, reason: null }
}

export async function discoverProviderModelCatalog(provider: Pick<ProviderConfigRecord, "id" | "title" | "providerType" | "baseUrl" | "apiKey" | "enabled" | "updatedAt" | "models">) {
  await ensureSeeded()
  const discovered = await suoraIpc.models.discover({
    providerType: provider.providerType,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
  })

  return {
    provider: normalizeProvider({
      ...provider,
      models: mergeDiscoveredModels(provider.providerType, provider.models, discovered.models),
    }),
    source: discovered.source,
    discoveredCount: discovered.models.length,
  }
}

export async function listModelProviders() {
  await ensureSeeded()
  return (await ensurePresetProviders()).map(normalizeProvider)
}

export function getConfiguredModelProviders(providers: ProviderConfigRecord[]) {
  return providers
    .filter((provider) => provider.enabled && provider.models.some((model) => model.enabled))
    .map((provider) => ({
      ...provider,
      models: provider.models.filter((model) => model.enabled),
    }))
}

export async function listConfiguredModelProviders() {
  return getConfiguredModelProviders(await listModelProviders())
}

export async function getModelProvider(providerId: string) {
  await ensureSeeded()
  const provider = await suoraIpc.models.get(providerId)
  return provider && visibleProviderTypes.has(provider.providerType) ? normalizeProvider(provider) : null
}

export async function createModelProvider(providerType = "custom") {
  await ensureSeeded()
  const preset = getProviderPreset(providerType)
  return normalizeProvider(await suoraIpc.models.create({
    title: preset.title,
    providerType: preset.providerType,
    baseUrl: preset.baseUrl,
    apiKey: "",
    enabled: false,
    models: preset.models,
  } satisfies Partial<ProviderConfigRecord>))
}

export async function saveModelProvider(provider: ProviderConfigRecord) {
  await ensureSeeded()
  return normalizeProvider(await suoraIpc.models.save(provider))
}

export async function deleteModelProvider(providerId: string) {
  await ensureSeeded()
  return suoraIpc.models.delete(providerId)
}
