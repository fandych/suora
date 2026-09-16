import { createModel } from "@/electron/app/models/providers/model"
import type { ProviderPreset } from "@/types/agent"

export const kimiProvider: ProviderPreset = {
  providerType: "kimi",
  title: "Kimi",
  description: "Moonshot Kimi models.",
  baseUrl: "https://api.moonshot.cn/v1",
  docsUrl: "https://platform.kimi.com/docs/api/chat",
  models: [
    createModel(
      "kimi-k2-0905-preview",
      "Kimi K2",
      false,
      ["toolcalling", "vision"],
      ["messages", "responses"],
      262144,
      65536,
      true,
      true,
    ),
    createModel(
      "moonshot-v1-128k",
      "Moonshot V1 128K",
      false,
      ["toolcalling", "vision"],
      ["messages", "responses"],
      131072,
      16384,
      true,
    ),
  ],
}
