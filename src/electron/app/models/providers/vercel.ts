import { createModel } from "@/electron/app/models/providers/model"
import type { ProviderPreset } from "@/types/agent"

export const vercelProvider: ProviderPreset = {
  providerType: "vercel",
  title: "Vercel",
  description: "Vercel AI Gateway defaults.",
  baseUrl: "https://ai-gateway.vercel.sh/v1",
  docsUrl: "https://vercel.com/docs/ai-gateway",
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
  ],
}
