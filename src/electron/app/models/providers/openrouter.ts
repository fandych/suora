import { createModel } from "@/electron/app/models/providers/model"
import type { ProviderPreset } from "@/types/agent"

export const openrouterProvider: ProviderPreset = {
  providerType: "openrouter",
  title: "OpenRouter",
  description: "OpenRouter cross-provider routes.",
  baseUrl: "https://openrouter.ai/api/v1",
  docsUrl: "https://openrouter.ai/docs/api-reference/overview",
  models: [
    createModel(
      "openai/gpt-5",
      "OpenAI / GPT-5",
      false,
      ["toolcalling", "vision", "structuredOutput"],
      ["messages", "responses", "completions"],
      400000,
      128000,
      true,
      true,
    ),
    createModel(
      "anthropic/claude-sonnet-4",
      "Anthropic / Claude Sonnet 4",
      false,
      ["toolcalling", "vision", "structuredOutput"],
      ["messages"],
      200000,
      64000,
      true,
      true,
    ),
    createModel(
      "google/gemini-2.5-pro",
      "Google / Gemini 2.5 Pro",
      false,
      ["toolcalling", "vision", "structuredOutput"],
      ["messages", "responses"],
      1048576,
      65536,
      true,
      true,
    ),
  ],
}
