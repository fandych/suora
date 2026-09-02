import type { ProviderConfigRecord, ProviderPreset } from "@/data/domain/models"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { suoraIpc } from "@/lib/ipc"

const defaultProviderTypes = ["openai", "azure", "deepseek", "anthropic", "bailian", "kimi", "openrouter", "vercel", "ollama"] as const
const visibleProviderTypes = new Set<string>([...defaultProviderTypes, "custom"])

function createModel(
  id: string,
  name: string,
  enabled = false,
  capabilities: ProviderPreset["models"][number]["capabilities"] = ["toolcalling"],
  apiModes: ProviderPreset["models"][number]["apiModes"] = ["messages"],
  contextWindow = 128000,
  maxOutputTokens = 16384,
  supportsParallelToolCalls = false,
  supportsReasoning = false
) {
  return {
    id,
    name,
    enabled,
    capabilities,
    apiModes,
    contextWindow,
    maxOutputTokens,
    supportsParallelToolCalls,
    supportsReasoning,
  }
}

export const providerPresets: ProviderPreset[] = [
  {
    providerType: "openai",
    title: "OpenAI",
    description: "OpenAI flagship models.",
    baseUrl: "https://api.openai.com/v1",
    models: [
      createModel("gpt-5.6-sol", "GPT-5.6 Sol", false, ["toolcalling", "vision", "structuredOutput"], ["messages", "responses", "completions"], 1050000, 128000, true, true),
      createModel("gpt-5.6-terra", "GPT-5.6 Terra", false, ["toolcalling", "vision", "structuredOutput"], ["messages", "responses", "completions"], 1050000, 128000, true, true),
      createModel("gpt-5.6-luna", "GPT-5.6 Luna", false, ["toolcalling", "vision", "structuredOutput"], ["messages", "responses", "completions"], 1050000, 128000, true, true),
      createModel("gpt-5", "GPT-5", false, ["toolcalling", "vision", "structuredOutput"], ["messages", "responses", "completions"], 400000, 128000, true, true),
      createModel("gpt-5-mini", "GPT-5 Mini", false, ["toolcalling", "vision", "structuredOutput"], ["messages", "responses", "completions"], 400000, 128000, true, true),
    ],
  },
  {
    providerType: "azure",
    title: "Azure",
    description: "Azure Foundry OpenAI deployments.",
    baseUrl: "https://your-resource-name.openai.azure.com/openai/deployments",
    models: [
      createModel("gpt-5.6-sol", "GPT-5.6 Sol", false, ["toolcalling", "vision", "structuredOutput"], ["messages", "responses", "completions"], 1050000, 128000, true, true),
      createModel("gpt-5.6-terra", "GPT-5.6 Terra", false, ["toolcalling", "vision", "structuredOutput"], ["messages", "responses", "completions"], 1050000, 128000, true, true),
      createModel("gpt-chat-latest", "GPT Chat Latest", false, ["toolcalling", "vision", "structuredOutput"], ["messages", "responses", "completions"], 400000, 128000, true, true),
      createModel("gpt-4.1", "GPT-4.1", false, ["toolcalling", "vision", "structuredOutput"], ["messages", "responses", "completions"], 1047576, 32768, true, false),
    ],
  },
  {
    providerType: "deepseek",
    title: "DeepSeek",
    description: "DeepSeek official API models.",
    baseUrl: "https://api.deepseek.com",
    models: [
      createModel("deepseek-v4-flash", "DeepSeek V4 Flash", false, ["toolcalling", "structuredOutput"], ["messages", "responses", "completions"], 1000000, 384000, true, true),
      createModel("deepseek-v4-pro", "DeepSeek V4 Pro", false, ["toolcalling", "structuredOutput"], ["messages", "responses", "completions"], 1000000, 384000, true, true),
      createModel("deepseek-v4-flash-vision-exp", "DeepSeek V4 Flash Vision Exp", false, ["toolcalling", "vision", "structuredOutput"], ["messages", "responses", "completions"], 1000000, 384000, true, true),
    ],
  },
  {
    providerType: "anthropic",
    title: "Anthropic",
    description: "Current Claude family.",
    baseUrl: "https://api.anthropic.com/v1",
    models: [
      createModel("claude-opus-5", "Claude Opus 5", false, ["toolcalling", "vision", "structuredOutput"], ["messages"], 200000, 64000, true, true),
      createModel("claude-sonnet-5", "Claude Sonnet 5", false, ["toolcalling", "vision", "structuredOutput"], ["messages"], 200000, 64000, true, true),
      createModel("claude-opus-4-8", "Claude Opus 4.8", false, ["toolcalling", "vision", "structuredOutput"], ["messages"], 200000, 64000, true, true),
      createModel("claude-haiku-4-5", "Claude Haiku 4.5", false, ["toolcalling", "vision"], ["messages"], 200000, 8192, true, false),
    ],
  },
  {
    providerType: "bailian",
    title: "Bailian",
    description: "Alibaba Bailian defaults.",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: [
      createModel("qwen3.8-max", "Qwen3.8 Max", false, ["toolcalling", "vision", "structuredOutput"], ["messages", "responses"], 131072, 8192, true, true),
      createModel("qwen3.7-plus", "Qwen3.7 Plus", false, ["toolcalling", "vision", "structuredOutput"], ["messages", "responses"], 131072, 8192, true, false),
      createModel("qwen3.8-flash", "Qwen3.8 Flash", false, ["toolcalling", "vision", "structuredOutput"], ["messages", "responses"], 131072, 8192, true, false),
    ],
  },
  {
    providerType: "kimi",
    title: "Kimi",
    description: "Moonshot Kimi models.",
    baseUrl: "https://api.moonshot.ai/v1",
    models: [
      createModel("kimi-k2.6", "Kimi K2.6", false, ["toolcalling", "vision"], ["messages", "responses"], 262144, 262144, true, true),
      createModel("kimi-k2.7-code", "Kimi K2.7 Code", false, ["toolcalling", "vision"], ["messages", "responses"], 262144, 262144, true, true),
      createModel("kimi-k3", "Kimi K3", false, ["toolcalling", "vision"], ["messages", "responses"], 262144, 262144, true, true),
    ],
  },
  {
    providerType: "openrouter",
    title: "OpenRouter",
    description: "OpenRouter cross-provider routes.",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      createModel("openai/gpt-5.6-terra", "OpenAI / GPT-5.6 Terra", false, ["toolcalling", "vision", "structuredOutput"], ["messages", "responses", "completions"], 1050000, 128000, true, true),
      createModel("anthropic/claude-sonnet-5", "Anthropic / Claude Sonnet 5", false, ["toolcalling", "vision", "structuredOutput"], ["messages"], 200000, 64000, true, true),
      createModel("deepseek/deepseek-v4-pro", "DeepSeek / V4 Pro", false, ["toolcalling", "structuredOutput"], ["messages", "responses", "completions"], 1000000, 384000, true, true),
      createModel("qwen/qwen3.8-flash", "Qwen / Qwen3.8 Flash", false, ["toolcalling", "vision"], ["messages", "responses", "completions"], 1000000, 128000, true, true),
    ],
  },
  {
    providerType: "vercel",
    title: "Vercel",
    description: "Vercel AI Gateway defaults.",
    baseUrl: "https://ai-gateway.vercel.sh/v1",
    models: [
      createModel("openai/gpt-5", "OpenAI / GPT-5", false, ["toolcalling", "vision", "structuredOutput"], ["messages", "responses", "completions"], 400000, 128000, true, true),
      createModel("anthropic/claude-sonnet-5", "Anthropic / Claude Sonnet 5", false, ["toolcalling", "vision", "structuredOutput"], ["messages"], 200000, 64000, true, true),
      createModel("deepseek/deepseek-v4-pro", "DeepSeek / V4 Pro", false, ["toolcalling", "structuredOutput"], ["messages", "responses", "completions"], 1000000, 384000, true, true),
    ],
  },
  {
    providerType: "ollama",
    title: "Ollama",
    description: "Popular current Ollama library entries.",
    baseUrl: "http://localhost:11434/v1",
    models: [
      createModel("qwen3.8", "Qwen3.8", false, ["toolcalling", "vision"], ["messages", "responses", "completions"], 128000, 32768, false, true),
      createModel("gemma4", "Gemma 4", false, ["toolcalling", "vision"], ["messages", "responses", "completions"], 128000, 32768, false, true),
      createModel("deepseek-v4-pro", "DeepSeek V4 Pro", false, ["toolcalling"], ["messages", "responses", "completions"], 1000000, 384000, false, true),
      createModel("llama3.3", "Llama 3.3", false, ["toolcalling"], ["messages", "responses", "completions"], 128000, 8192, false, false),
    ],
  },
  {
    providerType: "custom",
    title: "Custom",
    description: "Bring your own endpoint and define arbitrary model metadata.",
    baseUrl: "",
    models: [createModel("custom-model", "Custom Model")],
  },
]

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
  const preset = getProviderPreset(providerType)
  const currentById = new Map(models.map((model) => [model.id, model]))
  const merged = preset.models.map((model) => normalizeProviderModel(providerType, {
    ...model,
    ...currentById.get(model.id),
    enabled: currentById.get(model.id)?.enabled ?? model.enabled,
  }))
  const extras = models
    .filter((model) => !preset.models.some((presetModel) => presetModel.id === model.id))
    .map((model) => normalizeProviderModel(providerType, model))

  return [...merged, ...extras]
}

function normalizeProvider(provider: ProviderConfigRecord) {
  const preset = getProviderPreset(provider.providerType)
  const hasApiKey = provider.apiKey.trim().length > 0
  return {
    ...provider,
    title: provider.title || preset.title,
    baseUrl: provider.baseUrl || preset.baseUrl,
    enabled: hasApiKey ? provider.enabled : false,
    models: mergePresetModels(provider.providerType, provider.models).map((model) => ({
      ...model,
      enabled: hasApiKey ? model.enabled : false,
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
  const visible = collapseProviders(existing)
  const existingTypes = new Set(visible.filter((provider) => provider.providerType !== "custom").map((provider) => provider.providerType))
  const missingPresets = providerPresets.filter((preset) => preset.providerType !== "custom" && !existingTypes.has(preset.providerType))

  if (missingPresets.length === 0) {
    return visible
  }

  for (const preset of missingPresets) {
    await suoraIpc.models.create({
      title: preset.title,
      providerType: preset.providerType,
      baseUrl: preset.baseUrl,
      apiKey: "",
      enabled: false,
      models: preset.models,
    })
  }

  return collapseProviders((await suoraIpc.models.list()).filter((provider) => visibleProviderTypes.has(provider.providerType)))
}

export function getProviderPreset(providerType: string) {
  return providerPresets.find((preset) => preset.providerType === providerType) ?? providerPresets[0]
}

export function getDefaultProviderBaseUrl(providerType: string) {
  return getProviderPreset(providerType).baseUrl
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
