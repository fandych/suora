// Agent-to-Agent communication & delegation service
//
// This module uses the live Zustand store accessor (via readLiveStoreState
// exported from tools.ts) to read real-time state, avoiding stale file-cache
// reads while still preventing circular imports with appStore.

import type { AgentMessage } from '@/types'
import type { ModelMessage } from 'ai'
import { initializeProvider, generateResponse, streamResponseWithTools } from '@/services/aiService'
import { getToolsForAgent, getSkillSystemPrompts, mergeSkillsWithBuiltins, readLiveStoreState, buildSystemPrompt } from '@/services/tools'

// ─── Constants ─────────────────────────────────────────────────────

const MAX_DELEGATION_DEPTH = 3

// ─── Message log ───────────────────────────────────────────────────

const messageLog: AgentMessage[] = []

export function getMessageLog(): readonly AgentMessage[] {
  return messageLog
}

// ─── Store access types ─────────────────────────────────────────────

interface PersistedAgent {
  id: string
  name: string
  systemPrompt: string
  modelId: string
  skills: string[]
  temperature?: number
  maxTokens?: number
  maxTurns?: number
  enabled: boolean
  allowedTools?: string[]
  disallowedTools?: string[]
  permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions'
  responseStyle?: 'concise' | 'detailed' | 'balanced'
}

interface PersistedModel {
  id: string
  name: string
  provider: string
  providerType: string
  modelId: string
  apiKey?: string
  baseUrl?: string
  enabled: boolean
}

interface PersistedProviderConfig {
  id: string
  name: string
  apiKey: string
  baseUrl: string
  providerType: string
}

interface PersistedStoreState {
  agents?: PersistedAgent[]
  models?: PersistedModel[]
  selectedModel?: PersistedModel | null
  skills?: Array<{ id: string; type: string; [key: string]: unknown }>
  providerConfigs?: PersistedProviderConfig[]
}

function readStore(): PersistedStoreState | null {
  return readLiveStoreState() as PersistedStoreState | null
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Return all enabled agents (excluding the requesting agent if specified).
 */
export function listAvailableAgents(excludeAgentId?: string): Array<{ id: string; name: string; skills: string[] }> {
  const state = readStore()
  if (!state?.agents) return []
  return state.agents
    .filter((a) => a.enabled && a.id !== excludeAgentId)
    .map((a) => ({ id: a.id, name: a.name, skills: a.skills }))
}

/**
 * Delegate a task to another agent and return its response.
 *
 * @param fromAgentId  The agent initiating the delegation
 * @param toAgentId    The target agent id
 * @param task         The task description / prompt
 * @param context      Optional additional context
 * @param depth        Current delegation depth (to prevent infinite loops)
 */
export async function delegateToAgent(
  fromAgentId: string,
  toAgentId: string,
  task: string,
  context?: string,
  depth: number = 0,
): Promise<string> {
  if (depth >= MAX_DELEGATION_DEPTH) {
    return `Error: Maximum delegation depth (${MAX_DELEGATION_DEPTH}) reached. Cannot delegate further.`
  }

  const state = readStore()
  if (!state) return 'Error: Store not available'

  // Find target agent
  const targetAgent = state.agents?.find((a) => a.id === toAgentId)
  if (!targetAgent) return `Error: Agent "${toAgentId}" not found`
  if (!targetAgent.enabled) return `Error: Agent "${targetAgent.name}" is disabled`

  // Log the request message
  const requestMsg: AgentMessage = {
    id: `amsg-${crypto.randomUUID()}`,
    fromAgentId,
    toAgentId,
    content: task,
    type: 'request',
    status: 'processing',
    timestamp: Date.now(),
  }
  messageLog.push(requestMsg)

  try {
    // Resolve model: target agent model > globally selected model
    const modelId = targetAgent.modelId || state.selectedModel?.id
    if (!modelId) {
      requestMsg.status = 'failed'
      requestMsg.result = 'Error: No model configured for the target agent and no global model selected'
      return requestMsg.result
    }

    // Ensure provider is initialized
    const model = state.models?.find((m) => m.id === modelId)
    if (model?.apiKey) {
      initializeProvider(model.providerType, model.apiKey, model.baseUrl, model.provider)
    } else {
      // Try provider configs as fallback
      const [providerId] = modelId.split(':')
      const providerCfg = state.providerConfigs?.find((p) => p.id === providerId)
      if (providerCfg?.apiKey) {
        initializeProvider(providerCfg.providerType, providerCfg.apiKey, providerCfg.baseUrl, providerCfg.id)
      }
    }

    // Merge persisted skills with built-in skills (code-level tool definitions
    // always take precedence, but store's enabled state is respected)
    const allSkills = mergeSkillsWithBuiltins(
      (state.skills ?? []) as unknown as import('@/types').Skill[]
    )

    // Build tools for the target agent (exclude agent_delegate to prevent
    // recursive delegation beyond our depth guard in the tool itself)
    const tools = getToolsForAgent(targetAgent.skills, allSkills, {
      allowedTools: targetAgent.allowedTools,
      disallowedTools: targetAgent.disallowedTools,
      permissionMode: targetAgent.permissionMode as 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions' | undefined,
    })

    // Build system prompt
    const skillPrompts = await getSkillSystemPrompts(targetAgent.skills, allSkills)
    const delegationHint = '\nYou are currently handling a delegated task from another agent. Focus on answering the task directly.'
    const systemPrompt = buildSystemPrompt({
      agentPrompt: targetAgent.systemPrompt + delegationHint,
      responseStyle: targetAgent.responseStyle,
      skillPrompts,
      toolNames: Object.keys(tools),
      permissionMode: targetAgent.permissionMode as string | undefined,
    }) ?? targetAgent.systemPrompt

    // Build messages as AI SDK v6 ModelMessage[]
    const messages: ModelMessage[] = []
    if (context) {
      messages.push({ role: 'user', content: `Context: ${context}\n\nTask: ${task}` })
    } else {
      messages.push({ role: 'user', content: task })
    }

    // Use generateResponse (non-streaming) for delegation – simpler & sufficient
    const hasTools = Object.keys(tools).length > 0
    let result: string

    if (hasTools) {
      // Use streamResponseWithTools for tool-capable agents, collecting full text
      const chunks: string[] = []
      for await (const event of streamResponseWithTools(modelId, messages, {
        systemPrompt,
        tools,
        maxSteps: Math.max(2, Math.min(targetAgent.maxTurns ?? 5, 50)),
      })) {
        if (event.type === 'text-delta') {
          chunks.push(event.text)
        }
        // tool-call / tool-result events are handled internally by the AI SDK loop
      }
      result = chunks.join('')
    } else {
      result = await generateResponse(modelId, messages, systemPrompt)
    }

    // Log the response
    requestMsg.status = 'completed'
    requestMsg.result = result

    const responseMsg: AgentMessage = {
      id: `amsg-${crypto.randomUUID()}`,
      fromAgentId: toAgentId,
      toAgentId: fromAgentId,
      content: result,
      type: 'response',
      status: 'completed',
      timestamp: Date.now(),
      parentMessageId: requestMsg.id,
      result,
    }
    messageLog.push(responseMsg)

    return result
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    requestMsg.status = 'failed'
    requestMsg.result = `Error: ${errMsg}`
    return `Error delegating to agent "${targetAgent.name}": ${errMsg}`
  }
}
