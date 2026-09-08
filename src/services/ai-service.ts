import { ToolLoopAgent, stepCountIs, tool, type LanguageModel } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { z } from "zod"

import type { ChatAttachmentRecord } from "@/data/domain/chat-message-parts"
import type { ChatMessageRecord } from "@/data/domain/models"
import type { ChatRuntimeSettings } from "@/data/repositories/chat-settings-repository"
import { listConfiguredModelProviders } from "@/data/repositories/model-config-repository"
import { buildChatModelMessages } from "@/services/chat-model-messages"
import { getDocumentDetail } from "@/data/repositories/document-repository"
import { getIntegrationDetail } from "@/data/repositories/integration-repository"
import { executeIntegration } from "@/data/repositories/integration-execution-repository"
import { getSkillDetail } from "@/data/repositories/skill-repository"
import { getWorkflowDetail } from "@/data/repositories/workflow-repository"
import { getResearchAgentMaxSteps, getStepLimitErrorMessage, normalizeChatAgentMaxSteps } from "@/services/agent-loop-control"
import type { ChatErrorKind } from "@/services/chat-error-state"
import { createBuiltInTools, listScopedDocuments, listScopedSkills, listScopedWorkflows, mergeAgentInstructions, resolveAgentContext } from "@/services/ai-tools"
import { createPrivateResourceTools } from "@/services/private-resource-tools"

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
  | { type: "error"; error: string; errorKind: ChatErrorKind }

export type ChatAttachment = ChatAttachmentRecord

function decodeBase64(base64: string) {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

function createAbortError() {
  return new DOMException("The operation was aborted.", "AbortError")
}

function createProxyFetch(settings: ChatRuntimeSettings): typeof fetch | undefined {
  const bridge = window.electron
  if (!bridge?.invoke || !bridge.on || !bridge.off) {
    return undefined
  }

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    console.info("[SUORA AI][renderer] fetch", {
      method: request.method,
      url: `${new URL(request.url).protocol}//${new URL(request.url).hostname}${new URL(request.url).pathname}`,
    })
    const headers = Object.fromEntries(request.headers.entries())
    const bodyText = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text()

    return new Promise<Response>((resolve, reject) => {
      let requestId: string | undefined
      let controller: ReadableStreamDefaultController<Uint8Array> | undefined
      let responseResolved = false
      const pendingEvents: unknown[][] = []

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

      const processEvent = (...args: unknown[]) => {
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
            console.error("[SUORA AI][renderer] stream error", payload.error)
            cleanup()
            if (!responseResolved) {
              reject(new Error(payload.error))
            } else {
              controller?.error(new Error(payload.error))
            }
            break
        }
      }

      const handleEvent = (...args: unknown[]) => {
        // The main process starts the request immediately, so the response
        // event can arrive before invoke() resolves with the request ID.
        // Buffer those events instead of dropping the entire stream.
        if (!requestId) {
          pendingEvents.push(args)
          return
        }
        processEvent(...args)
      }

      bridge.on("ai:fetch:event", handleEvent)
      request.signal.addEventListener("abort", handleAbort, { once: true })

      void bridge.invoke("ai:fetch:start", {
        url: request.url,
        method: request.method,
        headers,
        bodyText,
        ...(settings.requestTimeoutMs > 0 ? { timeoutMs: settings.requestTimeoutMs } : {}),
      }).then((result) => {
        requestId = (result as AiFetchStartResult).requestId
        if (!requestId) {
          cleanup()
          reject(new Error("AI fetch did not return a request ID"))
          return
        }
        for (const event of pendingEvents.splice(0)) {
          processEvent(...event)
        }
      }).catch((error) => {
        console.error("[SUORA AI][renderer] IPC start error", error)
        cleanup()
        reject(error instanceof Error ? error : new Error(String(error)))
      })
    })
  }
}

function createModel(settings: ChatRuntimeSettings): LanguageModel {
  const providerFetch = createProxyFetch(settings)
  const sharedOptions = providerFetch ? { fetch: providerFetch } : {}

  switch (settings.model.providerType) {
    case "anthropic":
      return createAnthropic({
        apiKey: settings.model.apiKey,
        ...(settings.model.baseUrl ? { baseURL: settings.model.baseUrl } : {}),
        ...sharedOptions,
      })(settings.model.modelId)
    case "azure":
      return createOpenAI({
        apiKey: settings.model.apiKey,
        baseURL: settings.model.baseUrl || "https://your-resource-name.openai.azure.com/openai/v1/",
        headers: {
          "api-key": settings.model.apiKey,
        },
        ...sharedOptions,
      }).responses(settings.model.modelId)
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
        headers: {
          "api-key": settings.model.apiKey,
        },
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

type ResearchResourceScope = {
  documents: Array<Awaited<ReturnType<typeof getDocumentDetail>> | null>
  skills: Array<Awaited<ReturnType<typeof getSkillDetail>> | null>
  workflows: Array<Awaited<ReturnType<typeof getWorkflowDetail>> | null>
}

async function createResearchSubagent(settings: ChatRuntimeSettings, maxSteps: number, scope: ResearchResourceScope) {
  const model = createModel(settings)
  const hasDocumentScope = scope.documents.length > 0
  const hasSkillScope = scope.skills.length > 0
  const hasWorkflowScope = scope.workflows.length > 0

  return new ToolLoopAgent({
    model,
    instructions: "You are a focused research subagent. Summarize only the relevant facts from the provided workspace tools.",
    stopWhen: stepCountIs(maxSteps),
    tools: {
      listDocuments: tool({
        description: "List available documents in the workspace.",
        inputSchema: z.object({}),
        execute: async () => (await listScopedDocuments(hasDocumentScope, scope.documents)).map((item) => ({ id: item.id, title: item.title, summary: item.summary })),
      }),
      listWorkflows: tool({
        description: "List available workflows in the workspace.",
        inputSchema: z.object({}),
        execute: async () => (await listScopedWorkflows(hasWorkflowScope, scope.workflows)).map((item) => ({ id: item.id, title: item.title, summary: item.summary })),
      }),
      listSkills: tool({
        description: "List available skills in the workspace.",
        inputSchema: z.object({}),
        execute: async () => (await listScopedSkills(hasSkillScope, scope.skills)).map((item) => ({ id: item.id, title: item.title, summary: item.summary })),
      }),
    },
  })
}

export async function* streamChatAgentResponse(history: ChatMessageRecord[], settings: ChatRuntimeSettings, options?: { abortSignal?: AbortSignal; selectedAgentId?: string; attachments?: ChatAttachment[]; browserSessionId?: string }): AsyncGenerator<ChatAgentEvent> {
  const agentContext = await resolveAgentContext(options?.selectedAgentId)
  const configuredProviders = await listConfiguredModelProviders()
  const agentProvider = agentContext?.detail?.config.providerId ? configuredProviders.find((provider) => provider.id === agentContext.detail.config.providerId) : undefined
  const agentModelValid = Boolean(agentProvider && agentProvider.models.some((m) => m.id === agentContext?.detail?.config.modelId))

  const effectiveModel = (agentProvider && agentModelValid)
    ? {
        providerId: agentProvider.id,
        providerType: agentProvider.providerType,
        baseUrl: agentProvider.baseUrl,
        apiKey: agentProvider.apiKey,
        modelId: agentContext!.detail!.config.modelId!,
        systemPrompt: settings.model.systemPrompt,
      }
    : settings.model

  const effectiveSettings = agentContext?.detail
    ? {
        ...settings,
        maxSteps: typeof agentContext.detail.config.maxSteps === "number" ? agentContext.detail.config.maxSteps : settings.maxSteps,
        model: effectiveModel,
      }
    : settings
  const model = createModel(effectiveSettings)
  const chatAgentMaxSteps = normalizeChatAgentMaxSteps(effectiveSettings.maxSteps)
  const researchAgentMaxSteps = getResearchAgentMaxSteps(chatAgentMaxSteps)
  const builtInTools = await createBuiltInTools(options?.browserSessionId)
  const privateResourceTools = createPrivateResourceTools(agentContext?.detail?.config.privateToolIds ?? [])

  const scopedSearchDocuments = agentContext?.documents?.filter(Boolean) ?? []
  const scopedSearchSkills = agentContext?.skills?.filter(Boolean) ?? []
  const scopedSearchWorkflows = agentContext?.workflows?.filter(Boolean) ?? []
  const scopedIntegrations = agentContext?.integrations?.filter(Boolean) ?? []
  let researchSubagentPromise: Promise<Awaited<ReturnType<typeof createResearchSubagent>>> | null = null

  const agent = new ToolLoopAgent({
    model,
    instructions: mergeAgentInstructions(effectiveSettings, agentContext?.detail ?? null),
    stopWhen: stepCountIs(chatAgentMaxSteps),
    tools: {
      ...builtInTools,
      ...privateResourceTools,
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
          researchSubagentPromise ??= createResearchSubagent(effectiveSettings, researchAgentMaxSteps, {
            documents: scopedSearchDocuments,
            skills: scopedSearchSkills,
            workflows: scopedSearchWorkflows,
          })
          const researchSubagent = await researchSubagentPromise
          const result = await researchSubagent.generate({ prompt: task, abortSignal: nextAbortSignal })
          const stepLimitError = getStepLimitErrorMessage({
            finishReason: result.finishReason,
            stepCount: result.steps.length,
            maxSteps: researchAgentMaxSteps,
            agentLabel: "The research subagent",
          })
          return stepLimitError ?? result.text
        },
      }),
      runIntegration: tool({
        description: "Execute a configured integration bound to the selected agent.",
        inputSchema: z.object({ integrationId: z.string(), inputJson: z.string().default("{}") }),
        execute: async ({ integrationId, inputJson }) => {
          const boundIntegration = scopedIntegrations.find((item) => item?.integration.id === integrationId)
          if (scopedIntegrations.length > 0 && !boundIntegration) {
            throw new Error("The selected agent cannot access this integration.")
          }

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

  const result = await agent.stream({ messages: buildChatModelMessages(history, options?.attachments), abortSignal: options?.abortSignal })

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
        {
          const error = part.error instanceof Error ? part.error.message : String(part.error)
          // An error event is terminal for the model stream. Yielding it as a
          // normal event lets the AI SDK continue and later replace the real
          // transport error with the misleading "No output generated" error.
          // Throw here so the runtime catch block persists and displays the
          // actionable ECONNRESET/proxy message instead.
          throw new Error(error)
        }
      case "abort":
        return
        break
      default:
        break
    }
  }

  const [finishReason, steps] = await Promise.all([result.finishReason, result.steps])
  const stepLimitError = getStepLimitErrorMessage({
    finishReason,
    stepCount: steps.length,
    maxSteps: chatAgentMaxSteps,
    agentLabel: "The chat agent",
  })

  if (stepLimitError) {
    yield { type: "error", error: stepLimitError, errorKind: "step-limit" }
  }
}

