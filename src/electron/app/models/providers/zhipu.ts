import { createModel } from "@/electron/app/models/providers/model"
import type { ProviderPreset } from "@/types/agent"

export const zhipuProvider: ProviderPreset = {
  providerType: "zhipu",
  title: "Zhipu",
  description: "Zhipu BigModel official GLM endpoint for chat, reasoning, and multimodal models.",
  baseUrl: "https://open.bigmodel.cn/api/",
  docsUrl: "https://docs.bigmodel.cn/api-reference/%E6%A8%A1%E5%9E%8B-api/%E5%AF%B9%E8%AF%9D%E8%A1%A5%E5%85%A8",
  models: [
    createModel(
      "glm-4.5",
      "GLM 4.5",
      false,
      ["toolcalling", "vision", "structuredOutput"],
      ["messages", "responses"],
      128000,
      16384,
      true,
      true,
    ),
    createModel(
      "glm-4.5-air",
      "GLM 4.5 Air",
      false,
      ["toolcalling", "structuredOutput"],
      ["messages", "responses"],
      128000,
      16384,
      true,
      true,
    ),
  ],
}
