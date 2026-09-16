import { createProvider } from "@/electron/app/models/providers/model"
export const hyperbolicProvider = createProvider(
  "hyperbolic",
  "Hyperbolic",
  "Hyperbolic OpenAI-compatible inference gateway.",
  "https://api.hyperbolic.xyz/v1",
  "https://hyperbolic.xyz/docs",
)
