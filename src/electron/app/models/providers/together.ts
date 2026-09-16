import { createProvider } from "@/electron/app/models/providers/model"
export const togetherProvider = createProvider(
  "together",
  "Together",
  "Together AI's official serverless inference endpoint.",
  "https://api.together.ai/v1",
  "https://docs.together.ai/reference/chat-completions-1",
)
