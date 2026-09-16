import { createProvider } from "@/electron/app/models/providers/model"
export const sambanovaProvider = createProvider(
  "sambanova",
  "SambaNova",
  "SambaNova Cloud OpenAI-compatible inference endpoint.",
  "https://api.sambanova.ai/v1",
  "https://docs.sambanova.ai/cloud/docs/get-started/quickstart",
)
