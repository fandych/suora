import { ToolLoopAgent, stepCountIs, tool, type LanguageModel, type ModelMessage, type UserModelMessage } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { z } from "zod"

import type { ChatMessageRecord } from "@/data/domain/models"
import type { ChatRuntimeSettings } from "@/data/repositories/chat-settings-repository"
import { listDocuments, getDocumentDetail } from "@/data/repositories/document-repository"
import { getIntegrationDetail } from "@/data/repositories/integration-repository"
import { executeIntegration } from "@/data/repositories/integration-execution-repository"
import { listSkills, getSkillDetail } from "@/data/repositories/skill-repository"
import { listWorkflows, getWorkflowDetail } from "@/data/repositories/workflow-repository"
import { createBuiltInTools, listScopedDocuments, listScopedSkills, listScopedWorkflows, mergeAgentInstructions, resolveAgentContext } from "@/services/ai-tools"

type AiFetchStartResult = {
  requestId?: string
}

type AiFetchEventPayload =
  | { requestId: string; type: "response"; status: number; statusText: string; headers: Record<string, string> }
  | { requestId: string; type: "data"; chunkBase64: string }
  | { requestId: string; type: "end" }
  | { requestId: string; type: "error"; error: string }

export type ChatAgentEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: Record<string, unknown> }
  | { type: "tool-result"; toolCallId: string; toolName: string; output: string }
  | { type: "error"; error: string }

export type ChatAttachment = {
  name: string
  mediaType: string
  data: string
  kind: "image" | "file"
}

function decodeBase64(base64: string) {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

function createAbortError() {
  return new DOMException("The operation was aborted.", "AbortError")
}

function createProxyFetch(): typeof fetch | undefined {
  const bridge = window.electron
  if (!bridge?.invoke || !bridge.on || !bridge.off) {
    return undefined
  }

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const headers = Object.fromEntries(request.headers.entries())
    const bodyText = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text()

    return new Promise<Response>((resolve, reject) => {
      let requestId: string | undefined
      let controller: ReadableStreamDefaultController<Uint8Array> | undefined
      let responseResolved = false

      const cleanup = () => {
        bridge.off?.("ai:fetch:event", handleEvent)
        request.signal.removeEventListener("abort", handleAbort)
      }

      const handleAbort = () => {
        if (requestId) {
          void bridge.invoke("ai:fetch:abort", requestId).catch(() => {})
        }
        cleanup()
        reject(createAbortError())
      }

      const stream = new ReadableStream<Uint8Array>({
        start(nextController) {
          controller = nextController
        },
        cancel() {
          if (requestId) {
            void bridge.invoke("ai:fetch:abort", requestId).catch(() => {})
          }
        },
      })

      const handleEvent = (...args: unknown[]) => {
        const payload = args[1] as AiFetchEventPayload | undefined
        if (!payload || !requestId || payload.requestId !== requestId) {
          return
        }

        switch (payload.type) {
          case "response":
            if (!responseResolved) {
              responseResolved = true
              resolve(new Response(stream, { status: payload.status, statusText: payload.statusText, headers: payload.headers }))
            }
            break
          case "data":
            controller?.enqueue(decodeBase64(payload.chunkBase64))
            break
          case "end":
            cleanup()
            controller?.close()
            break
          case "error":
            cleanup()
            if (!responseResolved) {
              reject(new Error(payload.error))
            } else {
              controller?.error(new Error(payload.error))
            }
            break
        }
      }

      bridge.on("ai:fetch:event", handleEvent)
      request.signal.addEventListener("abort", handleAbort, { once: true })

      void bridge.invoke("ai:fetch:start", {
        url: request.url,
        method: request.method,
        headers,
        bodyText,
        timeoutMs: 120000,
      }).then((result) => {
        requestId = (result as AiFetchStartResult).requestId
      }).catch((error) => {
        cleanup()
        reject(error instanceof Error ? error : new Error(String(error)))
      })
    })
  }
}

function createModel(settings: ChatRuntimeSettings): LanguageModel {
  const providerFetch = createProxyFetch()
  const sharedOptions = providerFetch ? { fetch: providerFetch } : {}

  switch (settings.model.providerType) {
    case "anthropic":
      return createAnthropic({
        apiKey: settings.model.apiKey,
        ...(settings.model.baseUrl ? { baseURL: settings.model.baseUrl } : {}),
        ...sharedOptions,
      })(settings.model.modelId)
    case "openai":
      return createOpenAI({
        apiKey: settings.model.apiKey,
        ...(settings.model.baseUrl ? { baseURL: settings.model.baseUrl } : {}),
        ...sharedOptions,
      })(settings.model.modelId)
    case "google":
      return createOpenAI({
        apiKey: settings.model.apiKey,
        baseURL: settings.model.baseUrl || "https://generativelanguage.googleapis.com/v1beta/openai",
        ...sharedOptions,
      })(settings.model.modelId)
    case "ollama":
      return createOpenAI({
        apiKey: settings.model.apiKey || "ollama",
        baseURL: settings.model.baseUrl || "http://localhost:11434/v1",
        ...sharedOptions,
      })(settings.model.modelId)
    case "openai-compatible":
    default:
      return createOpenAICompatible({
        name: settings.model.providerId,
        apiKey: settings.model.apiKey,
        baseURL: settings.model.baseUrl,
        ...sharedOptions,
      })(settings.model.modelId)
  }
}

function serializeToolOutput(output: unknown) {
  if (typeof output === "string") {
    return output
  }

  try {
    return JSON.stringify(output, null, 2)
  } catch {
    return String(output)
  }
}

async function createResearchSubagent(settings: ChatRuntimeSettings) {
  const model = createModel(settings)

  return new ToolLoopAgent({
    model,
    instructions: "You are a focused research subagent. Summarize only the relevant facts from the provided workspace tools.",
    stopWhen: stepCountIs(4),
    tools: {
      listDocuments: tool({
        description: "List available documents in the workspace.",
        inputSchema: z.object({}),
        execute: async () => (await listDocuments()).map((item) => ({ id: item.id, title: item.title, summary: item.summary })),
      }),
      listWorkflows: tool({
        description: "List available workflows in the workspace.",
        inputSchema: z.object({}),
        execute: async () => (await listWorkflows()).map((item) => ({ id: item.id, title: item.title, summary: item.summary })),
      }),
      listSkills: tool({
        description: "List available skills in the workspace.",
        inputSchema: z.object({}),
        execute: async () => (await listSkills()).map((item) => ({ id: item.id, title: item.title, summary: item.summary })),
      }),
    },
  })
}

export async function* streamChatAgentResponse(history: ChatMessageRecord[], settings: ChatRuntimeSettings, options?: { abortSignal?: AbortSignal; selectedAgentId?: string; attachments?: ChatAttachment[] }): AsyncGenerator<ChatAgentEvent> {
  const agentContext = await resolveAgentContext(options?.selectedAgentId)
  const effectiveSettings = agentContext?.detail
    ? {
        ...settings,
        model: {
          ...settings.model,
          providerId: agentContext.detail.config.providerId || settings.model.providerId,
          modelId: agentContext.detail.config.modelId || settings.model.modelId,
        },
      }
    : settings
  const model = createModel(effectiveSettings)
  const researchSubagent = await createResearchSubagent(settings)
  const builtInTools = await createBuiltInTools()

  const scopedSearchDocuments = agentContext?.documents?.filter(Boolean) ?? []
  const scopedSearchSkills = agentContext?.skills?.filter(Boolean) ?? []
  const scopedSearchWorkflows = agentContext?.workflows?.filter(Boolean) ?? []
  const scopedIntegrations = agentContext?.integrations?.filter(Boolean) ?? []

  const agent = new ToolLoopAgent({
    model,
    instructions: mergeAgentInstructions(effectiveSettings, agentContext?.detail ?? null),
    stopWhen: stepCountIs(6),
    tools: {
      ...builtInTools,
      searchDocuments: tool({
        description: "Find a document and inspect its content.",
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => {
          const documents = await listScopedDocuments(scopedSearchDocuments.length > 0, scopedSearchDocuments)
          const match = documents.find((item) => item.title.toLowerCase().includes(query.toLowerCase()))
          if (!match) {
            return { found: false, reason: "No matching document" }
          }
          const detail = await getDocumentDetail(match.id)
          return {
            found: true,
            title: detail.document.title,
            summary: detail.document.summary,
            pages: detail.pages.map((page) => ({ title: page.title, excerpt: page.content.slice(0, 240) })),
          }
        },
      }),
      searchWorkflows: tool({
        description: "Find a workflow and inspect its latest version.",
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => {
          const workflows = await listScopedWorkflows(scopedSearchWorkflows.length > 0, scopedSearchWorkflows)
          const match = workflows.find((item) => item.title.toLowerCase().includes(query.toLowerCase()))
          if (!match) {
            return { found: false, reason: "No matching workflow" }
          }
          const detail = await getWorkflowDetail(match.id)
          return {
            found: true,
            title: detail.workflow.title,
            summary: detail.workflow.summary,
            version: detail.selectedVersion.label,
            nodes: detail.definition.nodes.map((node) => node.data.label),
          }
        },
      }),
      searchSkills: tool({
        description: "Find a skill and inspect its file list.",
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => {
          const skills = await listScopedSkills(scopedSearchSkills.length > 0, scopedSearchSkills)
          const match = skills.find((item) => item.title.toLowerCase().includes(query.toLowerCase()))
          if (!match) {
            return { found: false, reason: "No matching skill" }
          }
          const detail = await getSkillDetail(match.id)
          return {
            found: true,
            title: detail.skill.title,
            summary: detail.skill.summary,
            version: detail.selectedVersion.label,
            files: detail.files.map((file) => file.path),
          }
        },
      }),
      delegateResearch: tool({
        description: "Delegate a focused research task to a specialized subagent.",
        inputSchema: z.object({ task: z.string() }),
        execute: async ({ task }, { abortSignal: nextAbortSignal }) => {
          const result = await researchSubagent.generate({ prompt: task, abortSignal: nextAbortSignal })
          return result.text
        },
      }),
      runIntegration: tool({
        description: "Execute a configured integration bound to the selected agent.",
        inputSchema: z.object({ integrationId: z.string(), inputJson: z.string().default("{}") }),
        execute: async ({ integrationId, inputJson }) => {
          const boundIntegration = scopedIntegrations.find((item) => item?.integration.id === integrationId)
          const detail = boundIntegration ?? await getIntegrationDetail(integrationId)
          const result = await executeIntegration(detail.config, inputJson)
          return {
            integration: detail.integration.title,
            ok: result.ok,
            status: result.status,
            body: result.body,
          }
        },
      }),
    },
  })

  const result = await agent.stream({ messages: toModelMessages(history, options?.attachments), abortSignal: options?.abortSignal })

  for await (const part of result.fullStream) {
    switch (part.type) {
      case "text-delta":
        if (part.text) {
          yield { type: "text-delta", text: part.text }
        }
        break
      case "tool-call":
        yield { type: "tool-call", toolCallId: part.toolCallId, toolName: part.toolName, input: part.input as Record<string, unknown> }
        break
      case "tool-result":
        yield { type: "tool-result", toolCallId: part.toolCallId, toolName: part.toolName, output: serializeToolOutput(part.output) }
        break
      case "error":
        yield { type: "error", error: part.error instanceof Error ? part.error.message : String(part.error) }
        break
      case "abort":
        yield { type: "error", error: "Generation aborted." }
        break
      default:
        break
    }
  }
}

export function toModelMessages(history: ChatMessageRecord[], attachments: ChatAttachment[] = []): ModelMessage[] {
  if (history.length === 0 && attachments.length === 0) {
    return []
  }

  return history.map((message, index) => {
    if (message.role === "user" && index === history.length - 1 && attachments.length > 0) {
      return {
        role: "user",
        content: [
          { type: "text", text: message.content },
          ...attachments.map((attachment) => ({
            type: "file" as const,
            mediaType: attachment.kind === "image" ? "image" : attachment.mediaType,
            filename: attachment.name,
            data: attachment.data,
          })),
        ],
      } satisfies UserModelMessage
    }

    return { role: message.role, content: message.content }
  })
}