import type { ProviderPreset } from "@/types/agent"

export function createModel(
  id: string,
  name: string,
  enabled = false,
  capabilities: ProviderPreset["models"][number]["capabilities"] = ["toolcalling"],
  apiModes: ProviderPreset["models"][number]["apiModes"] = ["messages"],
  contextWindow = 128000,
  maxOutputTokens = 16384,
  supportsParallelToolCalls = false,
  supportsReasoning = false,
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

export function createProvider(
  providerType: string,
  title: string,
  description: string,
  baseUrl: string,
  docsUrl: string,
): ProviderPreset {
  return { providerType, title, description, baseUrl, docsUrl, models: [] }
}
