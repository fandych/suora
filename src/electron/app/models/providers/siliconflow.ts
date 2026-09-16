import { createProvider } from "@/electron/app/models/providers/model"
export const siliconflowProvider = createProvider(
  "siliconflow",
  "SiliconFlow",
  "SiliconFlow's official inference gateway. Use Refresh models to pull the current remote catalog.",
  "https://api.siliconflow.com/v1",
  "https://docs.siliconflow.com/en/api-reference/chat-completions/chat-completions",
)
