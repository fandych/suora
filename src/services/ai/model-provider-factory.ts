import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import type { LanguageModel } from "ai"
import type { ChatRuntimeSettings } from "@/data/repositories/chat-settings-repository"
import { createAiProxyFetch } from "@/services/ai/network-client"

export function createChatLanguageModel(settings: ChatRuntimeSettings): LanguageModel {
  const providerFetch = createAiProxyFetch(settings)
  const sharedOptions = providerFetch ? { fetch: providerFetch } : {}
  switch (settings.model.providerType) {
    case "anthropic": return createAnthropic({ apiKey: settings.model.apiKey, ...(settings.model.baseUrl ? { baseURL: settings.model.baseUrl } : {}), ...sharedOptions })(settings.model.modelId)
    case "azure": return createOpenAI({ apiKey: settings.model.apiKey, baseURL: settings.model.baseUrl || "https://your-resource-name.openai.azure.com/openai/v1/", headers: { "api-key": settings.model.apiKey }, ...sharedOptions }).responses(settings.model.modelId)
    case "openai": return createOpenAI({ apiKey: settings.model.apiKey, ...(settings.model.baseUrl ? { baseURL: settings.model.baseUrl } : {}), ...sharedOptions })(settings.model.modelId)
    case "google": return createOpenAI({ apiKey: settings.model.apiKey, baseURL: settings.model.baseUrl || "https://generativelanguage.googleapis.com/v1beta/openai", ...sharedOptions })(settings.model.modelId)
    case "ollama": return createOpenAI({ apiKey: settings.model.apiKey || "ollama", baseURL: settings.model.baseUrl || "http://localhost:11434/v1", ...sharedOptions })(settings.model.modelId)
    default: return createOpenAICompatible({ name: settings.model.providerId, apiKey: settings.model.apiKey, baseURL: settings.model.baseUrl, headers: { "api-key": settings.model.apiKey }, ...sharedOptions })(settings.model.modelId)
  }
}
