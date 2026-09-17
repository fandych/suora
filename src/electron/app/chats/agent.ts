import { ToolLoopAgent, stepCountIs, tool } from "ai"
import { z } from "zod"
import type { WebContents } from "electron"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { getChat, appendChatMessage } from "@/electron/app/chats/repository"
import type { ChatRuntimeSettingsPayload } from "@/types/electron"
import fs from "node:fs/promises"
import path from "node:path"
import { ensureWorkspace } from "@/electron/infrastructure/workspace-service"
import { resolveWorkspaceTarget, enforceRelativePathPolicy } from "@/electron/app/tools/tool-policy"
import { agentService } from "@/electron/app/agents/service"
import { modelService } from "@/electron/app/models/service"
import { normalizeChatAgentMaxSteps } from "@/electron/app/chats/chat-agent-loop-policy"
import { classifyChatRuntimeError } from "@/electron/app/chats/chat-runtime-error-classifier"
import { configuredFetch } from "@/electron/infrastructure/http-client"

type RuntimeEvent = { requestId: string; chatId: string; type: string; [key: string]: unknown }

function emit(target: WebContents, payload: RuntimeEvent) {
  if (!target.isDestroyed()) target.send("chat-runtime-listener", payload)
}

function createModel(settings: ChatRuntimeSettingsPayload) {
  const options = {
    apiKey: settings.model.apiKey,
    ...(settings.model.baseUrl ? { baseURL: settings.model.baseUrl } : {}),
    fetch: configuredFetch,
  }
  switch (settings.model.providerType) {
    case "anthropic":
      return createAnthropic(options)(settings.model.modelId)
    case "azure":
      return createOpenAI({
        ...options,
        baseURL: settings.model.baseUrl || "https://your-resource-name.openai.azure.com/openai/v1/",
        headers: { "api-key": settings.model.apiKey },
      }).responses(settings.model.modelId)
    case "google":
      return createOpenAI({
        ...options,
        baseURL: settings.model.baseUrl || "https://generativelanguage.googleapis.com/v1beta/openai",
      })(settings.model.modelId)
    case "ollama":
      return createOpenAI({
        ...options,
        apiKey: settings.model.apiKey || "ollama",
        baseURL: settings.model.baseUrl || "http://localhost:11434/v1",
      })(settings.model.modelId)
    case "openai":
      return createOpenAI(options)(settings.model.modelId)
    default:
      return createOpenAICompatible({
        ...options,
        name: settings.model.providerId,
        headers: { "api-key": settings.model.apiKey },
      })(settings.model.modelId)
  }
}

async function resolveRuntimeSettings(settings: ChatRuntimeSettingsPayload, selectedAgentId?: string) {
  if (!selectedAgentId) return settings
  const payload = await agentService.get(selectedAgentId)
  const config = payload.agent
    ? (JSON.parse(payload.versions[0]?.configJson ?? "{}") as {
        providerId?: string
        modelId?: string
        maxSteps?: number
      })
    : {}
  if (!config.providerId || !config.modelId) return settings
  const provider = await modelService.get(config.providerId)
  const model = provider?.models.find((item) => item.id === config.modelId)
  if (!provider || !model) return settings
  return {
    ...settings,
    maxSteps: config.maxSteps ?? settings.maxSteps,
    model: {
      ...settings.model,
      providerId: provider.id,
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      modelId: model.id,
    },
  }
}

export async function runChatAgent(
  target: WebContents,
  command: {
    requestId: string
    chatId: string
    settings: ChatRuntimeSettingsPayload
    selectedAgentId?: string
    abortSignal?: AbortSignal
  },
) {
  await ensureWorkspace()
  const history = await getChat(command.chatId)
  const settings = await resolveRuntimeSettings(command.settings, command.selectedAgentId)
  const agent = new ToolLoopAgent({
    model: createModel(settings),
    instructions:
      settings.model.systemPrompt ||
      "You are a helpful workspace assistant. Use workspace tools when they help answer grounded questions.",
    stopWhen: stepCountIs(normalizeChatAgentMaxSteps(settings.maxSteps)),
    tools: {
      listFiles: tool({
        description: "List workspace files.",
        inputSchema: z.object({ path: z.string().optional() }),
        execute: async ({ path: relativePath }) => {
          const target = resolveWorkspaceTarget(relativePath)
          enforceRelativePathPolicy(relativePath, target)
          const entries = await fs.readdir(target, { withFileTypes: true })
          return entries.map((entry) => ({
            name: entry.name,
            path: path.relative(resolveWorkspaceTarget(), path.join(target, entry.name)).replace(/\\/g, "/"),
            type: entry.isDirectory() ? "directory" : "file",
          }))
        },
      }),
    },
  })
  try {
    const result = await agent.stream({
      messages: history.messages.map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      })),
      abortSignal: command.abortSignal,
    })
    let text = ""
    const parts: Array<Record<string, unknown>> = []
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        text += part.text
        const lastPart = parts.at(-1)
        if (lastPart?.type === "text") lastPart.content = `${lastPart.content ?? ""}${part.text}`
        else
          parts.push({ id: `assistant-text-${parts.length + 1}`, type: "text", content: part.text, isPending: false })
        emit(target, { requestId: command.requestId, chatId: command.chatId, type: "text-delta", text: part.text })
      } else if (part.type === "tool-call") {
        parts.push({
          id: part.toolCallId,
          type: "tool",
          activity: { id: part.toolCallId, toolName: part.toolName, input: part.input },
        })
        emit(target, {
          requestId: command.requestId,
          chatId: command.chatId,
          type: "tool-call",
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.input,
        })
      } else if (part.type === "tool-result") {
        const output = JSON.stringify(part.output)
        const toolPart = parts.find((item) => item.id === part.toolCallId)
        if (toolPart && typeof toolPart.activity === "object" && toolPart.activity)
          toolPart.activity = { ...(toolPart.activity as Record<string, unknown>), output }
        emit(target, {
          requestId: command.requestId,
          chatId: command.chatId,
          type: "tool-result",
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          output,
        })
      } else if (part.type === "error") throw part.error instanceof Error ? part.error : new Error(String(part.error))
    }
    if (command.abortSignal?.aborted) {
      emit(target, { requestId: command.requestId, chatId: command.chatId, type: "cancelled" })
      return
    }
    await appendChatMessage({ chatId: command.chatId, content: text, parts }, "assistant")
    const detail = await getChat(command.chatId)
    emit(target, { requestId: command.requestId, chatId: command.chatId, type: "completed", detail })
  } catch (error) {
    if (command.abortSignal?.aborted) {
      emit(target, { requestId: command.requestId, chatId: command.chatId, type: "cancelled" })
      return
    }
    emit(target, {
      requestId: command.requestId,
      chatId: command.chatId,
      type: "error",
      error: error instanceof Error ? error.message : String(error),
      errorKind: classifyChatRuntimeError(error),
    })
  }
}
