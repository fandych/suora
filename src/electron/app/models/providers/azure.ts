import { createModel } from "@/electron/app/models/providers/model"
import type { ProviderPreset } from "@/types/agent"

export const azureProvider: ProviderPreset = {
  providerType: "azure",
  title: "Azure",
  description: "Azure OpenAI v1 endpoint for model deployments.",
  baseUrl: "https://your-resource-name.openai.azure.com/openai/v1/",
  docsUrl: "https://learn.microsoft.com/en-us/azure/ai-services/openai/api-version-deprecation",
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
