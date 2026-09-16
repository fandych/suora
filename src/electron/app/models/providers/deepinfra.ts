import { createProvider } from "@/electron/app/models/providers/model"
export const deepinfraProvider = createProvider(
  "deepinfra",
  "DeepInfra",
  "DeepInfra OpenAI-compatible inference endpoint.",
  "https://api.deepinfra.com/v1/openai",
  "https://docs.deepinfra.com/chat/overview",
)
