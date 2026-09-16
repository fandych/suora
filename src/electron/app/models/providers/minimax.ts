import { createProvider } from "@/electron/app/models/providers/model"
export const minimaxProvider = createProvider(
  "minimax",
  "MiniMax",
  "MiniMax official model platform. Use Refresh models to sync the current provider catalog.",
  "https://api.minimax.chat/v1",
  "https://platform.minimaxi.com/document/Guides/API%20Platform%20Overview",
)
