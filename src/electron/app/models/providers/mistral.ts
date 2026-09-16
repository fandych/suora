import { createModel } from "@/electron/app/models/providers/model"
import type { ProviderPreset } from "@/types/agent"

export const mistralProvider: ProviderPreset = {
  providerType: "mistral",
  title: "Mistral",
  description: "Mistral AI official platform API.",
  baseUrl: "https://api.mistral.ai/v1",
  docsUrl: "https://docs.mistral.ai/api/",
  models: [
    createModel(
      "mistral-large-latest",
      "Mistral Large",
      false,
      ["toolcalling", "structuredOutput"],
      ["messages", "responses"],
      131072,
      32768,
      true,
      true,
    ),
    createModel(
      "pixtral-large-latest",
      "Pixtral Large",
      false,
      ["toolcalling", "vision"],
      ["messages", "responses"],
      131072,
      32768,
      true,
    ),
  ],
}
