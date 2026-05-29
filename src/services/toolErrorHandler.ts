import { sanitizeToolError } from '@/services/sanitization'
import type { MemoryScope } from '@/types'

export type ToolErrorCategory =
  | 'permission'
  | 'path'
  | 'validation'
  | 'not-found'
  | 'timeout'
  | 'network'
  | 'auth'
  | 'rate-limit'
  | 'cancelled'
  | 'concurrency'
  | 'execution'
  | 'unknown'

export type ToolErrorSource = 'returned' | 'thrown' | 'stream'

export interface ToolErrorOwnerContext {
  sessionId?: string
  agentId?: string
  skillIds?: string[]
  source?: string
}

export interface ToolErrorContext extends ToolErrorOwnerContext {
  toolName: string
  toolCallId?: string
  input?: Record<string, unknown>
  error: unknown
  durationMs?: number
  errorSource?: ToolErrorSource
}

export interface ToolErrorClassification {
  category: ToolErrorCategory
  retryable: boolean
  hint: string
  solution: string
  scope: MemoryScope
  targetId?: string
  fingerprint: string
}

export interface ToolErrorMemoryDraft extends ToolErrorClassification {
  id: string
  content: string
  tags: string[]
}

function hashText(value: string): string {
  // Non-cryptographic fingerprint only for local deduplication of repeated
  // sanitized error patterns. Collisions merely merge similar suggestions, not
  // security decisions, so a tiny deterministic hash is sufficient here.
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash).toString(16)
}

function normalizeErrorPattern(error: string): string {
  return error
    .toLowerCase()
    .replace(/<\.\.\>\/[^\s]+/g, '<path>')
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/g, '<id>')
    .replace(/\b\d+\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

function classifyErrorText(error: string): Pick<ToolErrorClassification, 'category' | 'retryable' | 'hint' | 'solution'> {
  const normalized = error.toLowerCase()

  if (/cancelled by|canceled|abort|denied by confirmation/.test(normalized)) {
    return {
      category: 'cancelled',
      retryable: false,
      hint: 'The tool call was cancelled or denied.',
      solution: 'Ask for explicit user approval or choose a read-only alternative before calling the tool again.',
    }
  }
  if (/sandbox|path blocked|outside allowed|not allowed|permission denied|forbidden/.test(normalized)) {
    return {
      category: /path blocked|outside allowed/.test(normalized) ? 'path' : 'permission',
      retryable: false,
      hint: 'The tool call was blocked by permissions or sandbox policy.',
      solution: 'Use a path inside the configured workspace/allowed directories, or request permission/settings changes before retrying.',
    }
  }
  if (/already running|concurrent|busy/.test(normalized)) {
    return {
      category: 'concurrency',
      retryable: true,
      hint: 'The tool does not support overlapping calls.',
      solution: 'Wait for the running tool call to finish, then retry the same action once.',
    }
  }
  if (/schema|validation|invalid|required|missing|parse tool|tool input/.test(normalized)) {
    return {
      category: 'validation',
      retryable: false,
      hint: 'The tool input was invalid.',
      solution: 'Review the tool schema and provide all required fields with valid values before retrying.',
    }
  }
  if (/not found|enoent|missing file|no such file|no such/.test(normalized)) {
    return {
      category: 'not-found',
      retryable: false,
      hint: 'The target resource was not found.',
      solution: 'List or search available resources first, then retry with an exact existing id/path/name.',
    }
  }
  if (/timeout|timed out|etimedout/.test(normalized)) {
    return {
      category: 'timeout',
      retryable: true,
      hint: 'The tool call timed out.',
      solution: 'Retry with a smaller input, narrower query, or longer-running workflow if available.',
    }
  }
  if (/network|failed to fetch|offline|econnrefused|enotfound/.test(normalized)) {
    return {
      category: 'network',
      retryable: true,
      hint: 'The tool could not reach a network or local service.',
      solution: 'Check connectivity/service availability, then retry the call.',
    }
  }
  if (/unauthorized|authentication|api key|401|403/.test(normalized)) {
    return {
      category: 'auth',
      retryable: false,
      hint: 'Authentication failed.',
      solution: 'Check credentials or provider settings before retrying the tool call.',
    }
  }
  if (/rate.?limit|too many requests|429/.test(normalized)) {
    return {
      category: 'rate-limit',
      retryable: true,
      hint: 'The tool hit a rate limit.',
      solution: 'Wait briefly, reduce call frequency, then retry.',
    }
  }
  if (/error:|exception|failed|tool invocation/.test(normalized)) {
    return {
      category: 'execution',
      retryable: false,
      hint: 'The tool failed during execution.',
      solution: 'Inspect the sanitized error, adjust the tool input, and avoid repeating the same failing call pattern.',
    }
  }

  return {
    category: 'unknown',
    retryable: false,
    hint: 'The tool returned an error-shaped result.',
    solution: 'Review the sanitized error and use a safer preliminary read/list/search tool before retrying.',
  }
}

function chooseScope(context: ToolErrorContext, category: ToolErrorCategory): Pick<ToolErrorClassification, 'scope' | 'targetId'> {
  // Built-in self-evolution tool names are grouped by prefix in tools.ts.
  // Prefer those explicit families before falling back to runtime context.
  if (context.toolName.startsWith('skill_') && context.skillIds?.length === 1) {
    return { scope: 'skill', targetId: context.skillIds[0] }
  }
  if (context.toolName.startsWith('agent_') && context.agentId) {
    return { scope: 'agent', targetId: context.agentId }
  }
  if (context.sessionId && ['path', 'permission', 'validation', 'cancelled', 'concurrency'].includes(category)) {
    return { scope: 'session', targetId: context.sessionId }
  }
  if (context.agentId) {
    return { scope: 'agent', targetId: context.agentId }
  }
  if (context.sessionId) {
    return { scope: 'session', targetId: context.sessionId }
  }
  return { scope: 'global' }
}

export function classifyToolError(context: ToolErrorContext): ToolErrorClassification {
  const sanitizedError = sanitizeToolError(context.error, 1200)
  const textClassification = classifyErrorText(sanitizedError)
  const scope = chooseScope(context, textClassification.category)
  const pattern = normalizeErrorPattern(sanitizedError)
  const fingerprint = hashText(`${context.toolName}:${textClassification.category}:${pattern}`)

  return {
    ...textClassification,
    ...scope,
    fingerprint,
  }
}

export function buildToolErrorMemoryDraft(context: ToolErrorContext): ToolErrorMemoryDraft {
  const classification = classifyToolError(context)
  const sanitizedError = sanitizeToolError(context.error, 1200)
  const inputKeys = Object.keys(context.input ?? {})
  const sourceLabel = context.source ? `Source: ${context.source}\n` : ''
  const durationLabel = context.durationMs !== undefined ? `Duration: ${context.durationMs}ms\n` : ''
  const ownerLabel = classification.targetId ? `${classification.scope}:${classification.targetId}` : classification.scope
  const content = [
    '[Tool error solution]',
    `Tool: ${context.toolName}`,
    context.toolCallId ? `Tool call id: ${context.toolCallId}` : '',
    `Category: ${classification.category}`,
    `Owner: ${ownerLabel}`,
    `Error source: ${context.errorSource ?? 'unknown'}`,
    `Retryable: ${classification.retryable ? 'yes' : 'no'}`,
    `${sourceLabel}${durationLabel}Error: ${sanitizedError}`,
    `Recommended fix: ${classification.solution}`,
    inputKeys.length > 0 ? `Input keys: ${inputKeys.join(', ')}` : '',
  ].filter(Boolean).join('\n')

  return {
    ...classification,
    id: `memory-tool-error-${classification.fingerprint}`,
    content,
    tags: [
      'tool-error',
      `tool:${context.toolName}`,
      `error:${classification.category}`,
      `scope:${classification.scope}`,
      `retryable:${classification.retryable ? 'yes' : 'no'}`,
      `fingerprint:${classification.fingerprint}`,
      ...(context.source ? [`source:${context.source}`] : []),
      ...(context.toolCallId ? [`tool-call:${context.toolCallId}`] : []),
    ],
  }
}
