import { createModel } from "@/electron/app/models/providers/model"
import type { ProviderPreset } from "@/types/agent"

export const googleProvider: ProviderPreset = {
  providerType: "google",
  title: "Google Gemini",
  description: "Gemini via Google's official Generative Language OpenAI-compatible endpoint.",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
  docsUrl: "https://ai.google.dev/gemini-api/docs/openai",
  models: [
    createModel(
      "gemini-2.5-pro",
      "Gemini 2.5 Pro",
      false,
      ["toolcalling", "vision", "structuredOutput"],
      ["messages", "responses"],
      1048576,
      65536,
      true,
      true,
    ),
    createModel(
      "gemini-2.5-flash",
      "Gemini 2.5 Flash",
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
