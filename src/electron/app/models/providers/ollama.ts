import { createModel } from "@/electron/app/models/providers/model"
import type { ProviderPreset } from "@/types/agent"

export const ollamaProvider: ProviderPreset = {
  providerType: "ollama",
  title: "Ollama",
  description: "Popular current Ollama library entries.",
  baseUrl: "http://localhost:11434/v1",
  docsUrl: "https://ollama.com/blog/openai-compatibility",
  models: [
    createModel(
      "qwen3",
      "Qwen 3",
      false,
      ["toolcalling", "vision"],
      ["messages", "responses", "completions"],
      128000,
      32768,
      false,
      true,
    ),
    createModel(
      "gemma3",
      "Gemma 3",
      false,
      ["toolcalling", "vision"],
      ["messages", "responses", "completions"],
      128000,
      32768,
      false,
      true,
    ),
    createModel(
      "llama3.3",
      "Llama 3.3",
      false,
      ["toolcalling"],
      ["messages", "responses", "completions"],
      128000,
      8192,
    ),
  ],
}
