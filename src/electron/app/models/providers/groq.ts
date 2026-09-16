import { createModel } from "@/electron/app/models/providers/model"
import type { ProviderPreset } from "@/types/agent"

export const groqProvider: ProviderPreset = {
  providerType: "groq",
  title: "Groq",
  description: "Groq's official low-latency inference API.",
  baseUrl: "https://api.groq.com/openai/v1",
  docsUrl: "https://console.groq.com/docs/api-reference",
  models: [
    createModel(
      "llama-3.3-70b-versatile",
      "Llama 3.3 70B Versatile",
      false,
      ["toolcalling"],
      ["messages", "completions"],
      131072,
      32768,
      true,
    ),
    createModel(
      "moonshotai/kimi-k2-instruct-0905",
      "Kimi K2 Instruct",
      false,
      ["toolcalling"],
      ["messages", "completions"],
      131072,
      32768,
      true,
      true,
    ),
  ],
}
