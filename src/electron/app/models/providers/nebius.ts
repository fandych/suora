import { createProvider } from "@/electron/app/models/providers/model"
export const nebiusProvider = createProvider(
  "nebius",
  "Nebius AI Studio",
  "Nebius AI Studio OpenAI-compatible endpoint.",
  "https://api.tokenfactory.nebius.com/v1/",
  "https://docs.nebius.com/",
)
