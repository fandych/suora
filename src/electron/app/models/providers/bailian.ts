import { createModel } from "@/electron/app/models/providers/model"
import type { ProviderPreset } from "@/types/agent"

export const bailianProvider: ProviderPreset = {
  providerType: "bailian",
  title: "Bailian",
  description: "Alibaba Bailian defaults.",
  baseUrl: "https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
  docsUrl: "https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope",
  models: [
    createModel(
      "qwen-max",
      "Qwen Max",
      false,
      ["toolcalling", "vision", "structuredOutput"],
      ["messages", "responses"],
      131072,
      8192,
      true,
      true,
    ),
    createModel(
      "qwen-plus",
      "Qwen Plus",
      false,
      ["toolcalling", "vision", "structuredOutput"],
      ["messages", "responses"],
      131072,
      8192,
      true,
    ),
    createModel(
      "qwen-turbo",
      "Qwen Turbo",
      false,
      ["toolcalling", "vision"],
      ["messages", "responses"],
      131072,
      8192,
      true,
    ),
  ],
}
