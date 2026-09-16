import { createModel } from "@/electron/app/models/providers/model"
import type { ProviderPreset } from "@/types/agent"

export const anthropicProvider: ProviderPreset = {
  providerType: "anthropic",
  title: "Anthropic",
  description: "Current Claude family.",
  baseUrl: "https://api.anthropic.com/v1",
  docsUrl: "https://docs.anthropic.com/en/api/messages",
  models: [
    createModel(
      "claude-opus-4-1",
      "Claude Opus 4.1",
      false,
      ["toolcalling", "vision", "structuredOutput"],
      ["messages"],
      200000,
      64000,
      true,
      true,
    ),
    createModel(
      "claude-sonnet-4",
      "Claude Sonnet 4",
      false,
      ["toolcalling", "vision", "structuredOutput"],
      ["messages"],
      200000,
      64000,
      true,
      true,
    ),
    createModel(
      "claude-3-5-haiku-latest",
      "Claude 3.5 Haiku",
      false,
      ["toolcalling", "vision"],
      ["messages"],
      200000,
      8192,
      true,
    ),
  ],
}
