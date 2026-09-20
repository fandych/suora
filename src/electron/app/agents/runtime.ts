import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { agentService } from "@/electron/app/agents/service"
import { modelService } from "@/electron/app/models/service"
import { configuredFetch } from "@/electron/infrastructure/http-client"

function parseAgentConfig(configJson?: string) {
  try {
    return JSON.parse(configJson ?? "{}") as {
      instructions?: string
      providerId?: string
      modelId?: string
    }
  } catch {
    throw new Error("Scheduled agent configuration is corrupted and could not be parsed.")
  }
}

export async function invokeAgent(agentId: string, prompt: string, abortSignal?: AbortSignal) {
  const detail = await agentService.get(agentId)
  if (!detail.agent) throw new Error("Scheduled agent was not found.")
  if (detail.agent.isDisabled) throw new Error("Scheduled agent is disabled.")
  const config = parseAgentConfig(detail.versions[0]?.configJson)
  if (!config.providerId || !config.modelId) throw new Error("Scheduled agent has no configured model.")
  const provider = await modelService.get(config.providerId)
  if (!provider || !provider.enabled) throw new Error("Scheduled agent provider is unavailable.")
  const model = provider.models.find((item) => item.id === config.modelId)
  if (!model?.enabled) throw new Error("Scheduled agent model is unavailable.")
  const result = await generateText({
    model: createOpenAI({ apiKey: provider.apiKey, baseURL: provider.baseUrl || undefined, fetch: configuredFetch })(model.id),
    system: config.instructions,
    prompt,
    abortSignal,
  })
  return result.text
}