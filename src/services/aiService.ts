// AI SDK v6 integration service
import { generateText, streamText, stepCountIs, type ToolSet, type ModelMessage, type LanguageModel } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { logger } from '@/services/logger'

// ─── Provider type display names ──────────────────────────────────

const PROVIDER_TYPE_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  ollama: 'Ollama',
  'openai-compatible': 'OpenAI Compatible',
}

const MAX_STREAM_EVENT_PAYLOAD_LENGTH = 20_000

/**
 * Verbose console tracing is only emitted when the user sets
 * `window.__SUORA_DEBUG_STREAM__ = true` (or NODE_ENV === 'development').
 * Without this guard, every chat turn does dozens of console.group calls
 * plus multi-KB JSON stringifications that never get read.
 */
function isStreamDebugEnabled(): boolean {
  try {
    if (typeof window !== 'undefined' && (window as unknown as { __SUORA_DEBUG_STREAM__?: boolean }).__SUORA_DEBUG_STREAM__) {
      return true
    }
  } catch { /* window unavailable */ }
  try {
    return typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'
  } catch {
    return false
  }
}

const STREAM_DEBUG = isStreamDebugEnabled()

// ─── Error classification ──────────────────────────────────────────

/**
 * Broad categories for network / provider errors, used to render helpful
 * hints in chat UI ("network down", "rate-limited", "auth failed", etc.)
 * and to decide whether a transient failure is worth retrying.
 */
export type AppErrorCategory =
  | 'network-offline'
  | 'network-refused'
  | 'timeout'
  | 'rate-limit'
  | 'auth'
  | 'not-found'
  | 'cancelled'
  | 'server'
  | 'invalid-input'
  | 'unknown'

export interface AppErrorClassification {
  category: AppErrorCategory
  retryable: boolean
  hint: string
}

export function classifyAppError(rawError: unknown): AppErrorClassification {
  const msg = (rawError instanceof Error ? rawError.message : String(rawError ?? '')).toLowerCase()

  if (/aborterror|abortsignal|canceled|cancelled/.test(msg)) {
    return { category: 'cancelled', retryable: false, hint: 'Request cancelled.' }
  }
  if (/enotfound|network\s?error|failed to fetch|offline/.test(msg)) {
    return { category: 'network-offline', retryable: true, hint: 'Network unreachable. Check your internet connection, then retry.' }
  }
  if (/econnrefused|connection refused/.test(msg)) {
    return { category: 'network-refused', retryable: true, hint: 'Connection refused. Verify that the API endpoint is running and reachable.' }
  }
  if (/etimedout|timeout|timed out/.test(msg)) {
    return { category: 'timeout', retryable: true, hint: 'Request timed out. Retry, or check your network / base URL.' }
  }
  if (/rate\s?limit|too many requests|429/.test(msg)) {
    return { category: 'rate-limit', retryable: true, hint: 'Rate limit hit. Wait a few seconds and retry.' }
  }
  if (/401|403|unauthorized|forbidden|invalid api key|authentication/.test(msg)) {
    return { category: 'auth', retryable: false, hint: 'Authentication failed. Check your API key in Models settings.' }
  }
  if (/404|not found|no such model|model.*not.*found/.test(msg)) {
    return { category: 'not-found', retryable: false, hint: 'Model or endpoint not found. Verify the model name and base URL.' }
  }
  if (/5\d\d|internal server error|bad gateway|service unavailable/.test(msg)) {
    return { category: 'server', retryable: true, hint: 'Provider returned a server error. Retry shortly.' }
  }
  if (/invalid|schema|validation/.test(msg)) {
    return { category: 'invalid-input', retryable: false, hint: 'Invalid input or configuration. Review the request.' }
  }
  return { category: 'unknown', retryable: false, hint: '' }
}

/** Append a human-friendly hint to a raw error string for UI display. */
export function describeAppError(rawError: unknown): string {
  const base = rawError instanceof Error ? rawError.message : String(rawError ?? 'Unknown error')
  const { hint } = classifyAppError(rawError)
  if (!hint) return base
  return `${base}\n\n${hint}`
}

function getProviderTypeName(providerType: string): string {
  return PROVIDER_TYPE_NAMES[providerType] || providerType
}

function truncateStreamPayload(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  const truncatedChars = value.length - maxLength
  return `${value.slice(0, maxLength)}\n[Note: Output truncated — ${truncatedChars} characters omitted from original ${value.length} characters]`
}

function safeSerializeStreamPayload(value: unknown, maxLength = MAX_STREAM_EVENT_PAYLOAD_LENGTH): string {
  if (typeof value === 'string') {
    return truncateStreamPayload(value, maxLength)
  }

  const seen = new WeakSet<object>()

  try {
    const serialized = JSON.stringify(value, (_key, current) => {
      if (typeof current === 'bigint') return `${current.toString()}n`
      if (typeof current === 'function') return `[Function ${current.name || 'anonymous'}]`
      if (current instanceof Error) {
        return {
          name: current.name,
          message: current.message,
          stack: current.stack,
        }
      }
      if (current && typeof current === 'object') {
        if (seen.has(current)) return '[Circular]'
        seen.add(current)
      }
      return current
    }, 2)

    return truncateStreamPayload(serialized ?? String(value), maxLength)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return `[Unserializable payload: ${message}]`
  }
}

// ─── Stream event types (AI SDK v6 aligned) ──────────────────────────

export type AppStreamEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; input: Record<string, unknown> }
  | { type: 'tool-result'; toolCallId: string; toolName: string; output: string }
  | { type: 'tool-error'; toolCallId: string; toolName: string; error: string }
  | { type: 'finish-step'; finishReason: string }
  | { type: 'usage'; promptTokens: number; completionTokens: number; totalTokens: number }
  | { type: 'error'; error: string }

// ─── Provider management ───────────────────────────────────────────

type ProviderInstance =
  | ReturnType<typeof createOpenAI>
  | ReturnType<typeof createAnthropic>
  | ReturnType<typeof createOpenAICompatible>

/**
 * LRU-bounded cache of provider instances. The cache key encodes
 * `providerId:apiKey:baseUrl`, so rotating an API key or changing the base
 * URL produces a new entry. Without a bound, every key rotation kept the
 * old credentials live in memory until process exit.
 */
const MAX_PROVIDER_INSTANCES = 32
const providerInstances = new Map<string, ProviderInstance>()

function setProviderInstance(key: string, instance: ProviderInstance): void {
  // Evict any prior instance for the same providerId so renames/key changes
  // don't accumulate stale entries.
  const colonIdx = key.indexOf(':')
  if (colonIdx >= 0) {
    const providerPrefix = key.slice(0, colonIdx + 1)
    for (const existing of Array.from(providerInstances.keys())) {
      if (existing !== key && existing.startsWith(providerPrefix)) {
        providerInstances.delete(existing)
      }
    }
  }
  providerInstances.delete(key)
  providerInstances.set(key, instance)
  while (providerInstances.size > MAX_PROVIDER_INSTANCES) {
    const oldest = providerInstances.keys().next().value
    if (oldest === undefined) break
    providerInstances.delete(oldest)
  }
}

function getProviderInstance(key: string): ProviderInstance | undefined {
  const value = providerInstances.get(key)
  if (value !== undefined) {
    // Refresh LRU position
    providerInstances.delete(key)
    providerInstances.set(key, value)
  }
  return value
}

/**
 * Validate model configuration completeness
 */
export function validateModelConfig(model: { provider?: string; providerType?: string; modelId?: string; apiKey?: string }): { valid: boolean; error?: string } {
  if (!model.provider) {
    return { valid: false, error: 'Provider ID is missing' }
  }
  if (!model.providerType) {
    return { valid: false, error: 'Provider type is missing' }
  }
  if (!model.modelId) {
    return { valid: false, error: 'Model ID is missing' }
  }
  if (!model.apiKey && model.providerType !== 'ollama') {
    return { valid: false, error: `API key is required for ${getProviderTypeName(model.providerType)}` }
  }
  return { valid: true }
}

export function initializeProvider(
  providerType: string,
  apiKey: string,
  baseUrl?: string,
  providerId?: string,
) {
  if (!apiKey && providerType !== 'ollama') {
    throw new Error(`API key is required for provider "${getProviderTypeName(providerType)}"`)
  }

  // Validate Bailian/Kimi configurations
  if (providerType === 'openai-compatible' && baseUrl) {
    if (baseUrl.includes('dashscope.aliyuncs.com') && !baseUrl.includes('/compatible-mode/v1')) {
      console.warn(
        '[Provider Init] WARNING: DashScope base URL should include /compatible-mode/v1.\n' +
        `Current: ${baseUrl}\n` +
        `Expected: https://dashscope.aliyuncs.com/compatible-mode/v1`
      )
    }
    if (baseUrl.includes('moonshot.cn') && !baseUrl.endsWith('/v1')) {
      console.warn(
        '[Provider Init] WARNING: Kimi base URL should end with /v1.\n' +
        `Current: ${baseUrl}\n` +
        `Expected: https://api.moonshot.cn/v1`
      )
    }
    if (baseUrl.endsWith('/') && !baseUrl.endsWith('/v1')) {
      console.warn(`[Provider Init] WARNING: Base URL should not end with slash: ${baseUrl}`)
    }
    if (baseUrl.includes('dashscope.aliyuncs.com') && providerId?.toLowerCase().includes('kimi')) {
      console.error(
        '[Provider Init] ERROR: Configuration Error: Kimi models cannot be used with DashScope endpoint!\n' +
        'Kimi models (moonshot-v1-*) require Kimi API endpoint: https://api.moonshot.cn/v1\n' +
        'Please create a separate provider configuration for Kimi models.'
      )
    }
  }

  const key = `${providerId ?? providerType}:${apiKey}:${baseUrl ?? ''}`
  if (providerInstances.has(key)) {
    // Refresh LRU position
    getProviderInstance(key)
    return
  }

  let instance: ProviderInstance
  switch (providerType) {
    case 'anthropic':
      instance = createAnthropic({ apiKey, ...(baseUrl ? { baseURL: baseUrl } : {}) })
      break
    case 'openai':
      instance = createOpenAI({ apiKey, ...(baseUrl ? { baseURL: baseUrl } : {}) })
      break
    case 'google':
      instance = createOpenAI({
        apiKey,
        baseURL: baseUrl || 'https://generativelanguage.googleapis.com/v1beta/openai',
      })
      break
    case 'ollama':
      instance = createOpenAI({
        apiKey: apiKey || 'ollama',
        baseURL: baseUrl || 'http://localhost:11434/v1',
      })
      break
    case 'deepseek':
      instance = createOpenAICompatible({
        name: providerId || 'deepseek',
        apiKey,
        baseURL: baseUrl || 'https://api.deepseek.com/v1',
      })
      break
    case 'zhipu':
      instance = createOpenAICompatible({
        name: providerId || 'zhipu',
        apiKey,
        baseURL: baseUrl || 'https://open.bigmodel.cn/api/paas/v4',
      })
      break
    case 'minimax':
      instance = createOpenAICompatible({
        name: providerId || 'minimax',
        apiKey,
        baseURL: baseUrl || 'https://api.minimax.chat/v1',
      })
      break
    case 'groq':
      instance = createOpenAICompatible({
        name: providerId || 'groq',
        apiKey,
        baseURL: baseUrl || 'https://api.groq.com/openai/v1',
      })
      break
    case 'together':
      instance = createOpenAICompatible({
        name: providerId || 'together',
        apiKey,
        baseURL: baseUrl || 'https://api.together.xyz/v1',
      })
      break
    case 'fireworks':
      instance = createOpenAICompatible({
        name: providerId || 'fireworks',
        apiKey,
        baseURL: baseUrl || 'https://api.fireworks.ai/inference/v1',
      })
      break
    case 'perplexity':
      instance = createOpenAICompatible({
        name: providerId || 'perplexity',
        apiKey,
        baseURL: baseUrl || 'https://api.perplexity.ai',
      })
      break
    case 'cohere':
      instance = createOpenAICompatible({
        name: providerId || 'cohere',
        apiKey,
        baseURL: baseUrl || 'https://api.cohere.ai/v1',
      })
      break
    case 'openai-compatible':
    default:
      instance = createOpenAICompatible({
        name: providerId || 'custom-provider',
        apiKey: apiKey || '',
        baseURL: baseUrl || '',
      })
      break
  }
  setProviderInstance(key, instance)
}

function getProvider(provider: string, apiKey?: string, baseUrl?: string) {
  const searchKey = `${provider}:${apiKey ?? ''}:${baseUrl ?? ''}`
  const direct = getProviderInstance(searchKey)
  if (direct) return direct
  if (apiKey !== undefined || baseUrl !== undefined) {
    return null
  }
  for (const [key, instance] of providerInstances) {
    if (key.startsWith(provider + ':')) return instance
  }
  return null
}

function resolveModel(modelId: string, apiKey?: string, baseUrl?: string) {
  const [provider, ...modelParts] = modelId.split(':')
  const modelName = modelParts.join(':')

  if (!modelName) {
    throw new Error(`Invalid model ID format: "${modelId}". Expected format: "provider:modelName"`)
  }

  const providerInstance = getProvider(provider, apiKey, baseUrl)

  if (!providerInstance) {
    throw new Error(`Provider "${getProviderTypeName(provider)}" not initialized. Please configure API key in Models settings.`)
  }

  // Provider instance is a function that takes modelName and returns a language model
  return (providerInstance as (modelName: string) => LanguageModel)(modelName)
}

// ─── Text generation (non-streaming) ──────────────────────────────

/**
 * Test connection to a provider by sending a minimal request.
 * Returns { success: true } or { success: false, error: string }.
 */
export async function testConnection(
  providerType: string,
  apiKey: string,
  baseUrl: string | undefined,
  modelId: string,
  providerId?: string,
): Promise<{ success: boolean; error?: string; latency?: number }> {
  const start = Date.now()
  try {
    initializeProvider(providerType, apiKey || 'ollama', baseUrl, providerId)
    const fullModelId = `${providerId || providerType}:${modelId}`
    const model = resolveModel(fullModelId, apiKey, baseUrl)
    const result = await generateText({
      model,
      messages: [{ role: 'user', content: 'Hi' }],
    })
    const latency = Date.now() - start
    return { success: !!result.text, latency }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function generateResponse(
  modelId: string,
  messages: ModelMessage[],
  systemPrompt?: string,
  apiKey?: string,
  baseUrl?: string
) {
  const model = resolveModel(modelId, apiKey, baseUrl)

  const result = await generateText({
    model,
    messages,
    system: systemPrompt,
  })

  return result.text
}

// ─── Streaming with tool support (AI SDK v6) ─────────────────────

/**
 * Stream a response with full tool-call/tool-result events.
 * Uses AI SDK v6 conventions:
 * - `ModelMessage[]` for messages (no custom conversion)
 * - `stopWhen: stepCountIs(N)` for multi-step tool loops
 * - Proper v6 fullStream event types
 */
export async function* streamResponseWithTools(
  modelId: string,
  messages: ModelMessage[],
  options?: {
    systemPrompt?: string
    tools?: ToolSet
    maxSteps?: number
    toolChoice?: 'auto' | 'required' | 'none'
    abortSignal?: AbortSignal
    apiKey?: string
    baseUrl?: string
  }
): AsyncGenerator<AppStreamEvent> {
  const model = resolveModel(modelId, options?.apiKey, options?.baseUrl)

  const hasTools = !!options?.tools && Object.keys(options.tools).length > 0
  const requestedStepLimit = Math.max(1, options?.maxSteps ?? 20)
  const stepLimit = hasTools ? Math.max(2, requestedStepLimit) : requestedStepLimit

  if (hasTools && stepLimit !== requestedStepLimit) {
    logger.warn('[streamResponseWithTools] maxSteps below 2 prevents a post-tool response; clamping to 2', {
      requestedStepLimit,
      effectiveStepLimit: stepLimit,
      modelId,
    })
  }

  logger.info(`[streamResponseWithTools] model=${modelId}, messages=${messages.length}, hasTools=${hasTools}, stopWhen=stepCountIs(${stepLimit})`)
  if (hasTools && options?.tools) {
    logger.info('[streamResponseWithTools] Available tools: ' + Object.keys(options.tools).join(', '))
  }
  logger.debug('[streamResponseWithTools] Input messages', messages.map((m, i) => ({
    idx: i, role: m.role, contentType: typeof m.content === 'string' ? 'string' : 'array',
  })))
  if (STREAM_DEBUG) {
    console.group(`[streamResponseWithTools] model=${modelId}, messages=${messages.length}, hasTools=${hasTools}, stopWhen=stepCountIs(${stepLimit})`)
    if (hasTools && options?.tools) {
      console.log('[streamResponseWithTools] Available tools:', Object.keys(options.tools))
    }
    console.log('[streamResponseWithTools] Input messages:', messages.map((m, i) => ({
      idx: i, role: m.role, contentType: typeof m.content === 'string' ? 'string' : 'array',
    })))
  }

  const result = streamText({
    model,
    messages,
    system: options?.systemPrompt,
    ...(hasTools && options?.tools ? {
      tools: options.tools,
      stopWhen: stepCountIs(stepLimit),
      toolChoice: options?.toolChoice ?? 'auto',
    } : {}),
    ...(options?.abortSignal ? { abortSignal: options.abortSignal } : {}),
  })

  if (STREAM_DEBUG) {
    console.log('[streamResponseWithTools] streamText called, iterating fullStream...')
    console.groupEnd()
  }

  let hasEmittedText = false
  let streamError: string | null = null
  let toolCallCount = 0
  let stepCount = 0
  let accumulatedInputTokens = 0
  let accumulatedOutputTokens = 0
  const toolTimings: Record<string, number> = {} // toolCallId → start timestamp
  const streamStartTime = performance.now()
  let thrownStreamError: string | null = null

  try {
    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          if (part.text) {
            hasEmittedText = true
            yield { type: 'text-delta', text: part.text }
          }
          break

        case 'tool-call': {
          toolCallCount++
          toolTimings[part.toolCallId] = performance.now()
          logger.info(`[ToolCall] #${toolCallCount} ${part.toolName} | id=${part.toolCallId} | elapsed=${(performance.now() - streamStartTime).toFixed(0)}ms`, {
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            input: part.input,
          })
          if (STREAM_DEBUG) {
            const inputStr = safeSerializeStreamPayload(part.input, 10_000)
            console.group(`%c[AI SDK] 🔧 Tool Call #${toolCallCount}: ${part.toolName}`, 'color: #2196F3; font-weight: bold')
            console.log(`Tool Call ID: ${part.toolCallId}`)
            console.log(`Tool Name:    ${part.toolName}`)
            console.log(`Timestamp:    ${new Date().toISOString()}`)
            console.log(`Elapsed:      ${(performance.now() - streamStartTime).toFixed(0)}ms since stream start`)
            console.log(`Input (${inputStr.length} chars):`, inputStr.length <= 2000 ? part.input : inputStr)
            if (inputStr.length > 500) {
              console.log(`Input (raw JSON):\n${inputStr}`)
            }
            console.groupEnd()
          }
          yield {
            type: 'tool-call',
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            input: part.input as Record<string, unknown>,
          }
          break
        }

        case 'tool-result': {
          const output = part.output
          const outputStr = safeSerializeStreamPayload(output)
          const callStartTime = toolTimings[part.toolCallId]
          const toolDuration = callStartTime ? (performance.now() - callStartTime).toFixed(0) : '?'
          logger.info(`[ToolResult] ${part.toolName} | id=${part.toolCallId} | duration=${toolDuration}ms | outputLen=${outputStr.length}`, {
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            durationMs: toolDuration,
            output: outputStr.length <= 4000 ? outputStr : outputStr.slice(0, 4000) + `... [truncated ${outputStr.length - 4000} chars]`,
          })
          if (STREAM_DEBUG) {
            console.group(`%c[AI SDK] ✅ Tool Result: ${part.toolName}`, 'color: #4CAF50; font-weight: bold')
            console.log(`Tool Call ID: ${part.toolCallId}`)
            console.log(`Tool Name:    ${part.toolName}`)
            console.log(`Duration:     ${toolDuration}ms`)
            console.log(`Output (${outputStr.length} chars):`)
            if (outputStr.length <= 2000) {
              try {
                console.log(JSON.parse(outputStr))
              } catch {
                console.log(outputStr)
              }
            } else {
              console.log(`${outputStr.slice(0, 1000)}\n... [truncated ${outputStr.length - 1000} chars] ...\n${outputStr.slice(-500)}`)
            }
            console.groupEnd()
          }
          yield {
            type: 'tool-result',
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            output: outputStr,
          }
          break
        }

        case 'tool-error': {
          const callStartTime = toolTimings[part.toolCallId]
          const toolDuration = callStartTime ? (performance.now() - callStartTime).toFixed(0) : '?'
          logger.error(`[ToolError] ${part.toolName} | id=${part.toolCallId} | duration=${toolDuration}ms`, {
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            durationMs: toolDuration,
            error: String(part.error),
            stack: part.error instanceof Error ? part.error.stack : undefined,
          })
          if (STREAM_DEBUG) {
            console.group(`%c[AI SDK] ❌ Tool Error: ${part.toolName}`, 'color: #F44336; font-weight: bold')
            console.log(`Tool Call ID: ${part.toolCallId}`)
            console.log(`Tool Name:    ${part.toolName}`)
            console.log(`Duration:     ${toolDuration}ms`)
            console.error(`Error:`, part.error)
            if (part.error instanceof Error && part.error.stack) {
              console.error(`Stack:`, part.error.stack)
            }
            console.groupEnd()
          }
          yield {
            type: 'tool-error',
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            error: String(part.error),
          }
          break
        }

        case 'finish-step': {
          stepCount++
          accumulatedInputTokens += (part as Record<string, unknown>).usage
            ? ((part as Record<string, unknown>).usage as { inputTokens?: number }).inputTokens ?? 0
            : 0
          accumulatedOutputTokens += (part as Record<string, unknown>).usage
            ? ((part as Record<string, unknown>).usage as { outputTokens?: number }).outputTokens ?? 0
            : 0
          const stepTokens = (part as Record<string, unknown>).usage
            ? `input=${((part as Record<string, unknown>).usage as { inputTokens?: number }).inputTokens ?? 0}, output=${((part as Record<string, unknown>).usage as { outputTokens?: number }).outputTokens ?? 0}`
            : 'no usage data'
          logger.info(`[StepFinished] #${stepCount} | reason=${part.finishReason} | toolCalls=${toolCallCount} | text=${hasEmittedText ? 'yes' : 'no'} | tokens: ${stepTokens} | elapsed=${(performance.now() - streamStartTime).toFixed(0)}ms`)
          if (STREAM_DEBUG) {
            console.log(`%c[AI SDK] 📍 Step #${stepCount} finished`, 'color: #FF9800; font-weight: bold',
              `| reason=${part.finishReason} | toolCalls=${toolCallCount} | text=${hasEmittedText ? 'yes' : 'no'} | tokens: ${stepTokens} | elapsed=${(performance.now() - streamStartTime).toFixed(0)}ms`)
          }
          yield {
            type: 'finish-step',
            finishReason: part.finishReason || 'unknown',
          }
          break
        }

        case 'error':
          streamError = String(part.error)
          logger.error(`[StreamError] ${streamError}`)
          if (STREAM_DEBUG) {
            console.error(`%c[AI SDK] 💥 Stream error`, 'color: #F44336; font-weight: bold', streamError)
          }
          yield { type: 'error', error: describeAppError(streamError) }
          break
      }
    }
  } catch (err) {
    thrownStreamError = err instanceof Error ? err.message : String(err)
    if (!streamError) {
      streamError = thrownStreamError
      logger.error(`[StreamFailure] ${streamError}`, {
        modelId,
        hasTools,
        steps: stepCount,
        toolCalls: toolCallCount,
      })
      console.error(`%c[AI SDK] 💥 Stream failure`, 'color: #F44336; font-weight: bold', streamError)
      yield { type: 'error', error: describeAppError(streamError) }
    }
  }

  const totalDuration = (performance.now() - streamStartTime).toFixed(0)
  logger.info(`[StreamComplete] duration=${totalDuration}ms | steps=${stepCount} | toolCalls=${toolCallCount} | text=${hasEmittedText} | tokens: in=${accumulatedInputTokens}, out=${accumulatedOutputTokens}`, {
    durationMs: totalDuration,
    steps: stepCount,
    toolCalls: toolCallCount,
    hasText: hasEmittedText,
    tokens: { input: accumulatedInputTokens, output: accumulatedOutputTokens },
    toolTimings: Object.entries(toolTimings).map(([id, start]) => ({ id, elapsed: `${(performance.now() - start).toFixed(0)}ms` })),
  })
  if (STREAM_DEBUG) {
    if (hasTools) {
      console.group(`%c[AI SDK] 🏁 Stream Complete`, 'color: #9C27B0; font-weight: bold')
      console.log(`Total duration: ${totalDuration}ms`)
      console.log(`Steps: ${stepCount}, Tool calls: ${toolCallCount}, Has text: ${hasEmittedText}`)
      console.log(`Accumulated tokens: input=${accumulatedInputTokens}, output=${accumulatedOutputTokens}`)
      if (toolCallCount > 0) {
        console.log(`Tool call timings:`, Object.entries(toolTimings).map(([id, start]) => ({ id: id.slice(0, 12) + '...', elapsed: `${(performance.now() - start).toFixed(0)}ms` })))
      }
      console.groupEnd()
    } else {
      console.debug(`[AI SDK] Stream complete (no tools): ${totalDuration}ms, text=${hasEmittedText}`)
    }
  }

  // Emit usage info BEFORE error checks so token stats are always tracked
  try {
    const usage = await result.totalUsage
    if (usage) {
      yield {
        type: 'usage',
        promptTokens: usage.inputTokens ?? 0,
        completionTokens: usage.outputTokens ?? 0,
        totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
      }
    } else if (accumulatedInputTokens > 0 || accumulatedOutputTokens > 0) {
      // Fallback: use accumulated per-step usage
      yield {
        type: 'usage',
        promptTokens: accumulatedInputTokens,
        completionTokens: accumulatedOutputTokens,
        totalTokens: accumulatedInputTokens + accumulatedOutputTokens,
      }
    }
  } catch {
    // totalUsage promise failed — use accumulated per-step usage as fallback
    if (accumulatedInputTokens > 0 || accumulatedOutputTokens > 0) {
      yield {
        type: 'usage',
        promptTokens: accumulatedInputTokens,
        completionTokens: accumulatedOutputTokens,
        totalTokens: accumulatedInputTokens + accumulatedOutputTokens,
      }
    }
  }

  // Surface suppressed API errors (skip if tool calls were made — tool-only responses are valid)
  if (!hasEmittedText && !streamError && toolCallCount === 0) {
    try {
      const finalText = await result.text
      if (!finalText || finalText.trim() === '') {
        throw new Error(
          'Model returned empty response. Please check:\n' +
          '1. API key is valid and has sufficient quota\n' +
          '2. Base URL is correct for this provider\n' +
          '3. Model name matches the provider\'s API specification\n' +
          '4. Network connection to the provider is stable\n\n' +
          'For Bailian (阿里云百炼): baseUrl should be https://dashscope.aliyuncs.com/compatible-mode/v1\n' +
          'For Kimi (月之暗面): baseUrl should be https://api.moonshot.cn/v1'
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(msg)
    }
  }
}
