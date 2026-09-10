import { describe, expect, it, vi } from "vitest"

vi.mock("@ai-sdk/anthropic", () => ({ createAnthropic: vi.fn((options) => (model: string) => ({ provider: "anthropic", model, options })) }))
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: vi.fn((options) => { const factory = (model: string) => ({ provider: "openai", model, options }); factory.responses = (model: string) => ({ provider: "azure", model, options }); return factory }) }))
vi.mock("@ai-sdk/openai-compatible", () => ({ createOpenAICompatible: vi.fn((options) => (model: string) => ({ provider: "compatible", model, options })) }))
vi.mock("@/services/ai/network-client", () => ({ createAiProxyFetch: vi.fn(() => undefined) }))

import { createChatLanguageModel } from "@/services/ai/model-provider-factory"

const settings = (providerType: string) => ({ model: { providerId: "provider-1", providerType, modelId: "model-1", baseUrl: "https://api.example.com", apiKey: "secret" }, requestTimeoutMs: 1000 }) as never

describe("AI provider factory", () => {
  it("selects provider adapters", () => {
    expect(createChatLanguageModel(settings("anthropic"))).toMatchObject({ provider: "anthropic" })
    expect(createChatLanguageModel(settings("openai"))).toMatchObject({ provider: "openai" })
    expect(createChatLanguageModel(settings("azure"))).toMatchObject({ provider: "azure" })
    expect(createChatLanguageModel(settings("custom"))).toMatchObject({ provider: "compatible" })
  })
})
