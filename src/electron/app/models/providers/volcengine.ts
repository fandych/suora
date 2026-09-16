import { createProvider } from "@/electron/app/models/providers/model"
export const volcengineProvider = createProvider(
  "volcengine",
  "Volcengine Ark",
  "Volcengine Ark's official inference gateway for model endpoints and managed routes.",
  "https://ark.cn-beijing.volces.com/api/v3",
  "https://docs.volcengine.com/docs/82379/1541594",
)
