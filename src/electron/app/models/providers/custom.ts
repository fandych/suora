import { createModel } from "@/electron/app/models/providers/model"
import type { ProviderPreset } from "@/types/agent"

export const customProvider: ProviderPreset = {
  providerType: "custom",
  title: "Custom",
  description: "Bring your own endpoint and define arbitrary model metadata.",
  baseUrl: "",
  docsUrl: "",
  models: [createModel("custom-model", "Custom Model")],
}
