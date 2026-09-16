import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { chatApplicationService } from "@/electron/app/chats/service"
import { configuredFetch } from "@/electron/infrastructure/http-client"

export async function runWorkflowAgent(
  input: { prompt: string; systemPrompt?: string; modelId?: string; selectedAgentId?: string },
  abortSignal?: AbortSignal,
) {
  const settings = await chatApplicationService.getSessionSettings(null)
  const model = createOpenAI({
    apiKey: settings.runtime.model.apiKey,
    baseURL: settings.runtime.model.baseUrl || undefined,
    fetch: configuredFetch,
  })(input.modelId || settings.runtime.model.modelId)
  const result = await generateText({ model, system: input.systemPrompt, prompt: input.prompt, abortSignal })
  return result.text
}
