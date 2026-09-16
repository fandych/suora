import { createModel } from "@/electron/app/models/providers/model"
import type { ProviderPreset } from "@/types/agent"

export const deepseekProvider: ProviderPreset = {
  providerType: "deepseek",
  title: "DeepSeek",
  description: "DeepSeek official API models.",
  baseUrl: "https://api.deepseek.com",
  docsUrl: "https://api-docs.deepseek.com/",
  models: [
    createModel(
      "deepseek-chat",
      "DeepSeek Chat",
      false,
      ["toolcalling", "structuredOutput"],
      ["messages", "responses", "completions"],
      128000,
      8192,
      true,
      true,
    ),
    createModel(
      "deepseek-reasoner",
      "DeepSeek Reasoner",
      false,
      ["toolcalling", "structuredOutput"],
      ["messages", "responses", "completions"],
      128000,
      8192,
      true,
      true,
    ),
  ],
}
