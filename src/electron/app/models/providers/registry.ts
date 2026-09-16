import type { ProviderPreset } from "@/types/agent"
import { anthropicProvider } from "@/electron/app/models/providers/anthropic"
import { azureProvider } from "@/electron/app/models/providers/azure"
import { bailianProvider } from "@/electron/app/models/providers/bailian"
import { cerebrasProvider } from "@/electron/app/models/providers/cerebras"
import { customProvider } from "@/electron/app/models/providers/custom"
import { deepinfraProvider } from "@/electron/app/models/providers/deepinfra"
import { deepseekProvider } from "@/electron/app/models/providers/deepseek"
import { fireworksProvider } from "@/electron/app/models/providers/fireworks"
import { githubProvider } from "@/electron/app/models/providers/github"
import { googleProvider } from "@/electron/app/models/providers/google"
import { groqProvider } from "@/electron/app/models/providers/groq"
import { hyperbolicProvider } from "@/electron/app/models/providers/hyperbolic"
import { kimiProvider } from "@/electron/app/models/providers/kimi"
import { minimaxProvider } from "@/electron/app/models/providers/minimax"
import { mistralProvider } from "@/electron/app/models/providers/mistral"
import { nebiusProvider } from "@/electron/app/models/providers/nebius"
import { nvidiaProvider } from "@/electron/app/models/providers/nvidia"
import { novitaProvider } from "@/electron/app/models/providers/novita"
import { ollamaProvider } from "@/electron/app/models/providers/ollama"
import { openaiProvider } from "@/electron/app/models/providers/openai"
import { openrouterProvider } from "@/electron/app/models/providers/openrouter"
import { perplexityProvider } from "@/electron/app/models/providers/perplexity"
import { sambanovaProvider } from "@/electron/app/models/providers/sambanova"
import { siliconflowProvider } from "@/electron/app/models/providers/siliconflow"
import { stepfunProvider } from "@/electron/app/models/providers/stepfun"
import { togetherProvider } from "@/electron/app/models/providers/together"
import { vercelProvider } from "@/electron/app/models/providers/vercel"
import { volcengineProvider } from "@/electron/app/models/providers/volcengine"
import { xaiProvider } from "@/electron/app/models/providers/xai"
import { zhipuProvider } from "@/electron/app/models/providers/zhipu"

export const defaultProviderTypes = [
  "openai",
  "azure",
  "google",
  "deepseek",
  "anthropic",
  "bailian",
  "kimi",
  "siliconflow",
  "volcengine",
  "zhipu",
  "minimax",
  "stepfun",
  "openrouter",
  "groq",
  "xai",
  "mistral",
  "perplexity",
  "together",
  "fireworks",
  "deepinfra",
  "sambanova",
  "cerebras",
  "nebius",
  "novita",
  "hyperbolic",
  "nvidia",
  "vercel",
  "ollama",
] as const

export const providerPresets: ProviderPreset[] = [
  openaiProvider,
  azureProvider,
  googleProvider,
  deepseekProvider,
  anthropicProvider,
  bailianProvider,
  kimiProvider,
  siliconflowProvider,
  volcengineProvider,
  zhipuProvider,
  minimaxProvider,
  stepfunProvider,
  openrouterProvider,
  groqProvider,
  xaiProvider,
  mistralProvider,
  perplexityProvider,
  togetherProvider,
  fireworksProvider,
  deepinfraProvider,
  sambanovaProvider,
  cerebrasProvider,
  nebiusProvider,
  novitaProvider,
  githubProvider,
  hyperbolicProvider,
  nvidiaProvider,
  vercelProvider,
  ollamaProvider,
  customProvider,
]

export function getProviderPreset(providerType: string): ProviderPreset {
  return providerPresets.find((preset) => preset.providerType === providerType) ?? providerPresets[0]
}
export function getDefaultProviderBaseUrl(providerType: string) {
  return getProviderPreset(providerType).baseUrl
}
export function providerAllowsNoKey(providerType: string) {
  return providerType === "ollama" || providerType === "custom" || providerType === "openrouter"
}
export function getProviderPresets() {
  return providerPresets
}
