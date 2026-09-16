import { createModel } from "@/electron/app/models/providers/model"
import type { ProviderPreset } from "@/types/agent"

export const perplexityProvider: ProviderPreset = {
  providerType: "perplexity",
  title: "Perplexity",
  description: "Perplexity's official Sonar API.",
  baseUrl: "https://api.perplexity.ai",
  docsUrl: "https://docs.perplexity.ai/api-reference/chat-completions-post",
  models: [
    createModel(
      "sonar-pro",
      "Sonar Pro",
      false,
      ["toolcalling"],
      ["messages", "completions"],
      128000,
      8192,
      false,
      true,
    ),
    createModel("sonar", "Sonar", false, ["toolcalling"], ["messages", "completions"], 128000, 8192),
  ],
}
