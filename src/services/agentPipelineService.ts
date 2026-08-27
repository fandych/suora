import type { Agent, AgentPipeline, AgentPipelineExecution, AgentPipelineExecutionStep, AgentPipelineStep, Model, PipelineRecoveryAction, PipelineStepUsage, Skill } from '@/types'
import type { ModelMessage } from 'ai'
import { generateResponse, initializeProvider, streamResponseWithTools } from '@/services/aiService'
import { flushPendingSplitStoreWrites } from '@/services/fileStorage'
import { appendPipelineExecutionToDisk, loadPipelinesFromDisk } from '@/services/pipelineFiles'
import { buildIncomingTransitionMap, getPipelineEntryStepId, materializePipelineGraph } from '@/services/pipelineGraph'
import { getPluginToolsFor } from '@/services/pluginSystem'
import { buildSystemPrompt, getSkillSystemPrompts, getToolsForAgent, mergeSkillsWithBuiltins } from '@/services/tools'
import { searchDocuments } from '@/services/documents'
import { sanitizeSensitiveText } from '@/services/sanitization'
import { buildPipelineRecoveryActions, validateAgentPipeline } from '@/services/pipelineValidation'
import { evaluateRunIf } from '@/services/pipelineRunIf'
import { applyOutputTransform } from '@/services/pipelineOutputTransforms'
import { executePipelineWithEngineRouting, type PipelineExecutionEngine } from '@/services/workflowPipelineExecutor'
import { getPipelineNodeType, nodeTypeRequiresTask, nodeTypeUsesAgentRuntime } from '@/components/pipeline/pipelineNodeBehaviors'
import { useAppStore } from '@/store/appStore'
import { generateId } from '@/utils/helpers'

const PIPELINE_REFERENCE_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g
const STEP_REFERENCE_PATTERN = /^(?:steps\[(\d+)\]|step(\d+))\.(output|input|task|status|error)$/i
const VARIABLE_REFERENCE_PATTERN = /^vars\.([A-Za-z_][A-Za-z0-9_]*)$/
/** Same shape as VARIABLE_REFERENCE_PATTERN's capture group — used to gate `exportVar` writes. */
const EXPORT_VAR_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
const EXACT_TEMPLATE_REFERENCE_PATTERN = /^\{\{\s*([^}]+?)\s*\}\}$/
const CODE_NODE_BLOCKED_GLOBALS = [
  'require', 'module', 'exports', '__dirname', '__filename',
  'process', 'global', 'globalThis', 'window', 'document', 'self',
  'fetch', 'XMLHttpRequest', 'WebSocket', 'Worker', 'SharedWorker',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'Function', 'Reflect', 'Proxy', 'Buffer',
]

type PipelineStepRuntimeValue = Pick<AgentPipelineExecutionStep, 'stepIndex' | 'agentId' | 'task' | 'input' | 'output' | 'status' | 'error'>
const MAX_STEP_RETRIES = 3
const MAX_PIPELINE_REFERENCE_CHARS = 24_000
const MAX_PIPELINE_HANDOFF_CHARS = 32_000
const MAX_PIPELINE_INPUT_CHARS = 80_000
const PIPELINE_ERROR_MAX_CHARS = 1_000
const DEFAULT_STEP_TIMEOUT_MS = 5 * 60 * 1000

export interface ExecuteAgentPipelineOptions {
  /**
   * Optional execution engine selector.
   * - `auto` (default): follow configured default and fall back to legacy.
   * - `legacy`: force the in-process executor.
   * - `workflow`: prefer Workflow SDK path, with safe fallback when runtime
   *   integration is unavailable.
   */
  executionEngine?: PipelineExecutionEngine
  trigger?: AgentPipelineExecution['trigger']
  timerId?: string
  persistExecution?: boolean
  persistLastRun?: boolean
  onStepUpdate?: (step: AgentPipelineProgressStep) => void
  /**
   * Optional AbortSignal. When aborted, the pipeline stops between steps and
   * the active LLM stream is cancelled. The remaining steps are marked as
   * 'error' with the message "Cancelled by user" and the overall execution
   * status is 'error'.
   */
  abortSignal?: AbortSignal
  /**
   * Optional values for pipeline-level variables. Referenced from steps
   * using `{{vars.NAME}}` and from `runIf` conditions as `vars.NAME`.
   * Missing required variables fall back to their declared default; when
   * neither is set the value resolves to the empty string.
   */
  variables?: Record<string, string>
  /** Internal recursion guard for nested pipeline nodes. */
  pipelineCallStack?: string[]
}

export interface AgentPipelineProgressStep {
  stepIndex: number
  agentId: string
  agentName?: string
  name?: string
  task: string
  input: string
  output?: string
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped'
  startedAt?: number
  completedAt?: number
  durationMs?: number
  attempts?: number
  error?: string
  recoveryActions?: PipelineRecoveryAction[]
  usage?: PipelineStepUsage
  skipReason?: string
}

function normalizeRetryCount(retryCount?: number): number {
  if (!Number.isFinite(retryCount)) return 0
  return Math.max(0, Math.min(Math.trunc(retryCount ?? 0), MAX_STEP_RETRIES))
}

const MAX_RETRY_BACKOFF_MS = 60_000
/** Cap on the exponent used for exponential retry backoff so an extreme
 *  `retryCount` cannot produce an unbounded delay before the per-step cap
 *  ({@link MAX_RETRY_BACKOFF_MS}) clamps the result. */
const MAX_EXPONENTIAL_ATTEMPT = 10

function computeRetryDelay(step: AgentPipeline['steps'][number], attemptNumber: number): number {
  const base = Number.isFinite(step.retryBackoffMs) ? Math.max(0, Math.trunc(step.retryBackoffMs ?? 0)) : 0
  if (base === 0) return 0
  if (step.retryBackoffStrategy === 'exponential') {
    const safeAttempt = Math.max(1, Math.min(attemptNumber, MAX_EXPONENTIAL_ATTEMPT))
    return Math.min(base * 2 ** (safeAttempt - 1), MAX_RETRY_BACKOFF_MS)
  }
  return Math.min(base, MAX_RETRY_BACKOFF_MS)
}

function delay(ms: number, abortSignal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => {
    if (abortSignal?.aborted) {
      resolve()
      return
    }
    const timer = setTimeout(() => {
      abortSignal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      resolve()
    }
    abortSignal?.addEventListener('abort', onAbort, { once: true })
  })
}

function findLatestProducedStep(previousSteps: PipelineStepRuntimeValue[]): PipelineStepRuntimeValue | undefined {
  for (let index = previousSteps.length - 1; index >= 0; index -= 1) {
    const step = previousSteps[index]
    if (step.status !== 'skipped' && (step.output || step.error)) return step
  }

  return undefined
}

function clampPipelineText(label: string, value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength).trimEnd()}\n\n[${label} truncated: ${value.length - maxLength} characters omitted]`
}

function sanitizePipelineError(raw: unknown): string {
  return sanitizeSensitiveText(raw, { maxLength: PIPELINE_ERROR_MAX_CHARS })
}

function resolvePipelineReference(
  reference: string,
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string> = {},
  contextualPreviousStep?: PipelineStepRuntimeValue,
): string | undefined {
  const normalized = reference.trim().toLowerCase()
  const previousStep = contextualPreviousStep ?? previousSteps[previousSteps.length - 1]

  if (normalized === 'previous' || normalized === 'previous.output' || normalized === 'last' || normalized === 'last.output') {
    return previousStep?.output ?? previousStep?.error
  }

  if (normalized === 'previous.error' || normalized === 'last.error') {
    return previousStep?.error
  }

  if (normalized === 'previous.input' || normalized === 'last.input') {
    return previousStep?.input
  }

  if (normalized === 'previous.task' || normalized === 'last.task') {
    return previousStep?.task
  }

  if (normalized === 'previous.status' || normalized === 'last.status') {
    return previousStep?.status
  }

  const variableMatch = reference.trim().match(VARIABLE_REFERENCE_PATTERN)
  if (variableMatch) {
    const value = variables[variableMatch[1]]
    if (value == null || value === '') return undefined
    return clampPipelineText(`Variable ${variableMatch[1]}`, value, MAX_PIPELINE_REFERENCE_CHARS)
  }

  const stepMatch = normalized.match(STEP_REFERENCE_PATTERN)
  if (!stepMatch) return undefined

  const rawIndex = Number(stepMatch[1] ?? stepMatch[2])
  if (!Number.isFinite(rawIndex) || rawIndex < 1) return undefined

  const referencedStep = previousSteps[rawIndex - 1]
  if (!referencedStep) return undefined

  const field = stepMatch[3] as 'output' | 'input' | 'task' | 'status' | 'error'
  const value = referencedStep[field]
  return value == null
    ? undefined
    : clampPipelineText(rawIndex === 1 ? 'Referenced step value' : `Step ${rawIndex} ${field}`, String(value), MAX_PIPELINE_REFERENCE_CHARS)
}

function resolvePipelineTemplate(
  task: string,
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string> = {},
  contextualPreviousStep?: PipelineStepRuntimeValue,
): { resolvedTask: string; usedReferences: boolean } {
  let usedReferences = false

  const resolvedTask = task.replace(PIPELINE_REFERENCE_PATTERN, (_match, rawReference: string) => {
    usedReferences = true
    const value = resolvePipelineReference(rawReference, previousSteps, variables, contextualPreviousStep)
    // Return value directly from function to avoid $-substitution in replacement string
    if (value == null || value === '') return `[Missing ${rawReference.trim()}]`
    return value
  })

  return { resolvedTask, usedReferences }
}

function resolvePipelineScalar(
  value: string | undefined,
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string> = {},
  contextualPreviousStep?: PipelineStepRuntimeValue,
): string | undefined {
  if (!value?.trim()) return undefined
  return resolvePipelineTemplate(value, previousSteps, variables, contextualPreviousStep).resolvedTask.trim()
}

function findStepRuntimeValue(previousSteps: PipelineStepRuntimeValue[], stepIndex: number): PipelineStepRuntimeValue | undefined {
  for (let index = previousSteps.length - 1; index >= 0; index -= 1) {
    if (previousSteps[index].stepIndex === stepIndex) return previousSteps[index]
  }
  return undefined
}

function resolveEffectivePreviousStep(
  previousSteps: PipelineStepRuntimeValue[],
  graphSteps: AgentPipeline['steps'],
  stepIndexById: Map<string, number>,
  incomingByStepId: Map<string, string[]>,
  sourceStepId?: string,
): PipelineStepRuntimeValue | undefined {
  if (!sourceStepId) return previousSteps[previousSteps.length - 1]
  const sourceIndex = stepIndexById.get(sourceStepId)
  if (sourceIndex === undefined) return previousSteps[previousSteps.length - 1]
  const sourceStep = graphSteps[sourceIndex]
  const sourceRuntime = findStepRuntimeValue(previousSteps, sourceIndex)
  if (sourceRuntime?.status === 'skipped') {
    const skippedUpstreamSourceId = incomingByStepId.get(sourceStepId)?.[0]
    if (skippedUpstreamSourceId) {
      return resolveEffectivePreviousStep(previousSteps, graphSteps, stepIndexById, incomingByStepId, skippedUpstreamSourceId) ?? sourceRuntime
    }
  }
  if (getPipelineNodeType(sourceStep) !== 'parallel') {
    return sourceRuntime ?? previousSteps[previousSteps.length - 1]
  }
  const upstreamSourceId = incomingByStepId.get(sourceStepId)?.[0]
  if (!upstreamSourceId) return sourceRuntime ?? previousSteps[previousSteps.length - 1]
  return resolveEffectivePreviousStep(previousSteps, graphSteps, stepIndexById, incomingByStepId, upstreamSourceId) ?? sourceRuntime
}

function buildStepInput(
  step: AgentPipeline['steps'][number],
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string> = {},
  contextualPreviousStep?: PipelineStepRuntimeValue,
): string {
  const { resolvedTask, usedReferences } = resolvePipelineTemplate(step.task, previousSteps, variables, contextualPreviousStep)
  const latestProducedStep = contextualPreviousStep ?? findLatestProducedStep(previousSteps)
  const previousOutput = latestProducedStep?.output ?? latestProducedStep?.error

  const input = previousOutput && !usedReferences
    ? `Previous step output:\n${clampPipelineText('Previous step output', previousOutput, MAX_PIPELINE_HANDOFF_CHARS)}\n\nCurrent step task:\n${resolvedTask}`
    : resolvedTask

  return clampPipelineText('Pipeline step input', input, step.maxInputChars ?? MAX_PIPELINE_INPUT_CHARS)
}

function resolveRunVariables(pipeline: AgentPipeline, supplied: Record<string, string> | undefined): Record<string, string> {
  const declared = pipeline.variables ?? []
  const resolved: Record<string, string> = {}
  const trimmedSupplied = Object.fromEntries(
    Object.entries(supplied ?? {}).map(([key, value]) => [key, typeof value === 'string' ? value : String(value ?? '')]),
  )

  for (const variable of declared) {
    const provided = trimmedSupplied[variable.name]
    if (provided !== undefined && provided !== '') {
      resolved[variable.name] = provided
    } else if (variable.defaultValue !== undefined) {
      resolved[variable.name] = variable.defaultValue
    } else {
      resolved[variable.name] = ''
    }
  }

  // Allow ad-hoc variables that aren't declared, but never let them clobber declared ones.
  for (const [key, value] of Object.entries(trimmedSupplied)) {
    if (!(key in resolved)) resolved[key] = value
  }

  return resolved
}

function aggregateUsage(steps: AgentPipelineExecutionStep[]): PipelineStepUsage | undefined {
  let prompt = 0
  let completion = 0
  let total = 0
  let hasUsage = false
  for (const step of steps) {
    if (!step.usage) continue
    hasUsage = true
    prompt += step.usage.promptTokens ?? 0
    completion += step.usage.completionTokens ?? 0
    total += step.usage.totalTokens ?? 0
  }
  return hasUsage ? { promptTokens: prompt, completionTokens: completion, totalTokens: total } : undefined
}

function resolveNestedPipelineVariables(
  step: AgentPipeline['steps'][number],
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string>,
  fallbackInput: string,
): Record<string, string> {
  const mapping = step.pipelineInputMapping?.trim()
  if (!mapping) {
    return { input: fallbackInput }
  }

  const nestedVariables: Record<string, string> = {}
  for (const line of mapping.split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex <= 0) continue
    const key = trimmed.slice(0, equalsIndex).trim()
    const rawValue = trimmed.slice(equalsIndex + 1).trim()
    if (!EXPORT_VAR_NAME_PATTERN.test(key)) continue
    nestedVariables[key] = resolvePipelineTemplate(rawValue, previousSteps, variables).resolvedTask
  }

  if (Object.keys(nestedVariables).length === 0) {
    nestedVariables.input = fallbackInput
  }

  return nestedVariables
}

function buildStructuralNodeOutput(step: AgentPipeline['steps'][number]): string {
  const nodeType = getPipelineNodeType(step)
  switch (nodeType) {
    case 'start':
      return 'Workflow entered the start node.'
    case 'end':
      return 'Workflow reached the end node.'
    case 'parallel':
      return `Parallel block prepared with ${step.parallelBranches ?? 2} branches (${step.parallelJoinStrategy ?? 'all'} join strategy).`
    case 'join':
      return `Joined branch outputs with ${step.joinStrategy ?? 'wait-all'} strategy.`
    default:
      return `${nodeType} node completed.`
  }
}

function isPureStructuralNode(nodeType: ReturnType<typeof getPipelineNodeType>): boolean {
  return nodeType === 'start' || nodeType === 'end' || nodeType === 'parallel' || nodeType === 'join'
}

function clampStepOutput(step: AgentPipeline['steps'][number], output: string): { output: string; warnings?: string[] } {
  const maxOutputChars = step.maxOutputChars ?? MAX_PIPELINE_HANDOFF_CHARS
  if (output.length <= maxOutputChars) return { output }
  return {
    output: clampPipelineText('Pipeline step output', output, maxOutputChars),
    warnings: [`Step output truncated from ${output.length.toLocaleString()} to ${maxOutputChars.toLocaleString()} characters.`],
  }
}

function resolveStartNodeOutput(
  step: AgentPipeline['steps'][number],
  variables: Record<string, string>,
): string {
  const params = Object.fromEntries((step.startParams ?? []).map((param) => [param.key, variables[param.key] ?? param.defaultValue ?? '']))
  return JSON.stringify(params, null, 2)
}

function resolveEndNodeOutput(
  step: AgentPipeline['steps'][number],
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string>,
): string {
  const outputs = Object.fromEntries((step.endOutputs ?? []).map((output) => [output.key, resolvePipelineScalar(output.value, previousSteps, variables) ?? '']))
  return JSON.stringify(outputs, null, 2)
}

function resolveRequestHeaders(rawHeaders: string | undefined, authType: AgentPipelineStep['httpAuthType'], authHeader: string | undefined, authValue: string | undefined, previousSteps: PipelineStepRuntimeValue[], variables: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const line of (rawHeaders ?? '').split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const separator = trimmed.indexOf(':')
    if (separator <= 0) continue
    const key = trimmed.slice(0, separator).trim()
    const value = resolvePipelineTemplate(trimmed.slice(separator + 1).trim(), previousSteps, variables).resolvedTask
    if (key && value) headers[key] = value
  }

  const resolvedHeader = resolvePipelineScalar(authHeader, previousSteps, variables)
  const resolvedValue = resolvePipelineScalar(authValue, previousSteps, variables)
  if (authType === 'bearer' && resolvedValue) {
    headers.Authorization = resolvedValue.startsWith('Bearer ') ? resolvedValue : `Bearer ${resolvedValue}`
  } else if (authType === 'basic' && resolvedValue) {
    headers.Authorization = resolvedValue.startsWith('Basic ') ? resolvedValue : `Basic ${resolvedValue}`
  } else if ((authType === 'api-key' || authType === 'custom-header') && resolvedHeader && resolvedValue) {
    headers[resolvedHeader] = resolvedValue
  }

  return headers
}

function normalizePipelineBranchKey(value: string): string {
  return value.trim().toLowerCase()
}

function getConfiguredConditionBranches(step: AgentPipeline['steps'][number]): Array<{ key: string; label: string }> {
  const configured = (step.conditionBranches ?? [])
    .map((branch) => ({ key: branch.key.trim(), label: branch.label?.trim() || branch.key.trim() }))
    .filter((branch) => branch.key)

  if (configured.length > 0) return configured

  return [
    { key: 'true', label: step.conditionTrueLabel?.trim() || 'True' },
    { key: 'false', label: step.conditionFalseLabel?.trim() || 'False' },
  ]
}

function resolveConditionTransitionHandle(output: string, step: AgentPipeline['steps'][number]): string {
  const configuredBranches = getConfiguredConditionBranches(step)
  const normalizedBranches = configuredBranches.map((branch) => ({
    key: branch.key,
    normalizedKey: normalizePipelineBranchKey(branch.key),
    normalizedLabel: normalizePipelineBranchKey(branch.label),
  }))

  const matchConfiguredBranch = (candidate: string | undefined): string | null => {
    if (!candidate?.trim()) return null
    const normalizedCandidate = normalizePipelineBranchKey(candidate)
    const matched = normalizedBranches.find((branch) => branch.normalizedKey === normalizedCandidate || branch.normalizedLabel === normalizedCandidate)
    return matched?.key ?? null
  }

  try {
    const parsed = JSON.parse(output) as unknown
    if (typeof parsed === 'boolean') return parsed ? 'true' : 'false'
    if (typeof parsed === 'string') {
      const matched = matchConfiguredBranch(parsed)
      if (matched) return matched
    }
    if (parsed && typeof parsed === 'object') {
      const candidate = parsed as Record<string, unknown>
      for (const key of ['branch', 'route', 'path', 'label', 'decision']) {
        if (typeof candidate[key] === 'string') {
          const matched = matchConfiguredBranch(candidate[key])
          if (matched) return matched
        }
      }
      for (const key of ['result', 'approved', 'matched', 'success', 'pass', 'value']) {
        if (typeof candidate[key] === 'boolean') return candidate[key] ? 'true' : 'false'
      }
    }
  } catch {
    // Fall through to string heuristics.
  }

  const matched = matchConfiguredBranch(output)
  if (matched) return matched

  const normalized = output.trim().toLowerCase()
  if (!normalized) return configuredBranches[0]?.key ?? 'true'
  if (['false', 'no', 'rejected', 'reject', 'failed', 'fail'].includes(normalized)) return 'false'
  if (['true', 'yes', 'approved', 'accept', 'passed', 'pass', 'success'].includes(normalized)) return 'true'
  return !normalized.includes('false') && !normalized.includes('reject')
    ? (configuredBranches[0]?.key ?? 'true')
    : (configuredBranches[1]?.key ?? configuredBranches[0]?.key ?? 'false')
}

function normalizeResponseHeaders(headers: Record<string, string | string[] | undefined> | undefined): Record<string, string> {
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (Array.isArray(value)) {
      normalized[key] = value.join(', ')
    } else if (typeof value === 'string') {
      normalized[key] = value
    }
  }
  return normalized
}

function parsePipelineStructuredValue(value: string | undefined): unknown {
  if (value == null) return undefined
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (
    trimmed === 'true'
    || trimmed === 'false'
    || trimmed === 'null'
    || /^-?\d+(?:\.\d+)?$/u.test(trimmed)
    || ((trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) && (trimmed.endsWith('}') || trimmed.endsWith(']') || trimmed.endsWith('"')))
  ) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return value
    }
  }
  return value
}

function stringifyPipelineStructuredValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value, null, 2)
}

function ensureNamedVariable(variables: Record<string, string>, name: string | undefined, value: unknown): void {
  const trimmed = name?.trim()
  if (!trimmed || !EXPORT_VAR_NAME_PATTERN.test(trimmed)) return
  variables[trimmed] = stringifyPipelineStructuredValue(value)
}

function getStructuredReferenceValue(
  rawExpression: string,
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string>,
  contextualPreviousStep?: PipelineStepRuntimeValue,
): unknown {
  const exactReference = rawExpression.match(EXACT_TEMPLATE_REFERENCE_PATTERN)
  if (exactReference) {
    return parsePipelineStructuredValue(resolvePipelineReference(exactReference[1], previousSteps, variables, contextualPreviousStep))
  }
  return resolvePipelineTemplate(rawExpression, previousSteps, variables, contextualPreviousStep).resolvedTask
}

function resolveInputMapping(
  rawMapping: string | undefined,
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string>,
  contextualPreviousStep?: PipelineStepRuntimeValue,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}
  for (const line of (rawMapping ?? '').split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const separator = trimmed.indexOf('=')
    if (separator <= 0) continue
    const key = trimmed.slice(0, separator).trim()
    const rawValue = trimmed.slice(separator + 1).trim()
    if (!key) continue
    resolved[key] = getStructuredReferenceValue(rawValue, previousSteps, variables, contextualPreviousStep)
  }
  return resolved
}

function buildWorkflowDataContext(
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string>,
  contextualPreviousStep?: PipelineStepRuntimeValue,
  mappedInputs: Record<string, unknown> = {},
): Record<string, unknown> {
  const stepsObject = Object.fromEntries(previousSteps.map((step) => [
    `step${step.stepIndex + 1}`,
    {
      status: step.status,
      task: step.task,
      input: parsePipelineStructuredValue(step.input),
      output: parsePipelineStructuredValue(step.output),
      error: step.error,
    },
  ]))

  return {
    ...mappedInputs,
    vars: Object.fromEntries(Object.entries(variables).map(([key, value]) => [key, parsePipelineStructuredValue(value)])),
    previous: contextualPreviousStep ? {
      status: contextualPreviousStep.status,
      task: contextualPreviousStep.task,
      input: parsePipelineStructuredValue(contextualPreviousStep.input),
      output: parsePipelineStructuredValue(contextualPreviousStep.output),
      error: contextualPreviousStep.error,
    } : null,
    steps: stepsObject,
    ...stepsObject,
  }
}

function readPathToken(target: unknown, token: string): unknown {
  if (target == null) return undefined
  if (/^\d+$/u.test(token) && Array.isArray(target)) {
    return target[Number(token)]
  }
  if (typeof target === 'object' || typeof target === 'function') {
    return (target as Record<string, unknown>)[token]
  }
  return undefined
}

function resolveTemplateExpressionValue(expression: string, context: Record<string, unknown>): unknown {
  const trimmed = expression.trim()
  if (!trimmed) return ''
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null') return null
  if (/^-?\d+(?:\.\d+)?$/u.test(trimmed)) return Number(trimmed)

  const tokens = Array.from(trimmed.matchAll(/([A-Za-z_][A-Za-z0-9_]*)|\[(\d+|"[^"]+"|'[^']+')\]/gu))
    .map((match) => match[1] ?? match[2]?.replace(/^['"]|['"]$/gu, '') ?? '')
    .filter(Boolean)

  if (tokens.length === 0) return context[trimmed]

  return tokens.reduce<unknown>((current, token, index) => index === 0 ? readPathToken(context, token) : readPathToken(current, token), context)
}

function applyTemplateFilters(value: unknown, rawFilters: string[]): string {
  let current: unknown = value
  for (const filter of rawFilters) {
    const trimmed = filter.trim()
    if (!trimmed) continue
    if (trimmed === 'upper') current = stringifyPipelineStructuredValue(current).toUpperCase()
    else if (trimmed === 'lower') current = stringifyPipelineStructuredValue(current).toLowerCase()
    else if (trimmed === 'json') current = JSON.stringify(current, null, 2)
    else if (trimmed === 'length') current = Array.isArray(current) || typeof current === 'string' ? current.length : (current && typeof current === 'object' ? Object.keys(current as Record<string, unknown>).length : 0)
    else if (trimmed.startsWith('join(') && trimmed.endsWith(')') && Array.isArray(current)) {
      const separator = trimmed.slice(5, -1).trim().replace(/^['"]|['"]$/gu, '')
      current = current.map((entry) => stringifyPipelineStructuredValue(entry)).join(separator)
    } else if (trimmed.startsWith('default(') && trimmed.endsWith(')')) {
      const fallback = trimmed.slice(8, -1).trim().replace(/^['"]|['"]$/gu, '')
      if (current == null || current === '') current = fallback
    } else if (trimmed.startsWith('round(') && trimmed.endsWith(')') && typeof current === 'number') {
      const digits = Number(trimmed.slice(6, -1).trim())
      current = Number.isFinite(digits) ? Number(current.toFixed(digits)) : current
    }
  }
  return stringifyPipelineStructuredValue(current)
}

function evaluateTemplateCondition(expression: string, context: Record<string, unknown>): boolean {
  const trimmed = expression.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('not ')) return !evaluateTemplateCondition(trimmed.slice(4), context)
  const comparison = trimmed.match(/^(.*?)\s*(==|!=|>=|<=|>|<)\s*(.*?)$/u)
  if (comparison) {
    const left = resolveTemplateExpressionValue(comparison[1], context)
    const right = resolveTemplateExpressionValue(comparison[3], context)
    switch (comparison[2]) {
      case '==': return left === right
      case '!=': return left !== right
      case '>': return Number(left) > Number(right)
      case '<': return Number(left) < Number(right)
      case '>=': return Number(left) >= Number(right)
      case '<=': return Number(left) <= Number(right)
      default: return false
    }
  }
  return Boolean(resolveTemplateExpressionValue(trimmed, context))
}

function renderStructuredTemplate(template: string, context: Record<string, unknown>): string {
  let rendered = template
  const forBlockPattern = /\{%\s*for\s+(\w+)\s+in\s+([^%]+?)\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/gu
  rendered = rendered.replace(forBlockPattern, (_match, itemName: string, sourceExpression: string, body: string) => {
    const source = resolveTemplateExpressionValue(sourceExpression, context)
    if (!Array.isArray(source)) return ''
    return source.map((item, index) => renderStructuredTemplate(body, {
      ...context,
      [itemName]: item,
      loop: { index: index + 1, index0: index, first: index === 0, last: index === source.length - 1, length: source.length },
    })).join('')
  })

  const ifBlockPattern = /\{%\s*if\s+([^%]+?)\s*%\}([\s\S]*?)(?:\{%\s*else\s*%\}([\s\S]*?))?\{%\s*endif\s*%\}/gu
  rendered = rendered.replace(ifBlockPattern, (_match, condition: string, truthyBody: string, falsyBody?: string) => (
    evaluateTemplateCondition(condition, context)
      ? renderStructuredTemplate(truthyBody, context)
      : renderStructuredTemplate(falsyBody ?? '', context)
  ))

  const variablePattern = /\{\{\s*([^}]+?)\s*\}\}/gu
  rendered = rendered.replace(variablePattern, (_match, expression: string) => {
    const [baseExpression, ...filters] = expression.split('|')
    const value = resolveTemplateExpressionValue(baseExpression, context)
    return applyTemplateFilters(value, filters)
  })

  return rendered
}

function validateCodeNodeSource(source: string): void {
  const blockedPatterns: Array<[RegExp, string]> = [
    [/\beval\s*\(/u, 'eval() is not allowed inside code nodes'],
    [/\bFunction\s*\(/u, 'Function() is not allowed inside code nodes'],
    [/\brequire\s*\(/u, 'require() is not allowed inside code nodes'],
    [/\bimport\s*\(/u, 'dynamic import() is not allowed inside code nodes'],
    [/\bfetch\s*\(/u, 'network access is not allowed inside code nodes'],
    [/\bXMLHttpRequest\b/u, 'network access is not allowed inside code nodes'],
    [/\bWebSocket\b/u, 'network access is not allowed inside code nodes'],
    [/\bprocess\b/u, 'process access is not allowed inside code nodes'],
    [/\bglobalThis\b/u, 'global object access is not allowed inside code nodes'],
    [/\bwindow\b/u, 'browser globals are not allowed inside code nodes'],
    [/\bdocument\b/u, 'browser globals are not allowed inside code nodes'],
  ]

  for (const [pattern, message] of blockedPatterns) {
    if (pattern.test(source)) {
      throw new Error(message)
    }
  }
}

async function executeCodeInSandbox(source: string, inputs: Record<string, unknown>, timeoutMs: number): Promise<unknown> {
  validateCodeNodeSource(source)

  const blockedDeclarations = CODE_NODE_BLOCKED_GLOBALS
    .map((name) => `const ${name} = undefined;`)
    .join('\n')

  const runner = new Function(
    'inputs',
    'JSON',
    'Math',
    'Date',
    'Array',
    'Object',
    'Number',
    'String',
    'Boolean',
    'RegExp',
    `"use strict";
${blockedDeclarations}
${source}
if (typeof main !== 'function') throw new Error('Code node must define function main(inputs)')
return Promise.resolve(main(inputs));`,
  ) as (
    inputs: Record<string, unknown>,
    JSONValue: JSON,
    MathValue: Math,
    DateValue: DateConstructor,
    ArrayValue: ArrayConstructor,
    ObjectValue: ObjectConstructor,
    NumberValue: NumberConstructor,
    StringValue: StringConstructor,
    BooleanValue: BooleanConstructor,
    RegExpValue: RegExpConstructor,
  ) => Promise<unknown>

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      runner(inputs, JSON, Math, Date, Array, Object, Number, String, Boolean, RegExp),
      new Promise<never>((_resolve, reject) => {
        timeoutId = globalThis.setTimeout(() => reject(new Error(`Code node timed out after ${timeoutMs}ms`)), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) globalThis.clearTimeout(timeoutId)
  }
}

function resolveDelimitedPairs(rawBody: string): Array<[string, string]> {
  return rawBody
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const separator = line.indexOf('=')
      if (separator <= 0) return []
      return [[line.slice(0, separator).trim(), line.slice(separator + 1).trim()] as [string, string]]
    })
}

function resolveRequestBody(
  rawBody: string | undefined,
  bodyType: AgentPipelineStep['httpBodyType'],
  headers: Record<string, string>,
): string | undefined {
  if (!rawBody?.trim()) return undefined

  if (bodyType === 'form') {
    let pairs = resolveDelimitedPairs(rawBody)
    if (pairs.length === 0) {
      const parsed = JSON.parse(rawBody) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Form request body must be newline-separated key=value pairs or a JSON object')
      }
      pairs = Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, String(value ?? '')])
    }
    if (!Object.keys(headers).some((name) => name.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=utf-8'
    }
    return new URLSearchParams(pairs).toString()
  }

  if (bodyType === 'json') {
    const parsed = JSON.parse(rawBody) as unknown
    if (!Object.keys(headers).some((name) => name.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/json'
    }
    return JSON.stringify(parsed)
  }

  if (!Object.keys(headers).some((name) => name.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = 'text/plain; charset=utf-8'
  }
  return rawBody
}

function parseSuccessStatuses(raw: string | undefined): Set<number> {
  const statuses = new Set<number>()
  for (const token of (raw ?? '').split(/[\s,]+/u)) {
    const trimmed = token.trim()
    if (!trimmed) continue
    const value = Number(trimmed)
    if (Number.isInteger(value) && value > 0) statuses.add(value)
  }
  return statuses
}

function shouldTreatHttpStatusAsError(status: number, rawSuccessStatuses: string | undefined, strictMode: boolean | undefined): boolean {
  const explicitSuccessStatuses = parseSuccessStatuses(rawSuccessStatuses)
  if (explicitSuccessStatuses.size > 0) return !explicitSuccessStatuses.has(status)
  if (strictMode === true) return status < 200 || status >= 300
  return false
}

function applyResponseVariables(
  response: { body: string; status: number; headers: Record<string, string>; size: number },
  variables: Record<string, string>,
  mappings: { body?: string; status?: string; headers?: string; size?: string },
): void {
  ensureNamedVariable(variables, mappings.body, response.body)
  ensureNamedVariable(variables, mappings.status, String(response.status))
  ensureNamedVariable(variables, mappings.headers, JSON.stringify(response.headers, null, 2))
  ensureNamedVariable(variables, mappings.size, String(response.size))
}

async function executeCodeNode(
  step: AgentPipeline['steps'][number],
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string>,
  contextualPreviousStep?: PipelineStepRuntimeValue,
): Promise<{ output: string; warnings?: string[] }> {
  if ((step.codeLanguage ?? 'javascript') !== 'javascript') {
    throw new Error(`Code node language not supported yet: ${step.codeLanguage}`)
  }
  if (!step.codeSource?.trim()) {
    throw new Error('Code node source is missing')
  }
  const mappedInputs = resolveInputMapping(step.codeInputMapping, previousSteps, variables, contextualPreviousStep)
  const context = buildWorkflowDataContext(previousSteps, variables, contextualPreviousStep, mappedInputs)
  const resolved = await executeCodeInSandbox(step.codeSource, context, Math.min(step.timeoutMs ?? 5000, 15000))
  const declaredOutputs = (step.codeOutputSchema ?? '').split(',').map((value) => value.trim()).filter(Boolean)
  if (resolved && typeof resolved === 'object' && !Array.isArray(resolved)) {
    if (declaredOutputs.length > 0) {
      const missingKeys = declaredOutputs.filter((key) => !(key in (resolved as Record<string, unknown>)))
      if (missingKeys.length > 0) {
        throw new Error(`Code node result is missing declared outputs: ${missingKeys.join(', ')}`)
      }
    }
    for (const [key, value] of Object.entries(resolved as Record<string, unknown>)) {
      ensureNamedVariable(variables, key, value)
    }
    const entries = Object.entries(resolved as Record<string, unknown>)
    if ('result' in (resolved as Record<string, unknown>)) {
      return { output: stringifyPipelineStructuredValue((resolved as Record<string, unknown>).result) }
    }
    if (entries.length === 1) {
      return { output: stringifyPipelineStructuredValue(entries[0][1]) }
    }
  }

  return { output: stringifyPipelineStructuredValue(resolved) }
}

function executeTemplateNode(
  step: AgentPipeline['steps'][number],
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string>,
  contextualPreviousStep?: PipelineStepRuntimeValue,
): { output: string; warnings?: string[] } {
  if (!step.templateBody?.trim()) {
    throw new Error('Template body is missing')
  }
  const mappedInputs = resolveInputMapping(step.templateInputMapping, previousSteps, variables, contextualPreviousStep)
  const context = buildWorkflowDataContext(previousSteps, variables, contextualPreviousStep, mappedInputs)
  return { output: renderStructuredTemplate(step.templateBody, context) }
}

function executeVariableNode(
  step: AgentPipeline['steps'][number],
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string>,
  contextualPreviousStep?: PipelineStepRuntimeValue,
): { output: string; warnings?: string[] } {
  const assignments = step.variableAssignments ?? []
  if (assignments.length === 0) {
    throw new Error('Variable assignments are missing')
  }

  const applied: Record<string, unknown> = {}
  for (const assignment of assignments) {
    const variableName = assignment.variable.trim()
    if (!EXPORT_VAR_NAME_PATTERN.test(variableName)) {
      throw new Error(`Variable assignment name is invalid: ${assignment.variable}`)
    }
    if (assignment.mode === 'clear') {
      delete variables[variableName]
      applied[variableName] = null
      continue
    }

    const resolvedValue = getStructuredReferenceValue(assignment.value ?? '', previousSteps, variables, contextualPreviousStep)
    if (assignment.mode === 'overwrite') {
      ensureNamedVariable(variables, variableName, resolvedValue)
      applied[variableName] = resolvedValue
      continue
    }

    const currentValue = parsePipelineStructuredValue(variables[variableName])
    const nextArray = Array.isArray(currentValue) ? [...currentValue] : (currentValue == null || currentValue === '' ? [] : [currentValue])
    if (assignment.mode === 'append') {
      nextArray.push(resolvedValue)
      ensureNamedVariable(variables, variableName, nextArray)
      applied[variableName] = nextArray
      continue
    }

    if (!Array.isArray(resolvedValue)) {
      throw new Error(`Variable assignment ${variableName} requires an array value for extend mode`)
    }
    nextArray.push(...resolvedValue)
    ensureNamedVariable(variables, variableName, nextArray)
    applied[variableName] = nextArray
  }

  return { output: JSON.stringify(applied, null, 2) }
}

function normalizeIterationItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    const parsed = parsePipelineStructuredValue(value)
    if (Array.isArray(parsed)) return parsed
  }
  throw new Error('Iteration source must resolve to an array value')
}

function buildIterationChildVariables(
  step: AgentPipeline['steps'][number],
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string>,
  item: unknown,
  index: number,
  contextualPreviousStep?: PipelineStepRuntimeValue,
): Record<string, string> {
  const itemVar = step.iterationItemVar?.trim() || 'item'
  const indexVar = step.iterationIndexVar?.trim() || 'index'
  const scopedVariables = {
    ...variables,
    [itemVar]: stringifyPipelineStructuredValue(item),
    [indexVar]: String(index),
  }
  const mappedInputs = resolveInputMapping(step.iterationInputMapping, previousSteps, scopedVariables, contextualPreviousStep)
  const childVariables: Record<string, string> = {
    [itemVar]: stringifyPipelineStructuredValue(item),
    [indexVar]: String(index),
  }

  for (const [key, value] of Object.entries(mappedInputs)) {
    childVariables[key] = stringifyPipelineStructuredValue(value)
  }

  return childVariables
}

async function executeIterationNode(
  step: AgentPipeline['steps'][number],
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string>,
  contextualPreviousStep: PipelineStepRuntimeValue | undefined,
  options: ExecuteAgentPipelineOptions,
  pipelineCallStack: string[],
): Promise<{ output: string; warnings?: string[] }> {
  const sourceValue = getStructuredReferenceValue(step.iterationSource ?? '', previousSteps, variables, contextualPreviousStep)
  const items = normalizeIterationItems(sourceValue)
  const targetReference = resolvePipelineScalar(step.iterationPipelineTargetId, previousSteps, variables, contextualPreviousStep)
  if (!targetReference) throw new Error('Iteration child pipeline is missing')
  const targetPipeline = await findPipelineByReference(targetReference)
  if (!targetPipeline) throw new Error(`Iteration child pipeline not found: ${targetReference}`)
  if (pipelineCallStack.includes(targetPipeline.id)) {
    throw new Error(`Recursive pipeline call detected: ${targetPipeline.name}`)
  }

  const results: unknown[] = []
  const failures: Array<{ index: number; error: string }> = []
  const errorMode = step.iterationErrorMode ?? 'terminate'

  const runSingle = async (item: unknown, index: number) => {
    const childVariables = buildIterationChildVariables(step, previousSteps, variables, item, index, contextualPreviousStep)
    const execution = await executeAgentPipeline(targetPipeline, {
      ...options,
      persistExecution: false,
      persistLastRun: false,
      onStepUpdate: undefined,
      variables: childVariables,
      pipelineCallStack,
    })
    if (execution.status === 'error') {
      const message = execution.error || `Iteration item ${index} failed`
      if (errorMode === 'terminate') throw new Error(`Iteration item ${index} failed: ${message}`)
      failures.push({ index, error: message })
      if (errorMode === 'continue') results[index] = null
      return
    }

    const finalValue = parsePipelineStructuredValue(execution.finalOutput ?? '')
    if (errorMode === 'remove-failed') results.push(finalValue)
    else results[index] = finalValue
  }

  if ((step.iterationMode ?? 'sequential') === 'parallel') {
    await Promise.all(items.map((item, index) => runSingle(item, index)))
  } else {
    for (const [index, item] of items.entries()) {
      await runSingle(item, index)
    }
  }

  const warnings = failures.length > 0
    ? [`Iteration completed with ${failures.length} failed item(s): ${failures.map((failure) => `#${failure.index + 1}`).join(', ')}`]
    : undefined

  return { output: JSON.stringify(results, null, 2), ...(warnings ? { warnings } : {}) }
}

function buildStructuredRequestOutput(response: {
  url: string
  method: string
  status: number
  body: string
  headers: Record<string, string>
  size: number
}): string {
  return JSON.stringify(response, null, 2)
}

function findLatestStepOutput(previousSteps: PipelineStepRuntimeValue[], stepIndex: number): string | undefined {
  for (let index = previousSteps.length - 1; index >= 0; index -= 1) {
    const step = previousSteps[index]
    if (step.stepIndex === stepIndex) {
      return step.output ?? step.error
    }
  }
  return undefined
}

function resolveJoinNodeOutput(
  step: AgentPipeline['steps'][number],
  previousSteps: PipelineStepRuntimeValue[],
  incomingStepIndices: number[],
): string {
  const outputs = incomingStepIndices
    .map((stepIndex) => findLatestStepOutput(previousSteps, stepIndex))
    .filter((value): value is string => Boolean(value))

  if (step.joinStrategy === 'merge-output') {
    return `Joined branch outputs with merge-output strategy.\n\n${JSON.stringify({ merged: outputs }, null, 2)}`
  }
  if (step.joinStrategy === 'first-success') {
    return outputs[0] ?? 'Joined first available branch output.'
  }
  return `Joined ${outputs.length} branch output(s) with ${step.joinStrategy ?? 'wait-all'} strategy.`
}

function resolveNextTransitionTargetIds(
  step: AgentPipeline['steps'][number],
  latestOutput: string,
  outcome: 'success' | 'error' = 'success',
): string[] {
  const transitions = outcome === 'error'
    ? ((step.transitions ?? []).filter((transition) => transition.sourceHandle === 'error')
      || [])
    : (step.transitions ?? []).filter((transition) => transition.sourceHandle !== 'error')

  const resolvedTransitions = transitions.length > 0 || outcome !== 'error'
    ? transitions
    : (step.transitions ?? []).filter((transition) => transition.sourceHandle !== 'error')

  if (resolvedTransitions.length === 0) return []

  if (getPipelineNodeType(step) === 'condition') {
    const preferredHandle = resolveConditionTransitionHandle(latestOutput, step)
    const normalizedPreferredHandle = normalizePipelineBranchKey(preferredHandle)
    const selected = resolvedTransitions.filter((transition) => {
      const handle = transition.sourceHandle?.trim()
      const label = transition.label?.trim()
      return normalizePipelineBranchKey(handle ?? label ?? '') === normalizedPreferredHandle
    })

    if (selected.length > 0) return selected.map((transition) => transition.targetStepId)

    const fallback = resolvedTransitions.find((transition) => transition.sourceHandle === preferredHandle)
      ?? resolvedTransitions[0]
    return fallback ? [fallback.targetStepId] : []
  }

  if (getPipelineNodeType(step) === 'parallel') {
    return resolvedTransitions.map((transition) => transition.targetStepId)
  }

  return resolvedTransitions.slice(0, 1).map((transition) => transition.targetStepId)
}

async function executeHttpNode(
  step: AgentPipeline['steps'][number],
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string>,
): Promise<{ output: string; warnings?: string[] }> {
  const rawUrl = resolvePipelineScalar(step.httpUrl, previousSteps, variables)
  if (!rawUrl) {
    throw new Error('HTTP request URL is missing')
  }
  const headers = resolveRequestHeaders(step.httpHeaders, step.httpAuthType, step.httpAuthHeader, step.httpAuthValue, previousSteps, variables)
  const body = resolveRequestBody(resolvePipelineScalar(step.httpBody, previousSteps, variables), step.httpBodyType, headers)
  if (step.httpAsync) {
    const response = await window.electron.invoke('web:requestAsync', {
      url: rawUrl,
      method: step.httpMethod ?? 'GET',
      headers,
      body,
      timeoutMs: step.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS,
    }) as { queued?: boolean; error?: string; method?: string }
    if (response?.error) {
      throw new Error(response.error)
    }
    return { output: `Queued ${response?.method ?? step.httpMethod ?? 'GET'} ${rawUrl} asynchronously.` }
  }
  const requiresStructuredResponse = Boolean(
    step.httpTreatNon2xxAsError
    || step.httpSuccessStatuses?.trim()
    || step.httpResponseBodyVar?.trim()
    || step.httpResponseStatusVar?.trim()
    || step.httpResponseHeadersVar?.trim()
    || step.httpResponseSizeVar?.trim(),
  )
  const isSimpleFetch = (step.httpMethod ?? 'GET') === 'GET' && Object.keys(headers).length === 0 && !body && !step.httpAsync && !requiresStructuredResponse
  const response = isSimpleFetch
    ? await window.electron.invoke('web:fetchText', rawUrl) as { content?: string; truncated?: boolean; error?: string; status?: number; headers?: Record<string, string | string[] | undefined> }
    : await window.electron.invoke('web:request', {
        url: rawUrl,
        method: step.httpMethod ?? 'GET',
        headers,
        body,
        timeoutMs: step.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS,
      }) as { content?: string; truncated?: boolean; error?: string; status?: number; headers?: Record<string, string | string[] | undefined> }
  if (response?.error) {
    throw new Error(response.error)
  }
  const responseBody = response?.content ?? ''
  const responseStatus = response?.status ?? 200
  const responseHeaders = normalizeResponseHeaders(response?.headers)
  const responseSize = responseBody.length
  if (shouldTreatHttpStatusAsError(responseStatus, step.httpSuccessStatuses, step.httpTreatNon2xxAsError)) {
    throw new Error(`HTTP ${responseStatus} ${rawUrl}${responseBody ? `\n${responseBody}` : ''}`)
  }
  applyResponseVariables({ body: responseBody, status: responseStatus, headers: responseHeaders, size: responseSize }, variables, {
    body: step.httpResponseBodyVar,
    status: step.httpResponseStatusVar,
    headers: step.httpResponseHeadersVar,
    size: step.httpResponseSizeVar,
  })
  return {
    output: step.httpCaptureResponse === false
      ? `HTTP ${responseStatus} ${rawUrl}`
      : (isSimpleFetch
          ? responseBody
          : buildStructuredRequestOutput({
              url: rawUrl,
              method: step.httpMethod ?? 'GET',
              status: responseStatus,
              body: responseBody,
              headers: responseHeaders,
              size: responseSize,
            })),
    ...(response?.truncated ? { warnings: ['HTTP response was truncated by the desktop bridge.'] } : {}),
  }
}

function resolveWebhookTarget(step: AgentPipeline['steps'][number]): string | undefined {
  if (step.webhookUrl?.trim()) return step.webhookUrl.trim()
  if (!step.webhookChannelId?.trim()) return undefined
  const channel = useAppStore.getState().channels.find((item) => item.id === step.webhookChannelId)
  return channel?.customWebhookUrl?.trim() || channel?.wechatPersonalWebhookUrl?.trim() || undefined
}

async function executeWebhookNode(
  step: AgentPipeline['steps'][number],
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string>,
): Promise<{ output: string; warnings?: string[] }> {
  const rawUrl = resolvePipelineScalar(resolveWebhookTarget(step), previousSteps, variables)
  if (!rawUrl) {
    throw new Error('Webhook target URL is missing')
  }
  const headers = resolveRequestHeaders(step.webhookHeaders, step.webhookAuthType, step.webhookAuthHeader, step.webhookAuthValue, previousSteps, variables)
  const body = resolveRequestBody(resolvePipelineScalar(step.webhookBody, previousSteps, variables), step.webhookBodyType, headers)
  if (step.webhookAsync) {
    const response = await window.electron.invoke('web:requestAsync', {
      url: rawUrl,
      method: step.webhookMethod ?? 'POST',
      headers,
      body,
      timeoutMs: step.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS,
    }) as { queued?: boolean; error?: string; method?: string }
    if (response?.error) {
      throw new Error(response.error)
    }
    return { output: `Queued webhook ${response?.method ?? step.webhookMethod ?? 'POST'} ${rawUrl} asynchronously.` }
  }
  const response = await window.electron.invoke('web:request', {
    url: rawUrl,
    method: step.webhookMethod ?? 'POST',
    headers,
    body,
    timeoutMs: step.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS,
  }) as { content?: string; truncated?: boolean; error?: string; status?: number; headers?: Record<string, string | string[] | undefined> }
  if (response?.error) {
    throw new Error(response.error)
  }
  const responseBody = response?.content ?? ''
  const responseStatus = response?.status ?? 200
  const responseHeaders = normalizeResponseHeaders(response?.headers)
  const responseSize = responseBody.length
  if (shouldTreatHttpStatusAsError(responseStatus, step.webhookSuccessStatuses, step.webhookTreatNon2xxAsError ?? true)) {
    throw new Error(`Webhook ${responseStatus} ${rawUrl}${responseBody ? `\n${responseBody}` : ''}`)
  }
  applyResponseVariables({ body: responseBody, status: responseStatus, headers: responseHeaders, size: responseSize }, variables, {
    body: step.webhookResponseBodyVar,
    status: step.webhookResponseStatusVar,
    headers: step.webhookResponseHeadersVar,
    size: step.webhookResponseSizeVar,
  })
  return {
    output: step.webhookCaptureResponse === false
      ? `Webhook ${responseStatus} ${rawUrl}`
      : buildStructuredRequestOutput({
          url: rawUrl,
          method: step.webhookMethod ?? 'POST',
          status: responseStatus,
          body: responseBody,
          headers: responseHeaders,
          size: responseSize,
        }),
    ...(response?.truncated ? { warnings: ['Webhook response was truncated by the desktop bridge.'] } : {}),
  }
}

async function executeToolsetNode(
  step: AgentPipeline['steps'][number],
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string>,
): Promise<{ output: string; warnings?: string[] }> {
  const toolsetId = step.toolsetId?.trim()
  if (!toolsetId) throw new Error('Toolset id is missing')
  const toolName = step.toolName?.trim()
  if (!toolName) throw new Error('Tool name is missing')
  const toolSet = getPluginToolsFor(toolsetId)
  const toolDefinition = toolSet[toolName] as { execute?: (input: unknown) => Promise<unknown> | unknown } | undefined
  if (!toolDefinition?.execute) {
    throw new Error(`Tool not available in toolset ${toolsetId}: ${toolName}`)
  }
  const resolvedInput = resolvePipelineTemplate(step.toolInput ?? '{}', previousSteps, variables).resolvedTask
  let parsedInput: unknown = {}
  try {
    parsedInput = resolvedInput.trim() ? JSON.parse(resolvedInput) : {}
  } catch (error) {
    throw new Error(`Tool input JSON is invalid: ${(error as Error).message}`)
  }
  const result = await toolDefinition.execute(parsedInput)
  return {
    output: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
  }
}

function executeDocumentRetrievalNode(
  step: AgentPipeline['steps'][number],
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string>,
  mode: 'rag' | 'wiki',
): { output: string; warnings?: string[] } {
  const query = resolvePipelineScalar(mode === 'rag' ? step.ragQuery : step.wikiQuery, previousSteps, variables)
  const groupIds = [
    ...(mode === 'rag' ? (step.ragKnowledgeBaseIds ?? []) : (step.wikiIds ?? [])),
    mode === 'rag' ? step.ragKnowledgeBaseId ?? '' : step.wikiId ?? '',
  ].map((value) => value.trim()).filter(Boolean)
  if (groupIds.length === 0 || !query?.trim()) {
    throw new Error(mode === 'rag' ? 'Knowledge base or query is missing' : 'Wiki or query is missing')
  }
  const { documentNodes } = useAppStore.getState()
  const threshold = mode === 'rag' ? step.ragScoreThreshold : step.wikiScoreThreshold
  const metadataFilter = (mode === 'rag' ? step.ragMetadataFilter : step.wikiMetadataFilter)?.trim()
  const normalizedFilters = (metadataFilter ?? '')
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter((token) => token.includes(':'))
    .map((token) => {
      const separator = token.indexOf(':')
      return {
        key: token.slice(0, separator).trim().toLowerCase(),
        value: token.slice(separator + 1).trim().toLowerCase(),
      }
    })

  const matchesMetadataFilter = (result: ReturnType<typeof searchDocuments>[number]): boolean => {
    if (normalizedFilters.length === 0) return true
    const tags = result.tags.map((tag) => tag.toLowerCase())
    const title = result.node.title.toLowerCase()
    const path = result.path.toLowerCase()
    const id = result.node.id.toLowerCase()
    return normalizedFilters.every((filter) => {
      if (!filter.value) return true
      if (filter.key === 'tag' || filter.key === 'tags') return tags.some((tag) => tag.includes(filter.value))
      if (filter.key === 'title') return title.includes(filter.value)
      if (filter.key === 'path') return path.includes(filter.value)
      if (filter.key === 'id') return id === filter.value
      return false
    })
  }

  const results = groupIds
    .flatMap((groupId) => searchDocuments(documentNodes, groupId, query).map((result) => ({ ...result, groupId })))
    .filter((result, index, allResults) => allResults.findIndex((candidate) => candidate.node.id === result.node.id) === index)
    .filter((result) => threshold == null || result.score >= threshold)
    .filter(matchesMetadataFilter)
    .slice(0, mode === 'rag' ? (step.ragTopK ?? 5) : (step.wikiTopK ?? 5))
  return {
    output: JSON.stringify({
      query,
      knowledgeBaseIds: groupIds,
      metadataFilter: metadataFilter || undefined,
      results: results.map((result) => ({
        id: result.node.id,
        title: result.node.title,
        path: result.path,
        excerpt: result.excerpt,
        score: result.score,
        tags: result.tags,
      })),
    }, null, 2),
    ...(results.length === 0 ? { warnings: [`No ${mode === 'rag' ? 'knowledge-base' : 'wiki'} results matched the query.`] } : {}),
  }
}

async function executeScriptNode(
  step: AgentPipeline['steps'][number],
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string>,
): Promise<{ output: string; warnings?: string[] }> {
  const scriptPath = resolvePipelineScalar(step.scriptPath, previousSteps, variables)
  if (!scriptPath) {
    throw new Error('Script path is missing')
  }
  const runtime = step.scriptRuntime ?? 'javascript'
  let command = ''
  if (runtime === 'javascript' || runtime === 'typescript') {
    command = `node "${scriptPath}"`
  } else if (runtime === 'nodejs') {
    command = `node "${scriptPath}"${step.scriptArgs?.trim() ? ` ${step.scriptArgs.trim()}` : ''}`
  } else if (runtime === 'python') {
    command = `python "${scriptPath}"${step.scriptArgs?.trim() ? ` ${step.scriptArgs.trim()}` : ''}`
  } else if (runtime === 'shell' || runtime === 'bash' || runtime === 'powershell') {
    command = `"${scriptPath}"${step.scriptArgs?.trim() ? ` ${step.scriptArgs.trim()}` : ''}`
  } else {
    throw new Error(`Script runtime not supported yet: ${runtime}`)
  }
  const result = await window.electron.invoke('shell:exec', command) as { stdout?: string; stderr?: string; error?: string }
  if (result?.error) {
    throw new Error(result.error)
  }
  const output = (result?.stdout || result?.stderr || '').trim()
  const requiredKeys = (step.scriptOutputSchema ?? '').split(',').map((key) => key.trim()).filter(Boolean)
  if (requiredKeys.length > 0) {
    let parsed: unknown
    try {
      parsed = JSON.parse(output)
    } catch {
      throw new Error(`Script output must be valid JSON with keys: ${requiredKeys.join(', ')}`)
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`Script output must be a JSON object with keys: ${requiredKeys.join(', ')}`)
    }
    const missingKeys = requiredKeys.filter((key) => !(key in (parsed as Record<string, unknown>)))
    if (missingKeys.length > 0) {
      throw new Error(`Script output is missing required keys: ${missingKeys.join(', ')}`)
    }
  }
  return { output }
}

async function executeEmailNode(
  step: AgentPipeline['steps'][number],
  input: string,
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string>,
): Promise<{ output: string; warnings?: string[] }> {
  const state = useAppStore.getState()
  const emailConfig = state.emailConfig
  if (!emailConfig?.enabled) {
    throw new Error('Global email configuration is disabled')
  }
  if (!emailConfig.smtpHost || !emailConfig.fromAddress) {
    throw new Error('Global email configuration is incomplete')
  }
  const to = resolvePipelineScalar(step.emailTo, previousSteps, variables)
  const subject = resolvePipelineScalar(step.emailSubject, previousSteps, variables)
  if (!to || !subject) {
    throw new Error('Email recipient or subject is missing')
  }
  const result = await window.electron.invoke('email:send', {
    smtpHost: emailConfig.smtpHost,
    smtpPort: emailConfig.smtpPort,
    secure: emailConfig.secure,
    username: emailConfig.username,
    password: emailConfig.password,
    fromName: emailConfig.fromName,
    fromAddress: emailConfig.fromAddress,
  }, {
    to,
    subject,
    body: input,
    cc: resolvePipelineScalar(step.emailCc, previousSteps, variables) || undefined,
    bcc: undefined,
    isHtml: false,
  }) as { success?: boolean; messageId?: string; error?: string }
  if (!result?.success) {
    throw new Error(result?.error || 'Email delivery failed')
  }
  return { output: `Email sent to ${to}${result.messageId ? ` (${result.messageId})` : ''}` }
}

function createStepAbortSignal(parentSignal: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; cleanup: () => void; timedOut: () => boolean } {
  const controller = new AbortController()
  let didTimeOut = false
  const timeout = window.setTimeout(() => {
    didTimeOut = true
    controller.abort()
  }, timeoutMs)
  const abortFromParent = () => controller.abort()
  parentSignal?.addEventListener('abort', abortFromParent, { once: true })
  return {
    signal: controller.signal,
    cleanup: () => {
      window.clearTimeout(timeout)
      parentSignal?.removeEventListener('abort', abortFromParent)
    },
    timedOut: () => didTimeOut,
  }
}

function requiresStreaming(tools: Record<string, unknown>, hasStepUpdates: boolean): boolean {
  return hasStepUpdates || Object.keys(tools).length > 0
}

function resolvePipelineModel(
  agent: Agent,
  models: Model[],
  step?: Pick<AgentPipeline['steps'][number], 'modelId'>,
): Model | undefined {
  // 1. Step-level override wins when the model exists and is enabled.
  if (step?.modelId) {
    const overridden = models.find((model) => model.id === step.modelId)
    if (overridden && overridden.enabled !== false) return overridden
    // If the override is missing/disabled fall through to the agent default
    // so the run does not silently break when a model is removed later.
  }
  if (agent.modelId) {
    const agentModel = models.find((model) => model.id === agent.modelId)
    if (agentModel && agentModel.enabled !== false) return agentModel
  }

  return models.find((model) => model.isDefault) ?? models[0]
}

async function persistPipelineRunMetadata(pipelineId: string, completedAt: number): Promise<void> {
  const state = useAppStore.getState()
  const existingPipeline = state.agentPipelines.find((pipeline) => pipeline.id === pipelineId)
  if (!existingPipeline) return

  const updatedPipeline: AgentPipeline = {
    ...existingPipeline,
    lastRunAt: completedAt,
    updatedAt: Math.max(existingPipeline.updatedAt, completedAt),
  }

  state.updateAgentPipeline(pipelineId, {
    lastRunAt: updatedPipeline.lastRunAt,
    updatedAt: updatedPipeline.updatedAt,
  })

  if (state.workspacePath) {
    await flushPendingSplitStoreWrites().catch(() => {})
  }
}

async function buildPipelineExecutionContext(agent: Agent) {
  const state = useAppStore.getState()
  const allSkills = mergeSkillsWithBuiltins((state.skills ?? []) as Skill[])
  const tools = getToolsForAgent(agent.skills, allSkills, {
    allowedTools: agent.allowedTools,
    disallowedTools: agent.disallowedTools,
    permissionMode: agent.permissionMode as 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions' | undefined,
    errorContext: {
      agentId: agent.id,
      skillIds: agent.skills,
      source: 'pipeline',
    },
  })
  const skillPrompts = await getSkillSystemPrompts(agent.skills, allSkills)
  const systemPrompt = buildSystemPrompt({
    agentPrompt: agent.systemPrompt,
    responseStyle: agent.responseStyle,
    memories: agent.memories,
    skillPrompts,
    toolNames: Object.keys(tools),
    permissionMode: agent.permissionMode,
  }) ?? agent.systemPrompt

  return {
    systemPrompt,
    tools,
  }
}

async function loadAvailablePipelines(): Promise<AgentPipeline[]> {
  const state = useAppStore.getState()
  if (state.agentPipelines.length > 0) {
    return state.agentPipelines
  }

  if (!state.workspacePath) {
    return []
  }

  const diskPipelines = await loadPipelinesFromDisk(state.workspacePath)
  state.setAgentPipelines(diskPipelines)
  return diskPipelines
}

export async function listSavedPipelines(): Promise<AgentPipeline[]> {
  return loadAvailablePipelines()
}

export async function findPipelineByReference(reference: string): Promise<AgentPipeline | null> {
  const normalizedReference = reference.trim().replace(/^['"]|['"]$/g, '')
  if (!normalizedReference) return null

  const pipelines = await loadAvailablePipelines()
  if (pipelines.length === 0) return null

  const exactIdMatch = pipelines.find((pipeline) => pipeline.id === normalizedReference)
  if (exactIdMatch) return exactIdMatch

  const lowerReference = normalizedReference.toLowerCase()
  const exactNameMatch = pipelines.find((pipeline) => pipeline.name.toLowerCase() === lowerReference)
  if (exactNameMatch) return exactNameMatch

  const partialMatches = pipelines.filter((pipeline) => pipeline.name.toLowerCase().includes(lowerReference))
  return partialMatches.length === 1 ? partialMatches[0] : null
}

export type PipelineReferenceResolution =
  | { status: 'found'; pipeline: AgentPipeline }
  | { status: 'ambiguous'; reference: string; matches: AgentPipeline[] }
  | { status: 'missing'; reference: string }

export async function resolvePipelineByReference(reference: string): Promise<PipelineReferenceResolution> {
  const normalizedReference = reference.trim().replace(/^['"]|['"]$/g, '')
  if (!normalizedReference) return { status: 'missing', reference }

  const pipelines = await loadAvailablePipelines()
  if (pipelines.length === 0) return { status: 'missing', reference: normalizedReference }

  const exactIdMatch = pipelines.find((pipeline) => pipeline.id === normalizedReference)
  if (exactIdMatch) return { status: 'found', pipeline: exactIdMatch }

  const lowerReference = normalizedReference.toLowerCase()
  const exactNameMatch = pipelines.find((pipeline) => pipeline.name.toLowerCase() === lowerReference)
  if (exactNameMatch) return { status: 'found', pipeline: exactNameMatch }

  const partialMatches = pipelines.filter((pipeline) => pipeline.name.toLowerCase().includes(lowerReference))
  if (partialMatches.length === 1) return { status: 'found', pipeline: partialMatches[0] }
  if (partialMatches.length > 1) return { status: 'ambiguous', reference: normalizedReference, matches: partialMatches }
  return { status: 'missing', reference: normalizedReference }
}

async function executeAgentPipelineLegacy(
  pipeline: AgentPipeline,
  options: ExecuteAgentPipelineOptions = {},
): Promise<AgentPipelineExecution> {
  const runtimeStateAtStart = useAppStore.getState()
  const executionStart = Date.now()
  const runId = generateId('run')
  const executionSteps: AgentPipelineExecutionStep[] = []
  const executionContextCache = new Map<string, ReturnType<typeof buildPipelineExecutionContext>>()
  const initializedProviders = new Set<string>()
  const variables = resolveRunVariables(pipeline, options.variables)
  const visitedStepIds: string[] = []
  const visitedStepIndices: number[] = []
  let previousOutput = ''
  let didFail = false
  let executionError: string | undefined

  const validation = validateAgentPipeline(pipeline, runtimeStateAtStart.agents, runtimeStateAtStart.models)
  if (!validation.valid) {
    const completedAt = Date.now()
    const steps = pipeline.steps.map((step, index): AgentPipelineExecutionStep => {
      const stepErrors = validation.errors.filter((issue) => issue.stepIndex === index)
      const error = stepErrors.length > 0
        ? stepErrors.map((issue) => issue.message).join('\n')
        : 'Skipped because pipeline validation failed'
      return {
        id: generateId('pipe-step'),
        runId,
        stepIndex: index,
        agentId: step.agentId,
        ...(step.name?.trim() ? { name: step.name.trim() } : {}),
        task: step.task,
        input: '',
        status: stepErrors.length > 0 ? 'error' : 'skipped',
        startedAt: completedAt,
        completedAt,
        durationMs: 0,
        attempts: 0,
        error,
        recoveryActions: stepErrors.flatMap((issue) => issue.recoveryActions ?? [{ id: 'edit-pipeline', label: 'Edit pipeline', stepIndex: index }]),
      }
    })
    const error = validation.errors.map((issue) => issue.message).join('\n') || 'Pipeline validation failed'
    const execution: AgentPipelineExecution = {
      id: generateId('pipe-exec'),
      runId,
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      trigger: options.trigger ?? 'manual',
      ...(options.timerId ? { timerId: options.timerId } : {}),
      startedAt: executionStart,
      completedAt,
      status: 'error',
      steps,
      error,
      runtime: {
        runId,
        agentIds: pipeline.steps.map((step) => step.agentId),
        modelIds: runtimeStateAtStart.models.map((model) => model.id),
        startedAt: executionStart,
        trigger: options.trigger ?? 'manual',
        validationWarnings: validation.warnings.map((issue) => issue.message),
        ...(Object.keys(variables).length > 0 ? { variables } : {}),
      },
      recoveryActions: [{ id: 'edit-pipeline', label: 'Edit pipeline' }],
    }

    for (const step of steps) {
      options.onStepUpdate?.({
        stepIndex: step.stepIndex,
        agentId: step.agentId,
        name: step.name,
        task: step.task,
        input: step.input,
        status: step.status,
        startedAt: step.startedAt,
        completedAt: step.completedAt,
        durationMs: step.durationMs,
        attempts: step.attempts,
        error: step.error,
      })
    }

    const { workspacePath } = useAppStore.getState()
    if (options.persistExecution !== false && workspacePath) {
      await appendPipelineExecutionToDisk(workspacePath, execution)
    }
    return execution
  }

  const graphSteps = materializePipelineGraph(pipeline.steps)
  const stepIndexById = new Map(graphSteps.map((step, index) => [step.id, index]))
  const incomingByStepId = buildIncomingTransitionMap(graphSteps)
  const entryStepId = getPipelineEntryStepId(graphSteps)
  const queuedStepIds = new Set<string>()
  const processedStepIds = new Set<string>()
  const joinArrivals = new Map<string, Set<string>>()
  const executionQueue: Array<{ stepId: string; fromStepId?: string }> = []

  const queueStep = (stepId: string, fromStepId?: string) => {
    const stepIndex = stepIndexById.get(stepId)
    if (stepIndex === undefined || processedStepIds.has(stepId) || queuedStepIds.has(stepId)) return

    const targetStep = graphSteps[stepIndex]
    if (getPipelineNodeType(targetStep) === 'join') {
      const arrivals = joinArrivals.get(stepId) ?? new Set<string>()
      if (fromStepId) arrivals.add(fromStepId)
      joinArrivals.set(stepId, arrivals)

      const requiredArrivals = incomingByStepId.get(stepId)?.length ?? 0
      if ((targetStep.joinStrategy ?? 'wait-all') !== 'first-success' && requiredArrivals > 1 && arrivals.size < requiredArrivals) {
        return
      }
    }

    queuedStepIds.add(stepId)
    executionQueue.push({ stepId, fromStepId })
  }

  const queueOutgoingTransitions = (step: typeof graphSteps[number], latestOutput: string, outcome: 'success' | 'error' = 'success') => {
    for (const targetStepId of resolveNextTransitionTargetIds(step, latestOutput, outcome)) {
      queueStep(targetStepId, step.id)
    }
  }

  const skipRemainingSteps = (fromIndex: number, reason: string) => {
    const skippedAt = Date.now()
    for (let skippedIndex = 0; skippedIndex < graphSteps.length; skippedIndex += 1) {
      const skippedStep = graphSteps[skippedIndex]
      if (processedStepIds.has(skippedStep.id)) continue
      if (skippedIndex < fromIndex && fromIndex > 0) continue
      processedStepIds.add(skippedStep.id)
      executionSteps.push({
        id: generateId('pipe-step'),
        runId,
        stepIndex: skippedIndex,
        agentId: skippedStep.agentId,
        ...(skippedStep.name?.trim() ? { name: skippedStep.name.trim() } : {}),
        task: skippedStep.task,
        input: '',
        status: 'skipped',
        startedAt: skippedAt,
        completedAt: skippedAt,
        durationMs: 0,
        error: reason,
        skipReason: reason,
      })
      options.onStepUpdate?.({
        stepIndex: skippedIndex,
        agentId: skippedStep.agentId,
        name: skippedStep.name,
        task: skippedStep.task,
        input: '',
        status: 'skipped',
        startedAt: skippedAt,
        completedAt: skippedAt,
        durationMs: 0,
        error: reason,
        skipReason: reason,
      })
    }
  }

  let budgetExceeded: AgentPipelineExecution['budgetExceeded']

  /**
   * Returns the cap that has been exceeded, or `undefined` if all budgets
   * still have headroom. `executedStepCount` should reflect non-skipped,
   * non-disabled steps that have either completed or are about to start.
   */
  const evaluateBudget = (executedStepCount: number): AgentPipelineExecution['budgetExceeded'] => {
    const budget = pipeline.budget
    if (!budget) return undefined
    const tokens = aggregateUsage(executionSteps)?.totalTokens ?? 0

    if (Number.isFinite(budget.maxTotalDurationMs) && (budget.maxTotalDurationMs ?? 0) > 0) {
      const elapsed = Date.now() - executionStart
      if (elapsed > (budget.maxTotalDurationMs ?? 0)) {
        return { type: 'duration', limit: budget.maxTotalDurationMs ?? 0, observed: elapsed }
      }
    }
    if (Number.isFinite(budget.maxTotalTokens) && (budget.maxTotalTokens ?? 0) > 0) {
      if (tokens > (budget.maxTotalTokens ?? 0)) {
        return { type: 'tokens', limit: budget.maxTotalTokens ?? 0, observed: tokens }
      }
    }
    if (Number.isFinite(budget.maxStepCount) && (budget.maxStepCount ?? 0) > 0) {
      if (executedStepCount > (budget.maxStepCount ?? 0)) {
        return { type: 'steps', limit: budget.maxStepCount ?? 0, observed: executedStepCount }
      }
    }
    return undefined
  }

  const formatBudgetReason = (cap: NonNullable<AgentPipelineExecution['budgetExceeded']>): string => {
    switch (cap.type) {
      case 'duration':
        return `Pipeline budget exceeded: total duration ${cap.observed}ms > ${cap.limit}ms`
      case 'tokens':
        return `Pipeline budget exceeded: total tokens ${cap.observed} > ${cap.limit}`
      case 'steps':
        return `Pipeline budget exceeded: ${cap.observed} executed steps > ${cap.limit}`
      default:
        return 'Pipeline budget exceeded'
    }
  }

  let executedStepCount = 0
  const pipelineCallStack = [...(options.pipelineCallStack ?? []), pipeline.id]
  if (entryStepId) {
    queueStep(entryStepId)
  }

  while (executionQueue.length > 0) {
    const queuedStep = executionQueue.shift()
    if (!queuedStep) break
    queuedStepIds.delete(queuedStep.stepId)
    const index = stepIndexById.get(queuedStep.stepId)
    if (index === undefined) continue
    const step = graphSteps[index]
    if (processedStepIds.has(step.id)) continue
    visitedStepIds.push(step.id)
    visitedStepIndices.push(index)
    const nodeType = getPipelineNodeType(step)
    const contextualPreviousStep = resolveEffectivePreviousStep(executionSteps, graphSteps, stepIndexById, incomingByStepId, queuedStep.fromStepId)
    if (step.enabled === false) {
      const skippedAt = Date.now()
      processedStepIds.add(step.id)
      executionSteps.push({
        id: generateId('pipe-step'),
        runId,
        stepIndex: index,
        agentId: step.agentId,
        ...(step.name?.trim() ? { name: step.name.trim() } : {}),
        task: step.task,
        input: '',
        status: 'skipped',
        startedAt: skippedAt,
        completedAt: skippedAt,
        durationMs: 0,
        error: 'Step disabled',
        skipReason: 'Step disabled',
      })
      options.onStepUpdate?.({
        stepIndex: index,
        agentId: step.agentId,
        name: step.name,
        task: step.task,
        input: '',
        status: 'skipped',
        startedAt: skippedAt,
        completedAt: skippedAt,
        durationMs: 0,
        error: 'Step disabled',
        skipReason: 'Step disabled',
      })
      queueOutgoingTransitions(step, '')
      continue
    }

    // Evaluate the optional runIf condition before any model work.
    if (step.runIf?.trim()) {
      let conditionResult: { passed: boolean; reason?: string }
      try {
        conditionResult = evaluateRunIf(step.runIf, executionSteps, variables)
      } catch (error) {
        const message = `Invalid runIf condition: ${(error as Error).message}`
        const completedAt = Date.now()
        const recoveryActions = buildPipelineRecoveryActions(index, step.agentId)
        executionSteps.push({
          id: generateId('pipe-step'),
          runId,
          stepIndex: index,
          agentId: step.agentId,
          ...(step.name?.trim() ? { name: step.name.trim() } : {}),
          task: step.task,
          input: '',
          status: 'error',
          startedAt: completedAt,
          completedAt,
          durationMs: 0,
          attempts: 0,
          error: message,
          recoveryActions,
        })
        options.onStepUpdate?.({
          stepIndex: index,
          agentId: step.agentId,
          name: step.name,
          task: step.task,
          input: '',
          status: 'error',
          startedAt: completedAt,
          completedAt,
          durationMs: 0,
          attempts: 0,
          error: message,
          recoveryActions,
        })
        processedStepIds.add(step.id)
        previousOutput = message
        didFail = true
        executionError = executionError ?? message
        if (step.continueOnError === false) {
          skipRemainingSteps(index + 1, 'Skipped after previous step failed')
          break
        }
        queueOutgoingTransitions(step, message, 'error')
        continue
      }

      if (!conditionResult.passed) {
        const skippedAt = Date.now()
        const reason = conditionResult.reason ?? 'Condition not met'
        executionSteps.push({
          id: generateId('pipe-step'),
          runId,
          stepIndex: index,
          agentId: step.agentId,
          ...(step.name?.trim() ? { name: step.name.trim() } : {}),
          task: step.task,
          input: '',
          status: 'skipped',
          startedAt: skippedAt,
          completedAt: skippedAt,
          durationMs: 0,
          error: reason,
          skipReason: reason,
        })
        options.onStepUpdate?.({
          stepIndex: index,
          agentId: step.agentId,
          name: step.name,
          task: step.task,
          input: '',
          status: 'skipped',
          startedAt: skippedAt,
          completedAt: skippedAt,
          durationMs: 0,
          error: reason,
          skipReason: reason,
        })
        processedStepIds.add(step.id)
        queueOutgoingTransitions(step, '')
        continue
      }
    }

    // Respect cancellation between steps.
    if (options.abortSignal?.aborted) {
      didFail = true
      executionError = executionError ?? 'Cancelled by user'
      skipRemainingSteps(index, 'Cancelled by user')
      break
    }

    // Pre-flight budget check: enforce caps before doing any work for this step.
    executedStepCount += 1
    const preCap = evaluateBudget(executedStepCount)
    if (preCap) {
      budgetExceeded = preCap
      const reason = formatBudgetReason(preCap)
      didFail = true
      executionError = executionError ?? reason
      skipRemainingSteps(index, reason)
      break
    }

    if (nodeTypeRequiresTask(nodeType) && !step.task.trim()) {
      const completedAt = Date.now()
      const message = 'Step task is empty'
      const recoveryActions = buildPipelineRecoveryActions(index, step.agentId)
      executionSteps.push({
        id: generateId('pipe-step'),
        runId,
        stepIndex: index,
        agentId: step.agentId,
        ...(step.name?.trim() ? { name: step.name.trim() } : {}),
        task: step.task,
        input: '',
        status: 'error',
        startedAt: completedAt,
        completedAt,
        durationMs: 0,
        attempts: 0,
        error: message,
        recoveryActions,
      })
      options.onStepUpdate?.({
        stepIndex: index,
        agentId: step.agentId,
        name: step.name,
        task: step.task,
        input: '',
        status: 'error',
        startedAt: completedAt,
        completedAt,
        durationMs: 0,
        attempts: 0,
        error: message,
        recoveryActions,
      })
      processedStepIds.add(step.id)
      previousOutput = message
      didFail = true
      executionError = executionError ?? message
      if (step.continueOnError === false) {
        skipRemainingSteps(index + 1, 'Skipped after previous step failed')
        break
      }
      queueOutgoingTransitions(step, message, 'error')
      continue
    }

    const stepStart = Date.now()
    const input = buildStepInput(step, executionSteps, variables, contextualPreviousStep)
    const progressBase: AgentPipelineProgressStep = {
      stepIndex: index,
      agentId: step.agentId,
      name: step.name,
      task: step.task,
      input,
      status: 'running',
      startedAt: stepStart,
      attempts: 1,
    }

    if (isPureStructuralNode(nodeType)) {
      const completedAt = Date.now()
      const joinIncomingIndices = nodeType === 'join'
        ? [...(joinArrivals.get(step.id) ?? new Set<string>())].flatMap((sourceStepId) => {
            const sourceIndex = stepIndexById.get(sourceStepId)
            return sourceIndex === undefined ? [] : [sourceIndex]
          })
        : []
      const output = nodeType === 'start'
        ? resolveStartNodeOutput(step, variables)
        : nodeType === 'end'
          ? resolveEndNodeOutput(step, executionSteps, variables)
          : nodeType === 'join'
            ? resolveJoinNodeOutput(step, executionSteps, joinIncomingIndices)
          : buildStructuralNodeOutput(step)
      executionSteps.push({
        id: generateId('pipe-step'),
        runId,
        stepIndex: index,
        agentId: step.agentId,
        ...(step.name?.trim() ? { name: step.name.trim() } : {}),
        task: step.task,
        input,
        output,
        status: 'success',
        startedAt: stepStart,
        completedAt,
        durationMs: completedAt - stepStart,
        attempts: 1,
        outputType: 'text',
      })
      options.onStepUpdate?.({ ...progressBase })
      options.onStepUpdate?.({ ...progressBase, output, status: 'success', completedAt, durationMs: completedAt - stepStart })
      processedStepIds.add(step.id)
      previousOutput = output
      queueOutgoingTransitions(step, output)
      continue
    }

    if (nodeType === 'pipeline') {
      options.onStepUpdate?.({ ...progressBase })
      try {
        const targetReference = resolvePipelineScalar(step.pipelineTargetId, executionSteps, variables, contextualPreviousStep)
        if (!targetReference) {
          throw new Error('Nested pipeline target is missing')
        }
        const targetPipeline = await findPipelineByReference(targetReference)
        if (!targetPipeline) {
          throw new Error(`Nested pipeline not found: ${targetReference}`)
        }
        if (pipelineCallStack.includes(targetPipeline.id)) {
          throw new Error(`Recursive pipeline call detected: ${targetPipeline.name}`)
        }
        const nestedVariables = resolveNestedPipelineVariables(step, executionSteps, variables, input)
        const nestedExecution = await executeAgentPipeline(targetPipeline, {
          ...options,
          persistExecution: false,
          persistLastRun: false,
          onStepUpdate: undefined,
          variables: nestedVariables,
          pipelineCallStack,
        })
        if (nestedExecution.status === 'error') {
          throw new Error(nestedExecution.error || `Nested pipeline failed: ${targetPipeline.name}`)
        }
        const completedAt = Date.now()
        const output = nestedExecution.finalOutput || `Nested pipeline completed: ${targetPipeline.name}`
        executionSteps.push({
          id: generateId('pipe-step'),
          runId,
          stepIndex: index,
          agentId: step.agentId,
          ...(step.name?.trim() ? { name: step.name.trim() } : {}),
          task: step.task,
          input,
          output,
          status: 'success',
          startedAt: stepStart,
          completedAt,
          durationMs: completedAt - stepStart,
          attempts: 1,
          outputType: 'text',
          warnings: [`Nested pipeline executed: ${targetPipeline.name}`],
          ...(step.exportVar?.trim() ? { exportedVar: step.exportVar.trim() } : {}),
        })
        options.onStepUpdate?.({ ...progressBase, output, status: 'success', completedAt, durationMs: completedAt - stepStart })
        processedStepIds.add(step.id)
        previousOutput = output
        const exportName = step.exportVar?.trim()
        if (exportName && EXPORT_VAR_NAME_PATTERN.test(exportName)) {
          variables[exportName] = output
        }
        queueOutgoingTransitions(step, output)
        continue
      } catch (error) {
        const completedAt = Date.now()
        const message = sanitizePipelineError(error)
        const recoveryActions = buildPipelineRecoveryActions(index, step.agentId)
        executionSteps.push({
          id: generateId('pipe-step'),
          runId,
          stepIndex: index,
          agentId: step.agentId,
          ...(step.name?.trim() ? { name: step.name.trim() } : {}),
          task: step.task,
          input,
          status: 'error',
          startedAt: stepStart,
          completedAt,
          durationMs: completedAt - stepStart,
          attempts: 1,
          error: message,
          recoveryActions,
        })
        options.onStepUpdate?.({ ...progressBase, status: 'error', completedAt, durationMs: completedAt - stepStart, error: message, recoveryActions })
        processedStepIds.add(step.id)
        previousOutput = message
        didFail = true
        executionError = executionError ?? message
        if (step.continueOnError === false) {
          skipRemainingSteps(index + 1, 'Skipped after previous step failed')
          break
        }
        queueOutgoingTransitions(step, message, 'error')
        continue
      }
    }

    if (nodeType === 'http' || nodeType === 'script' || nodeType === 'code' || nodeType === 'template' || nodeType === 'variable' || nodeType === 'iteration' || nodeType === 'email' || nodeType === 'webhook' || nodeType === 'toolset' || nodeType === 'rag' || nodeType === 'wiki') {
      options.onStepUpdate?.({ ...progressBase })
      try {
        const nodeResult = nodeType === 'http'
          ? await executeHttpNode(step, executionSteps, variables)
          : nodeType === 'webhook'
            ? await executeWebhookNode(step, executionSteps, variables)
            : nodeType === 'code'
              ? await executeCodeNode(step, executionSteps, variables, contextualPreviousStep)
              : nodeType === 'template'
                ? executeTemplateNode(step, executionSteps, variables, contextualPreviousStep)
                : nodeType === 'variable'
                  ? executeVariableNode(step, executionSteps, variables, contextualPreviousStep)
                  : nodeType === 'iteration'
                    ? await executeIterationNode(step, executionSteps, variables, contextualPreviousStep, options, pipelineCallStack)
            : nodeType === 'toolset'
              ? await executeToolsetNode(step, executionSteps, variables)
              : nodeType === 'rag'
                ? executeDocumentRetrievalNode(step, executionSteps, variables, 'rag')
                : nodeType === 'wiki'
                  ? executeDocumentRetrievalNode(step, executionSteps, variables, 'wiki')
          : nodeType === 'script'
            ? await executeScriptNode(step, executionSteps, variables)
            : await executeEmailNode(step, input, executionSteps, variables)
        const completedAt = Date.now()
        const outputResult = clampStepOutput(step, nodeResult.output)
        executionSteps.push({
          id: generateId('pipe-step'),
          runId,
          stepIndex: index,
          agentId: step.agentId,
          ...(step.name?.trim() ? { name: step.name.trim() } : {}),
          task: step.task,
          input,
          output: outputResult.output,
          status: 'success',
          startedAt: stepStart,
          completedAt,
          durationMs: completedAt - stepStart,
          attempts: 1,
          outputType: step.outputType ?? 'text',
          ...(nodeResult.warnings || outputResult.warnings ? { warnings: [...(nodeResult.warnings ?? []), ...(outputResult.warnings ?? [])] } : {}),
          ...(step.exportVar?.trim() ? { exportedVar: step.exportVar.trim() } : {}),
        })
        options.onStepUpdate?.({ ...progressBase, output: outputResult.output, status: 'success', completedAt, durationMs: completedAt - stepStart })
        processedStepIds.add(step.id)
        previousOutput = outputResult.output
        const exportName = step.exportVar?.trim()
        if (exportName && EXPORT_VAR_NAME_PATTERN.test(exportName)) {
          ensureNamedVariable(variables, exportName, outputResult.output)
        }
        queueOutgoingTransitions(step, outputResult.output)
        continue
      } catch (error) {
        const completedAt = Date.now()
        const message = sanitizePipelineError(error)
        const recoveryActions = buildPipelineRecoveryActions(index, step.agentId)
        executionSteps.push({
          id: generateId('pipe-step'),
          runId,
          stepIndex: index,
          agentId: step.agentId,
          ...(step.name?.trim() ? { name: step.name.trim() } : {}),
          task: step.task,
          input,
          status: 'error',
          startedAt: stepStart,
          completedAt,
          durationMs: completedAt - stepStart,
          attempts: 1,
          error: message,
          recoveryActions,
        })
        options.onStepUpdate?.({ ...progressBase, status: 'error', completedAt, durationMs: completedAt - stepStart, error: message, recoveryActions })
        processedStepIds.add(step.id)
        previousOutput = message
        didFail = true
        executionError = executionError ?? message
        if (step.continueOnError === false) {
          skipRemainingSteps(index + 1, 'Skipped after previous step failed')
          break
        }
        queueOutgoingTransitions(step, message, 'error')
        continue
      }
    }

    const runtimeState = useAppStore.getState()
    const agent = nodeTypeUsesAgentRuntime(nodeType) ? runtimeState.agents.find((item) => item.id === step.agentId) : undefined
    if (!agent) {
      const completedAt = Date.now()
      const recoveryActions = buildPipelineRecoveryActions(index, step.agentId)
      executionSteps.push({
        id: generateId('pipe-step'),
        runId,
        stepIndex: index,
        agentId: step.agentId,
        ...(step.name?.trim() ? { name: step.name.trim() } : {}),
        task: step.task,
        input,
        status: 'error',
        startedAt: stepStart,
        completedAt,
        durationMs: completedAt - stepStart,
        attempts: 1,
        error: 'Agent not found',
        recoveryActions,
      })
      options.onStepUpdate?.({
        stepIndex: index,
        agentId: step.agentId,
        name: step.name,
        task: step.task,
        input,
        status: 'error',
        startedAt: stepStart,
        completedAt,
        durationMs: completedAt - stepStart,
        attempts: 1,
        error: 'Agent not found',
        recoveryActions,
      })
      processedStepIds.add(step.id)
      previousOutput = 'Agent not found'
      didFail = true
      executionError = executionError ?? 'Agent not found'
      if (step.continueOnError === false) {
        skipRemainingSteps(index + 1, 'Skipped after previous step failed')
        break
      }
      queueOutgoingTransitions(step, 'Agent not found', 'error')
      continue
    }

    const model = resolvePipelineModel(agent, runtimeState.models, step)
    const llmProgressBase: AgentPipelineProgressStep = {
      stepIndex: index,
      agentId: step.agentId,
      agentName: agent.name,
      name: step.name,
      task: step.task,
      input,
      status: 'running',
      startedAt: stepStart,
      attempts: 1,
    }
    options.onStepUpdate?.(llmProgressBase)

    if (!model) {
      const completedAt = Date.now()
      const recoveryActions = buildPipelineRecoveryActions(index, step.agentId)
      executionSteps.push({
        id: generateId('pipe-step'),
        runId,
        stepIndex: index,
        agentId: step.agentId,
        ...(step.name?.trim() ? { name: step.name.trim() } : {}),
        task: step.task,
        input,
        status: 'error',
        startedAt: stepStart,
        completedAt,
        durationMs: completedAt - stepStart,
        attempts: 1,
        error: 'No model available',
        recoveryActions,
      })
      options.onStepUpdate?.({
        ...llmProgressBase,
        status: 'error',
        completedAt,
        durationMs: completedAt - stepStart,
        attempts: 1,
        error: 'No model available',
        recoveryActions,
      })
      processedStepIds.add(step.id)
      previousOutput = 'No model available'
      didFail = true
      executionError = executionError ?? 'No model available'
      if (step.continueOnError === false) {
        skipRemainingSteps(index + 1, 'Skipped after previous step failed')
        break
      }
      queueOutgoingTransitions(step, 'No model available', 'error')
      continue
    }

    const providerKey = [model.providerType, model.provider, model.baseUrl ?? '', model.apiKey ?? ''].join('::')
    if (!initializedProviders.has(providerKey)) {
      initializeProvider(model.providerType, model.apiKey || 'ollama', model.baseUrl, model.provider)
      initializedProviders.add(providerKey)
    }

    let executionContext = executionContextCache.get(agent.id)
    if (!executionContext) {
      executionContext = buildPipelineExecutionContext(agent)
      executionContextCache.set(agent.id, executionContext)
    }

    let resolvedContext: Awaited<ReturnType<typeof buildPipelineExecutionContext>>
    try {
      resolvedContext = await executionContext
    } catch (error) {
      // Evict the rejected promise so subsequent steps with the same agent
      // can retry instead of being poisoned by a transient failure.
      executionContextCache.delete(agent.id)
      throw error
    }

    const { systemPrompt, tools } = resolvedContext
    const modelIdentifier = `${model.provider}:${model.modelId}`
    const messages: ModelMessage[] = [{ role: 'user' as const, content: input }]
    const maxAttempts = normalizeRetryCount(step.retryCount) + 1
    let attempts = 0

    try {
      let output = ''
      let lastError: string | undefined
      let stepUsage: PipelineStepUsage | undefined
      const shouldStream = requiresStreaming(tools as Record<string, unknown>, Boolean(options.onStepUpdate))
      const stepTimeoutMs = step.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS

      while (attempts < maxAttempts) {
        attempts += 1
        output = ''
        stepUsage = undefined
        options.onStepUpdate?.({
            ...llmProgressBase,
          attempts,
          output: undefined,
          error: attempts > 1 ? lastError : undefined,
        })

        const stepAbort = createStepAbortSignal(options.abortSignal, stepTimeoutMs)
        try {
          if (shouldStream) {
            let streamError: string | undefined
            for await (const event of streamResponseWithTools(modelIdentifier, messages, {
              systemPrompt,
              tools,
              maxSteps: Math.max(2, Math.min(agent.maxTurns ?? 5, 30)),
              apiKey: model.apiKey,
              baseUrl: model.baseUrl,
              providerType: model.providerType,
              abortSignal: stepAbort.signal,
            })) {
              if (stepAbort.timedOut()) throw new Error(`Step timed out after ${stepTimeoutMs}ms`)
              if (event.type === 'text-delta') {
                output += event.text
                options.onStepUpdate?.({
                  ...llmProgressBase,
                  output,
                  attempts,
                  ...(stepUsage ? { usage: stepUsage } : {}),
                })
              } else if (event.type === 'usage') {
                stepUsage = {
                  promptTokens: event.promptTokens,
                  completionTokens: event.completionTokens,
                  totalTokens: event.totalTokens,
                }
                options.onStepUpdate?.({
                  ...llmProgressBase,
                  output,
                  attempts,
                  usage: stepUsage,
                })
              } else if (event.type === 'error') {
                streamError = sanitizePipelineError(event.error)
              }
            }

            if (streamError) {
              throw new Error(streamError)
            }
          } else {
            output = await generateResponse(modelIdentifier, messages, systemPrompt, model.apiKey, model.baseUrl, model.providerType)
          }

          lastError = undefined
          break
        } catch (error) {
          const message = sanitizePipelineError(error)
          lastError = message
          if (options.abortSignal?.aborted || attempts >= maxAttempts) {
            throw error
          }
          options.onStepUpdate?.({
            ...llmProgressBase,
            status: 'running',
            attempts,
            error: message,
          })
          const backoffMs = computeRetryDelay(step, attempts)
          if (backoffMs > 0) {
            await delay(backoffMs, options.abortSignal)
          }
        } finally {
          stepAbort.cleanup()
        }
      }

      const completedAt = Date.now()
      // Apply post-process transform (if any) before clamping. The clamped
      // value is what flows downstream; the original LLM output is kept on
      // `rawOutput` only when the transform actually changed something.
      const transformResult = applyOutputTransform(step, output)
      const transformedOutput = transformResult.transformed
      const outputResult = clampStepOutput(step, transformedOutput)
      const combinedWarnings = [
        ...(transformResult.warning ? [transformResult.warning] : []),
        ...(outputResult.warnings ?? []),
      ]
      executionSteps.push({
        id: generateId('pipe-step'),
        runId,
        stepIndex: index,
        agentId: step.agentId,
        ...(step.name?.trim() ? { name: step.name.trim() } : {}),
        task: step.task,
        input,
        output: outputResult.output,
        ...(transformResult.changed ? { rawOutput: output } : {}),
        ...(model?.id ? { modelId: model.id } : {}),
        ...(step.exportVar?.trim() ? { exportedVar: step.exportVar.trim() } : {}),
        status: 'success',
        startedAt: stepStart,
        completedAt,
        durationMs: completedAt - stepStart,
        attempts,
        outputType: step.outputType ?? 'text',
        ...(combinedWarnings.length > 0 ? { warnings: combinedWarnings } : {}),
        ...(stepUsage ? { usage: stepUsage } : {}),
      })
      options.onStepUpdate?.({
        ...llmProgressBase,
        output: outputResult.output,
        status: 'success',
        completedAt,
        durationMs: completedAt - stepStart,
        attempts,
        ...(stepUsage ? { usage: stepUsage } : {}),
      })
      processedStepIds.add(step.id)
      previousOutput = outputResult.output
      // Publish exported variable so subsequent steps can reference it via
      // `{{vars.NAME}}` and `runIf`. Validation has already enforced that the
      // name is identifier-shaped, but we re-check here as a defense-in-depth
      // guard against pipelines mutated post-validation.
      const exportName = step.exportVar?.trim()
      if (exportName && EXPORT_VAR_NAME_PATTERN.test(exportName)) {
        variables[exportName] = outputResult.output
      }
      queueOutgoingTransitions(step, outputResult.output)

      // Post-step budget check (catches token-budget overruns once we know usage).
      const postCap = evaluateBudget(executedStepCount)
      if (postCap) {
        budgetExceeded = postCap
        const reason = formatBudgetReason(postCap)
        didFail = true
        executionError = executionError ?? reason
        skipRemainingSteps(index + 1, reason)
        break
      }
    } catch (error) {
      const completedAt = Date.now()
      const message = sanitizePipelineError(error)
      const recoveryActions = buildPipelineRecoveryActions(index, step.agentId, model.id)
      executionSteps.push({
        id: generateId('pipe-step'),
        runId,
        stepIndex: index,
        agentId: step.agentId,
        ...(step.name?.trim() ? { name: step.name.trim() } : {}),
        task: step.task,
        input,
        status: 'error',
        startedAt: stepStart,
        completedAt,
        durationMs: completedAt - stepStart,
        attempts: Math.max(1, attempts),
        error: message,
        recoveryActions,
      })
      options.onStepUpdate?.({
        ...llmProgressBase,
        status: 'error',
        completedAt,
        durationMs: completedAt - stepStart,
        attempts: Math.max(1, attempts),
        error: message,
        recoveryActions,
      })
      processedStepIds.add(step.id)
      previousOutput = message
      didFail = true
      executionError = executionError ?? message
      if (step.continueOnError === false) {
        skipRemainingSteps(index + 1, 'Skipped after previous step failed')
        break
      }
      queueOutgoingTransitions(step, message, 'error')
    }
  }

  skipRemainingSteps(0, 'Skipped because this workflow path was not selected.')

  const completedAt = Date.now()
  const totalUsage = aggregateUsage(executionSteps)
  const execution: AgentPipelineExecution = {
    id: generateId('pipe-exec'),
    runId,
    pipelineId: pipeline.id,
    pipelineName: pipeline.name,
    trigger: options.trigger ?? 'manual',
    ...(options.timerId ? { timerId: options.timerId } : {}),
    startedAt: executionStart,
    completedAt,
    status: didFail ? 'error' : 'success',
    steps: executionSteps,
    finalOutput: previousOutput || undefined,
    ...(executionError ? { error: executionError } : {}),
    runtime: {
      runId,
      agentIds: pipeline.steps.map((step) => step.agentId),
      modelIds: useAppStore.getState().models.map((model) => model.id),
      startedAt: executionStart,
      trigger: options.trigger ?? 'manual',
      validationWarnings: validation.warnings.map((issue) => issue.message),
      visitedStepIds,
      visitedStepIndices,
      ...(Object.keys(variables).length > 0 ? { variables } : {}),
    },
    ...(didFail ? { recoveryActions: [{ id: 'edit-pipeline', label: 'Edit pipeline' }] } : {}),
    ...(totalUsage ? { usage: totalUsage } : {}),
    ...(budgetExceeded ? { budgetExceeded } : {}),
  }

  const { workspacePath } = useAppStore.getState()
  if (options.persistExecution !== false && workspacePath) {
    await appendPipelineExecutionToDisk(workspacePath, execution)
  }

  if (options.persistLastRun !== false) {
    await persistPipelineRunMetadata(pipeline.id, completedAt)
  }

  return execution
}

export async function executeAgentPipeline(
  pipeline: AgentPipeline,
  options: ExecuteAgentPipelineOptions = {},
): Promise<AgentPipelineExecution> {
  return executePipelineWithEngineRouting({
    pipeline,
    options,
    executeLegacy: executeAgentPipelineLegacy,
  })
}

/**
 * Outcome for a single step in a `dryRunAgentPipeline` simulation. Mirrors
 * the runtime classifications a real run would produce, but never calls a
 * model so it costs zero tokens.
 */
export interface DryRunStepResult {
  stepIndex: number
  agentId: string
  name?: string
  task: string
  /** The fully-resolved input (variables + step references substituted, just like a real run). */
  resolvedInput: string
  /** The model id that would be used (after step-level override resolution). */
  modelId?: string
  /** When the step has `exportVar` set, the variable name that would receive the output. */
  exportedVar?: string
  /** Final classification: `would-run`, `skipped`, `error`, or `disabled`. */
  status: 'would-run' | 'skipped' | 'error' | 'disabled'
  /** Reason for `skipped` / `error` / `disabled`. */
  reason?: string
}

export interface DryRunResult {
  pipelineId: string
  pipelineName: string
  steps: DryRunStepResult[]
  visitedStepIndices: number[]
  variables: Record<string, string>
  validationWarnings: string[]
  validationErrors: string[]
  /** When set, the dry run aborted early because a budget cap would have been exceeded. */
  budgetExceeded?: AgentPipelineExecution['budgetExceeded']
  /** True when no validation errors were raised. */
  valid: boolean
}

/**
 * Simulate a pipeline run without calling any model. Useful to debug
 * variable substitution, `runIf` conditions, missing agents/models, and the
 * `maxStepCount` budget cap before spending tokens. Token / duration budgets
 * cannot be evaluated in a dry run (no real usage data, no real wall clock),
 * so only `maxStepCount` is enforced.
 */
export function dryRunAgentPipeline(
  pipeline: AgentPipeline,
  options: { variables?: Record<string, string> } = {},
): DryRunResult {
  const state = useAppStore.getState()
  const validation = validateAgentPipeline(pipeline, state.agents, state.models)
  const variables = resolveRunVariables(pipeline, options.variables)
  const graphSteps = materializePipelineGraph(pipeline.steps)
  const stepIndexById = new Map(graphSteps.map((step, index) => [step.id, index]))
  const incomingByStepId = buildIncomingTransitionMap(graphSteps)
  const entryStepId = getPipelineEntryStepId(graphSteps)
  const simulatedSteps: PipelineStepRuntimeValue[] = []
  const dryRunSteps: DryRunStepResult[] = []
  const visitedStepIndices: number[] = []
  const processedStepIds = new Set<string>()
  const queuedStepIds = new Set<string>()
  const joinArrivals = new Map<string, Set<string>>()
  const executionQueue: Array<{ stepId: string; fromStepId?: string }> = []
  let executedStepCount = 0
  let budgetExceeded: AgentPipelineExecution['budgetExceeded']

  const queueStep = (stepId: string, fromStepId?: string) => {
    const stepIndex = stepIndexById.get(stepId)
    if (stepIndex === undefined || processedStepIds.has(stepId) || queuedStepIds.has(stepId)) return

    const targetStep = graphSteps[stepIndex]
    if (getPipelineNodeType(targetStep) === 'join') {
      const arrivals = joinArrivals.get(stepId) ?? new Set<string>()
      if (fromStepId) arrivals.add(fromStepId)
      joinArrivals.set(stepId, arrivals)

      const requiredArrivals = incomingByStepId.get(stepId)?.length ?? 0
      if ((targetStep.joinStrategy ?? 'wait-all') !== 'first-success' && requiredArrivals > 1 && arrivals.size < requiredArrivals) {
        return
      }
    }

    queuedStepIds.add(stepId)
    executionQueue.push({ stepId, fromStepId })
  }

  const queueOutgoingTransitions = (step: typeof graphSteps[number], latestOutput: string, outcome: 'success' | 'error' = 'success') => {
    for (const targetStepId of resolveNextTransitionTargetIds(step, latestOutput, outcome)) {
      queueStep(targetStepId, step.id)
    }
  }

  const skipUnvisitedSteps = (reason: string) => {
    graphSteps.forEach((step, index) => {
      if (processedStepIds.has(step.id)) return
      processedStepIds.add(step.id)
      dryRunSteps.push({
        stepIndex: index,
        agentId: step.agentId,
        ...(step.name?.trim() ? { name: step.name.trim() } : {}),
        task: step.task,
        resolvedInput: '',
        status: 'skipped',
        reason,
      })
    })
  }

  if (entryStepId) {
    queueStep(entryStepId)
  }

  while (executionQueue.length > 0) {
    const queuedStep = executionQueue.shift()
    if (!queuedStep) break
    queuedStepIds.delete(queuedStep.stepId)
    const index = stepIndexById.get(queuedStep.stepId)
    if (index === undefined) continue
    const step = graphSteps[index]
    if (processedStepIds.has(step.id)) continue
    visitedStepIndices.push(index)
    const nodeType = getPipelineNodeType(step)
    const contextualPreviousStep = resolveEffectivePreviousStep(simulatedSteps, graphSteps, stepIndexById, incomingByStepId, queuedStep.fromStepId)
    const baseEntry = {
      stepIndex: index,
      agentId: step.agentId,
      ...(step.name?.trim() ? { name: step.name.trim() } : {}),
      task: step.task,
    } satisfies Pick<DryRunStepResult, 'stepIndex' | 'agentId' | 'name' | 'task'>

    if (step.enabled === false) {
      processedStepIds.add(step.id)
      dryRunSteps.push({ ...baseEntry, resolvedInput: '', status: 'disabled', reason: 'Step disabled' })
      simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: '', output: '', status: 'skipped', error: 'Step disabled' })
      queueOutgoingTransitions(step, '')
      continue
    }

    if (step.runIf?.trim()) {
      try {
        const conditionResult = evaluateRunIf(step.runIf, simulatedSteps, variables)
        if (!conditionResult.passed) {
          const reason = conditionResult.reason ?? `Condition not met: ${step.runIf}`
          processedStepIds.add(step.id)
          dryRunSteps.push({ ...baseEntry, resolvedInput: '', status: 'skipped', reason })
          simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: '', output: '', status: 'skipped', error: reason })
          queueOutgoingTransitions(step, '')
          continue
        }
      } catch (error) {
        const reason = `Invalid runIf condition: ${(error as Error).message}`
        processedStepIds.add(step.id)
        dryRunSteps.push({ ...baseEntry, resolvedInput: '', status: 'error', reason })
        simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: '', output: '', status: 'error', error: reason })
        queueOutgoingTransitions(step, reason, 'error')
        continue
      }
    }

    executedStepCount += 1
    const stepCap = pipeline.budget?.maxStepCount
    if (typeof stepCap === 'number' && stepCap > 0 && executedStepCount > stepCap) {
      budgetExceeded = { type: 'steps', limit: stepCap, observed: executedStepCount }
      const reason = `Pipeline budget exceeded: ${executedStepCount} executed steps > ${stepCap}`
      processedStepIds.add(step.id)
      dryRunSteps.push({ ...baseEntry, resolvedInput: '', status: 'skipped', reason })
      skipUnvisitedSteps(reason)
      break
    }

    if (nodeType === 'http') {
      const resolvedInput = buildStepInput(step, simulatedSteps, variables, contextualPreviousStep)
      if (!(step.httpUrl?.trim())) {
        processedStepIds.add(step.id)
        dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'error', reason: `Step ${index + 1} is missing a request URL.` })
        simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: '', status: 'error', error: 'missing request url' })
        queueOutgoingTransitions(step, 'missing request url', 'error')
        continue
      }
      const simulatedOutput = `[dry-run http response: ${step.httpMethod ?? 'GET'} ${step.httpUrl}]`
      processedStepIds.add(step.id)
      dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'would-run', ...(step.exportVar?.trim() ? { exportedVar: step.exportVar.trim() } : {}) })
      simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: simulatedOutput, status: 'success' })
      queueOutgoingTransitions(step, simulatedOutput)
      continue
    }

    if (nodeType === 'webhook') {
      const resolvedInput = buildStepInput(step, simulatedSteps, variables, contextualPreviousStep)
      const target = resolveWebhookTarget(step)
      if (!target?.trim()) {
        dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'error', reason: `Step ${index + 1} is missing a webhook target.` })
        simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: '', status: 'error', error: 'missing webhook target' })
        continue
      }
      const simulatedOutput = step.webhookAsync ? `[dry-run async webhook: ${target}]` : `[dry-run webhook response: ${target}]`
      dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'would-run', ...(step.exportVar?.trim() ? { exportedVar: step.exportVar.trim() } : {}) })
      simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: simulatedOutput, status: 'success' })
      queueOutgoingTransitions(step, simulatedOutput)
      continue
    }

    if (nodeType === 'toolset') {
      const resolvedInput = buildStepInput(step, simulatedSteps, variables, contextualPreviousStep)
      if (!(step.toolsetId?.trim()) || !(step.toolName?.trim())) {
        dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'error', reason: `Step ${index + 1} must choose a toolset and tool.` })
        simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: '', status: 'error', error: 'missing toolset config' })
        continue
      }
      const simulatedOutput = `[dry-run tool execution: ${step.toolsetId} -> ${step.toolName}]`
      dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'would-run', ...(step.exportVar?.trim() ? { exportedVar: step.exportVar.trim() } : {}) })
      simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: simulatedOutput, status: 'success' })
      const exportName = step.exportVar?.trim()
      if (exportName && EXPORT_VAR_NAME_PATTERN.test(exportName)) {
        variables[exportName] = simulatedOutput
      }
      queueOutgoingTransitions(step, simulatedOutput)
      continue
    }

    if (nodeType === 'code') {
      const resolvedInput = buildStepInput(step, simulatedSteps, variables, contextualPreviousStep)
      if (!(step.codeSource?.trim())) {
        dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'error', reason: `Step ${index + 1} is missing code source.` })
        simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: '', status: 'error', error: 'missing code source' })
        queueOutgoingTransitions(step, 'missing code source', 'error')
        continue
      }
      const simulatedOutput = '[dry-run code result]'
      dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'would-run', ...(step.exportVar?.trim() ? { exportedVar: step.exportVar.trim() } : {}) })
      simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: simulatedOutput, status: 'success' })
      queueOutgoingTransitions(step, simulatedOutput)
      continue
    }

    if (nodeType === 'template') {
      const resolvedInput = buildStepInput(step, simulatedSteps, variables, contextualPreviousStep)
      if (!(step.templateBody?.trim())) {
        dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'error', reason: `Step ${index + 1} is missing template content.` })
        simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: '', status: 'error', error: 'missing template body' })
        queueOutgoingTransitions(step, 'missing template body', 'error')
        continue
      }
      const simulatedOutput = '[dry-run template output]'
      dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'would-run', ...(step.exportVar?.trim() ? { exportedVar: step.exportVar.trim() } : {}) })
      simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: simulatedOutput, status: 'success' })
      queueOutgoingTransitions(step, simulatedOutput)
      continue
    }

    if (nodeType === 'variable') {
      const resolvedInput = buildStepInput(step, simulatedSteps, variables, contextualPreviousStep)
      if (!step.variableAssignments || step.variableAssignments.length === 0) {
        dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'error', reason: `Step ${index + 1} has no variable assignments.` })
        simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: '', status: 'error', error: 'missing variable assignments' })
        queueOutgoingTransitions(step, 'missing variable assignments', 'error')
        continue
      }
      const simulatedOutput = `[dry-run variable assignments: ${step.variableAssignments.length}]`
      dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'would-run', ...(step.exportVar?.trim() ? { exportedVar: step.exportVar.trim() } : {}) })
      simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: simulatedOutput, status: 'success' })
      queueOutgoingTransitions(step, simulatedOutput)
      continue
    }

    if (nodeType === 'iteration') {
      const resolvedInput = buildStepInput(step, simulatedSteps, variables, contextualPreviousStep)
      const sourceValue = getStructuredReferenceValue(step.iterationSource ?? '', simulatedSteps, variables, contextualPreviousStep)
      let items: unknown[] = []
      try {
        items = normalizeIterationItems(sourceValue)
      } catch (error) {
        const reason = (error as Error).message
        dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'error', reason })
        simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: '', status: 'error', error: reason })
        queueOutgoingTransitions(step, reason, 'error')
        continue
      }
      if (!(step.iterationPipelineTargetId?.trim())) {
        dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'error', reason: `Step ${index + 1} is missing a child pipeline.` })
        simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: '', status: 'error', error: 'missing iteration pipeline' })
        queueOutgoingTransitions(step, 'missing iteration pipeline', 'error')
        continue
      }
      const simulatedOutput = JSON.stringify(Array.from({ length: items.length }, (_value, itemIndex) => `[dry-run iteration item ${itemIndex + 1}]`), null, 2)
      dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'would-run', ...(step.exportVar?.trim() ? { exportedVar: step.exportVar.trim() } : {}) })
      simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: simulatedOutput, status: 'success' })
      queueOutgoingTransitions(step, simulatedOutput)
      continue
    }

    if (nodeType === 'rag' || nodeType === 'wiki') {
      const resolvedInput = buildStepInput(step, simulatedSteps, variables, contextualPreviousStep)
      const targetIds = [
        ...(nodeType === 'rag' ? (step.ragKnowledgeBaseIds ?? []) : (step.wikiIds ?? [])),
        nodeType === 'rag' ? step.ragKnowledgeBaseId ?? '' : step.wikiId ?? '',
      ].map((value) => value.trim()).filter(Boolean)
      const query = nodeType === 'rag' ? step.ragQuery : step.wikiQuery
      if (targetIds.length === 0 || !(query?.trim())) {
        dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'error', reason: `Step ${index + 1} is missing ${nodeType === 'rag' ? 'knowledge base' : 'wiki'} search settings.` })
        simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: '', status: 'error', error: 'missing retrieval settings' })
        continue
      }
      const simulatedOutput = `[dry-run ${nodeType} retrieval: ${query}]`
      dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'would-run', ...(step.exportVar?.trim() ? { exportedVar: step.exportVar.trim() } : {}) })
      simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: simulatedOutput, status: 'success' })
      const exportName = step.exportVar?.trim()
      if (exportName && EXPORT_VAR_NAME_PATTERN.test(exportName)) {
        variables[exportName] = simulatedOutput
      }
      queueOutgoingTransitions(step, simulatedOutput)
      continue
    }

    if (nodeType === 'script') {
      const resolvedInput = buildStepInput(step, simulatedSteps, variables, contextualPreviousStep)
      if (!(step.scriptPath?.trim())) {
        processedStepIds.add(step.id)
        dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'error', reason: `Step ${index + 1} is missing a script path.` })
        simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: '', status: 'error', error: 'missing script path' })
        queueOutgoingTransitions(step, 'missing script path', 'error')
        continue
      }
      const simulatedOutput = `[dry-run script output: ${step.scriptRuntime ?? 'javascript'} ${step.scriptPath}]`
      processedStepIds.add(step.id)
      dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'would-run', ...(step.exportVar?.trim() ? { exportedVar: step.exportVar.trim() } : {}) })
      simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: simulatedOutput, status: 'success' })
      queueOutgoingTransitions(step, simulatedOutput)
      continue
    }

    if (nodeType === 'email') {
      const resolvedInput = buildStepInput(step, simulatedSteps, variables, contextualPreviousStep)
      if (!(step.emailTo?.trim()) || !(step.emailSubject?.trim())) {
        processedStepIds.add(step.id)
        dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'error', reason: `Step ${index + 1} is missing email recipients or subject.` })
        simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: '', status: 'error', error: 'missing email config' })
        queueOutgoingTransitions(step, 'missing email config', 'error')
        continue
      }
      const simulatedOutput = `[dry-run email delivery: ${step.emailTo}]`
      processedStepIds.add(step.id)
      dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'would-run', ...(step.exportVar?.trim() ? { exportedVar: step.exportVar.trim() } : {}) })
      simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: simulatedOutput, status: 'success' })
      queueOutgoingTransitions(step, simulatedOutput)
      continue
    }

    if (isPureStructuralNode(nodeType)) {
      const resolvedInput = buildStepInput(step, simulatedSteps, variables)
      const joinIncomingIndices = nodeType === 'join'
        ? [...(joinArrivals.get(step.id) ?? new Set<string>())].flatMap((sourceStepId) => {
            const sourceIndex = stepIndexById.get(sourceStepId)
            return sourceIndex === undefined ? [] : [sourceIndex]
          })
        : []
      const simulatedOutput = nodeType === 'start'
        ? resolveStartNodeOutput(step, variables)
        : nodeType === 'end'
          ? resolveEndNodeOutput(step, simulatedSteps, variables)
          : nodeType === 'join'
            ? resolveJoinNodeOutput(step, simulatedSteps, joinIncomingIndices)
          : buildStructuralNodeOutput(step)
      processedStepIds.add(step.id)
      dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'would-run' })
      simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: simulatedOutput, status: 'success' })
      queueOutgoingTransitions(step, simulatedOutput)
      continue
    }

    if (nodeType === 'pipeline') {
      const resolvedInput = buildStepInput(step, simulatedSteps, variables)
      const targetReference = step.pipelineTargetId?.trim()
      if (!targetReference) {
        processedStepIds.add(step.id)
        dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'error', reason: `Step ${index + 1} is missing a target pipeline id.` })
        simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: '', status: 'error', error: 'missing pipeline target' })
        queueOutgoingTransitions(step, 'missing pipeline target', 'error')
        continue
      }
      const targetPipeline = state.agentPipelines.find((item) => item.id === targetReference || item.name.toLowerCase() === targetReference.toLowerCase())
      if (!targetPipeline) {
        processedStepIds.add(step.id)
        dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'error', reason: `Step ${index + 1} references an unknown nested pipeline.` })
        simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: '', status: 'error', error: 'missing nested pipeline' })
        queueOutgoingTransitions(step, 'missing nested pipeline', 'error')
        continue
      }
      const simulatedOutput = `[dry-run nested pipeline: ${targetPipeline.name}]`
      processedStepIds.add(step.id)
      dryRunSteps.push({ ...baseEntry, resolvedInput, status: 'would-run', ...(step.exportVar?.trim() ? { exportedVar: step.exportVar.trim() } : {}) })
      simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: resolvedInput, output: simulatedOutput, status: 'success' })
      const exportName = step.exportVar?.trim()
      if (exportName && EXPORT_VAR_NAME_PATTERN.test(exportName)) {
        variables[exportName] = simulatedOutput
      }
      queueOutgoingTransitions(step, simulatedOutput)
      continue
    }

    const agent = nodeTypeUsesAgentRuntime(nodeType) ? state.agents.find((item) => item.id === step.agentId) : undefined

    if (!agent) {
      processedStepIds.add(step.id)
      dryRunSteps.push({ ...baseEntry, resolvedInput: '', status: 'error', reason: `Step ${index + 1} references a missing agent.` })
      simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: '', output: '', status: 'error', error: 'missing agent' })
      queueOutgoingTransitions(step, 'missing agent', 'error')
      continue
    }

    const model = resolvePipelineModel(agent, state.models, step)
    if (!model) {
      processedStepIds.add(step.id)
      dryRunSteps.push({
        ...baseEntry,
        resolvedInput: buildStepInput(step, simulatedSteps, variables, contextualPreviousStep),
        status: 'error',
        reason: `Step ${index + 1} agent "${agent.name}" has no runnable model.`,
      })
      simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: '', output: '', status: 'error', error: 'no model' })
      queueOutgoingTransitions(step, 'no model', 'error')
      continue
    }

    const resolvedInput = buildStepInput(step, simulatedSteps, variables, contextualPreviousStep)
    const simulatedOutput = `[dry-run output for step ${index + 1}]`
    processedStepIds.add(step.id)
    dryRunSteps.push({
      ...baseEntry,
      resolvedInput,
      modelId: model.id,
      status: 'would-run',
      ...(step.exportVar?.trim() ? { exportedVar: step.exportVar.trim() } : {}),
    })
    // Simulate a successful step so downstream `runIf` and references work.
    simulatedSteps.push({
      stepIndex: index,
      agentId: step.agentId,
      task: step.task,
      input: resolvedInput,
      output: simulatedOutput,
      status: 'success',
    })
    // Publish exported variable so downstream `{{vars.NAME}}` and `runIf` see it.
    const exportName = step.exportVar?.trim()
    if (exportName && EXPORT_VAR_NAME_PATTERN.test(exportName)) {
      variables[exportName] = simulatedOutput
    }
    queueOutgoingTransitions(step, simulatedOutput)
  }

  skipUnvisitedSteps('Skipped because this workflow path was not selected.')

  return {
    pipelineId: pipeline.id,
    pipelineName: pipeline.name,
    steps: dryRunSteps,
    visitedStepIndices,
    variables,
    validationErrors: validation.errors.map((issue) => issue.message),
    validationWarnings: validation.warnings.map((issue) => issue.message),
    valid: validation.valid,
    ...(budgetExceeded ? { budgetExceeded } : {}),
  }
}

export async function executePipelineById(
  pipelineId: string,
  options: ExecuteAgentPipelineOptions = {},
): Promise<AgentPipelineExecution> {
  const pipelines = await loadAvailablePipelines()
  const pipeline = pipelines.find((item) => item.id === pipelineId)

  if (!pipeline) {
    const failedExecution: AgentPipelineExecution = {
      id: generateId('pipe-exec'),
      pipelineId,
      pipelineName: 'Unknown Pipeline',
      trigger: options.trigger ?? 'manual',
      ...(options.timerId ? { timerId: options.timerId } : {}),
      startedAt: Date.now(),
      completedAt: Date.now(),
      status: 'error',
      steps: [],
      error: 'Pipeline not found',
    }

    const { workspacePath } = useAppStore.getState()
    if (options.persistExecution !== false && workspacePath) {
      await appendPipelineExecutionToDisk(workspacePath, failedExecution)
    }

    return failedExecution
  }

  return executeAgentPipeline(pipeline, options)
}

export async function executePipelineByReference(
  reference: string,
  options: ExecuteAgentPipelineOptions = {},
): Promise<AgentPipelineExecution> {
  const resolution = await resolvePipelineByReference(reference)

  if (resolution.status !== 'found') {
    const runId = generateId('run')
    const isAmbiguous = resolution.status === 'ambiguous'
    const error = isAmbiguous
      ? `Pipeline reference is ambiguous: ${resolution.matches.map((pipeline) => pipeline.name).join(', ')}`
      : 'Pipeline not found'
    const failedExecution: AgentPipelineExecution = {
      id: generateId('pipe-exec'),
      runId,
      pipelineId: reference,
      pipelineName: reference.trim() || 'Unknown Pipeline',
      trigger: options.trigger ?? 'manual',
      ...(options.timerId ? { timerId: options.timerId } : {}),
      startedAt: Date.now(),
      completedAt: Date.now(),
      status: 'error',
      steps: [],
      error,
      recoveryActions: [{ id: 'edit-pipeline', label: isAmbiguous ? 'Choose an exact pipeline name' : 'Open pipeline list' }],
    }

    const { workspacePath } = useAppStore.getState()
    if (options.persistExecution !== false && workspacePath) {
      await appendPipelineExecutionToDisk(workspacePath, failedExecution)
    }

    return failedExecution
  }

  return executeAgentPipeline(resolution.pipeline, options)
}
