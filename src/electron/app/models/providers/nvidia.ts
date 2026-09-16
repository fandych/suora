import { createProvider } from "@/electron/app/models/providers/model"
export const nvidiaProvider = createProvider(
  "nvidia",
  "NVIDIA NIM",
  "NVIDIA hosted inference API for compatible chat models.",
  "https://integrate.api.nvidia.com/v1",
  "https://docs.api.nvidia.com/nim/reference/openai-chat-completions",
)
