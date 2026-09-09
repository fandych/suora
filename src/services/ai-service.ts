import { ToolLoopAgent, stepCountIs, tool } from "ai"
import { z } from "zod"

import type { ChatMessageRecord } from "@/data/domain/models"
import type { ChatRuntimeSettings } from "@/data/repositories/chat-settings-repository"
import { listConfiguredModelProviders } from "@/data/repositories/model-config-repository"
import { buildChatModelMessages } from "@/services/chat/model-messages"
import { getIntegrationDetail } from "@/data/repositories/integration-repository"
import { executeIntegration } from "@/data/repositories/integration-execution-repository"
import { getDocumentDetail } from "@/data/repositories/document-repository"
import { getSkillDetail } from "@/data/repositories/skill-repository"
import { getWorkflowDetail } from "@/data/repositories/workflow-repository"
import { getResearchAgentMaxSteps, getStepLimitErrorMessage, normalizeChatAgentMaxSteps } from "@/data/domain/chat/agent-loop-control"
import { createBuiltInTools, mergeAgentInstructions, resolveAgentContext } from "@/services/ai/tools/built-in-tools"
import { listScopedDocuments, listScopedSkills, listScopedWorkflows } from "@/services/ai/tools/resource-search-tools"
import { createPrivateResourceTools } from "@/services/ai/tools/private-resource-tools"
import { createChatLanguageModel } from "@/services/ai/model-provider-factory"
import { createResearchAgent } from "@/services/ai/research-agent"
import type { ChatAgentEvent, ChatAttachment } from "@/services/chat/types"

export type { ChatAgentEvent, ChatAttachment } from "@/services/chat/types"

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
  const model = createChatLanguageModel(effectiveSettings)
  const chatAgentMaxSteps = normalizeChatAgentMaxSteps(effectiveSettings.maxSteps)
  const researchAgentMaxSteps = getResearchAgentMaxSteps(chatAgentMaxSteps)
  const builtInTools = await createBuiltInTools(options?.browserSessionId)
  const privateResourceTools = createPrivateResourceTools(agentContext?.detail?.config.privateToolIds ?? [])

  const scopedSearchDocuments = agentContext?.documents?.filter(Boolean) ?? []
  const scopedSearchSkills = agentContext?.skills?.filter(Boolean) ?? []
  const scopedSearchWorkflows = agentContext?.workflows?.filter(Boolean) ?? []
  const scopedIntegrations = agentContext?.integrations?.filter(Boolean) ?? []
  let researchAgentPromise: Promise<Awaited<ReturnType<typeof createResearchAgent>>> | null = null

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
          researchAgentPromise ??= createResearchAgent(effectiveSettings, researchAgentMaxSteps, {
            documents: scopedSearchDocuments,
            skills: scopedSearchSkills,
            workflows: scopedSearchWorkflows,
          })
          const researchAgent = await researchAgentPromise
          const result = await researchAgent.generate({ prompt: task, abortSignal: nextAbortSignal })
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

