import { createModel } from "@/electron/app/models/providers/model"
import type { ProviderPreset } from "@/types/agent"

export const openaiProvider: ProviderPreset = {
  providerType: "openai",
  title: "OpenAI",
  description: "OpenAI flagship models.",
  baseUrl: "https://api.openai.com/v1",
  docsUrl: "https://developers.openai.com/api/reference/overview",
  models: [
    createModel(
      "gpt-5",
      "GPT-5",
      false,
      ["toolcalling", "vision", "structuredOutput"],
      ["messages", "responses", "completions"],
      400000,
      128000,
      true,
      true,
    ),
    createModel(
      "gpt-5-mini",
      "GPT-5 Mini",
      false,
      ["toolcalling", "vision", "structuredOutput"],
      ["messages", "responses", "completions"],
      400000,
      128000,
      true,
      true,
    ),
    createModel(
      "gpt-4.1",
      "GPT-4.1",
      false,
      ["toolcalling", "vision", "structuredOutput"],
      ["messages", "responses", "completions"],
      1047576,
      32768,
      true,
    ),
  ],
}
