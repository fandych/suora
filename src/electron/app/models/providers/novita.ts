import { createProvider } from "@/electron/app/models/providers/model"
export const novitaProvider = createProvider(
  "novita",
  "Novita",
  "Novita AI OpenAI-compatible gateway.",
  "https://api.novita.ai/v3/openai",
  "https://docs.novita.ai/api-reference",
)
