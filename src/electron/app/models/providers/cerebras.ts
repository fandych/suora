import { createProvider } from "@/electron/app/models/providers/model"
export const cerebrasProvider = createProvider(
  "cerebras",
  "Cerebras",
  "Cerebras Inference OpenAI-compatible API.",
  "https://api.cerebras.ai/v1",
  "https://inference-docs.cerebras.ai/api-reference",
)
