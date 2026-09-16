import { createModel } from "@/electron/app/models/providers/model"
import type { ProviderPreset } from "@/types/agent"

export const xaiProvider: ProviderPreset = {
  providerType: "xai",
  title: "xAI",
  description: "xAI's official Grok API.",
  baseUrl: "https://api.x.ai/v1",
  docsUrl: "https://docs.x.ai/docs/api-reference",
  models: [
    createModel(
      "grok-4-0709",
      "Grok 4",
      false,
      ["toolcalling", "vision", "structuredOutput"],
      ["messages", "responses"],
      256000,
      65536,
      true,
      true,
    ),
    createModel(
      "grok-3-mini",
      "Grok 3 Mini",
      false,
      ["toolcalling", "structuredOutput"],
      ["messages", "responses"],
      128000,
      32768,
      true,
      true,
    ),
  ],
}
