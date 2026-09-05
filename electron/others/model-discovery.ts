import type { ProviderConfigRecord, ProviderModelCapability, ProviderModelRecord } from "@/data/domain/models"

type DiscoverProviderModelsPayload = Pick<ProviderConfigRecord, "providerType" | "baseUrl" | "apiKey">

type DiscoverProviderModelsResult = {
  models: ProviderModelRecord[]
  source: string
}

const OPENAI_COMPATIBLE_PROVIDERS = new Set([
  "openai",
  "deepseek",
  "bailian",
  "kimi",
  "siliconflow",
  "volcengine",
  "zhipu",
  "minimax",
  "stepfun",
  "openrouter",
  "groq",
  "xai",
  "mistral",
  "perplexity",
  "together",
  "fireworks",
  "custom",
])

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "")
}

function resolveOllamaBaseUrl(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl || "http://localhost:11434/v1")
  return normalized.endsWith("/v1") ? normalized.slice(0, -3) : normalized
}

function inferCapabilities(model: Record<string, unknown>): ProviderModelCapability[] {
  const modalities = [
    ...(Array.isArray(model.input_modalities) ? model.input_modalities : []),
    ...(Array.isArray((model.architecture as { input_modalities?: unknown[] } | undefined)?.input_modalities)
      ? ((model.architecture as { input_modalities?: unknown[] }).input_modalities ?? [])
      : []),
  ].map((item) => String(item).toLowerCase())
  const supportedParameters = Array.isArray(model.supported_parameters)
    ? model.supported_parameters.map((item) => String(item).toLowerCase())
    : []
  const capabilities = new Set<ProviderModelCapability>()

  if (modalities.includes("image") || modalities.includes("vision")) {
    capabilities.add("vision")
  }
  if (supportedParameters.includes("response_format") || supportedParameters.includes("json_schema")) {
    capabilities.add("structuredOutput")
  }
  if (supportedParameters.includes("tools") || supportedParameters.includes("tool_choice") || supportedParameters.includes("function_calling") || supportedParameters.length === 0) {
    capabilities.add("toolcalling")
  }

  return capabilities.size > 0 ? [...capabilities] : ["toolcalling"]
}

function normalizeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback
}

function inferContextWindow(model: Record<string, unknown>) {
  return normalizeNumber(
    model.context_length
      ?? model.context_window
      ?? (model.top_provider as { context_length?: unknown } | undefined)?.context_length
      ?? (model.architecture as { context_length?: unknown } | undefined)?.context_length,
    128000
  )
}

function inferMaxOutputTokens(model: Record<string, unknown>) {
  return normalizeNumber(
    model.max_completion_tokens
      ?? model.max_output_tokens
      ?? model.max_tokens
      ?? (model.top_provider as { max_completion_tokens?: unknown } | undefined)?.max_completion_tokens,
    8192
  )
}

function normalizeOpenAiCompatibleModels(data: unknown) {
  const rows = Array.isArray((data as { data?: unknown[] } | undefined)?.data)
    ? ((data as { data: unknown[] }).data)
    : []

  return rows
    .map((row) => row as Record<string, unknown>)
    .filter((row) => typeof row.id === "string" && row.id.trim().length > 0)
    .map((row) => ({
      id: String(row.id),
      name: typeof row.name === "string" && row.name.trim() ? row.name : typeof row.display_name === "string" && row.display_name.trim() ? row.display_name : String(row.id),
      enabled: false,
      capabilities: inferCapabilities(row),
      apiModes: ["messages", "completions", "responses"] as const,
      contextWindow: inferContextWindow(row),
      maxOutputTokens: inferMaxOutputTokens(row),
      supportsParallelToolCalls: true,
      supportsReasoning: /reason|thinking|grok|r1|o1|o3|o4|claude|gpt-5|gemini|glm-4\.5/i.test(String(row.id)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

function normalizeOllamaModels(data: unknown) {
  const rows = Array.isArray((data as { models?: unknown[] } | undefined)?.models)
    ? ((data as { models: unknown[] }).models)
    : []

  return rows
    .map((row) => row as Record<string, unknown>)
    .filter((row) => typeof row.name === "string" && row.name.trim().length > 0)
    .map((row) => ({
      id: String(row.model || row.name),
      name: String(row.name),
      enabled: false,
      capabilities: /vision|vl|llava|minicpm-v|pixtral/i.test(String(row.name)) ? (["toolcalling", "vision"] as const) : (["toolcalling"] as const),
      apiModes: ["messages", "completions", "responses"] as const,
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsParallelToolCalls: false,
      supportsReasoning: /reason|thinking|r1/i.test(String(row.name)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

async function requestJson(url: string, init: RequestInit) {
  const response = await fetch(url, init)
  const text = await response.text()
  let data: unknown

  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!response.ok) {
    const message = typeof data === "object" && data && "error" in data
      ? String((data as { error?: unknown }).error)
      : typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message)
        : `${response.status} ${response.statusText}`
    throw new Error(message)
  }

  return data
}

export async function discoverProviderModels(payload: DiscoverProviderModelsPayload): Promise<DiscoverProviderModelsResult> {
  if (payload.providerType === "ollama") {
    const baseUrl = resolveOllamaBaseUrl(payload.baseUrl)
    const source = `${baseUrl}/api/tags`
    const data = await requestJson(source, { method: "GET" })
    return { models: normalizeOllamaModels(data), source }
  }

  if (payload.providerType === "azure") {
    throw new Error("Azure OpenAI deployment discovery is not exposed through a stable `/models` endpoint here.")
  }

  if (payload.providerType === "anthropic") {
    throw new Error("Anthropic model discovery is not exposed through the current workspace adapter.")
  }

  if (payload.providerType === "vercel") {
    throw new Error("Vercel AI Gateway does not expose a stable public model catalog endpoint in this workspace.")
  }

  if (payload.providerType === "google") {
    throw new Error("Gemini model discovery is not wired through the OpenAI-compatible bridge yet.")
  }

  if (!OPENAI_COMPATIBLE_PROVIDERS.has(payload.providerType)) {
    throw new Error(`Model discovery is not supported for provider type: ${payload.providerType}`)
  }

  const baseUrl = normalizeBaseUrl(payload.baseUrl)
  if (!baseUrl) {
    throw new Error("A base URL is required before refreshing the remote model catalog.")
  }

  const source = `${baseUrl}/models`
  const headers: Record<string, string> = { Accept: "application/json" }
  if (payload.apiKey.trim()) {
    headers.Authorization = `Bearer ${payload.apiKey.trim()}`
  }

  const data = await requestJson(source, {
    method: "GET",
    headers,
  })

  return { models: normalizeOpenAiCompatibleModels(data), source }
}