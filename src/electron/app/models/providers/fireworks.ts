import { createProvider } from "@/electron/app/models/providers/model"
export const fireworksProvider = createProvider(
  "fireworks",
  "Fireworks",
  "Fireworks AI's official inference gateway.",
  "https://api.fireworks.ai/inference/v1",
  "https://docs.fireworks.ai/",
)
