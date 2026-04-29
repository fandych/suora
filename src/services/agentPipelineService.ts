import type { Agent, AgentPipeline, AgentPipelineExecution, AgentPipelineExecutionStep, Model, PipelineRecoveryAction, PipelineStepUsage, Skill } from '@/types'
import type { ModelMessage } from 'ai'
import { generateResponse, initializeProvider, streamResponseWithTools } from '@/services/aiService'
import { appendPipelineExecutionToDisk, loadPipelinesFromDisk, savePipelineToDisk } from '@/services/pipelineFiles'
import { buildSystemPrompt, getSkillSystemPrompts, getToolsForAgent, mergeSkillsWithBuiltins } from '@/services/tools'
import { sanitizeSensitiveText } from '@/services/sanitization'
import { buildPipelineRecoveryActions, validateAgentPipeline } from '@/services/pipelineValidation'
import { evaluateRunIf } from '@/services/pipelineRunIf'
import { applyOutputTransform } from '@/services/pipelineOutputTransforms'
import { useAppStore } from '@/store/appStore'
import { generateId } from '@/utils/helpers'

const PIPELINE_REFERENCE_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g
const STEP_REFERENCE_PATTERN = /^(?:steps\[(\d+)\]|step(\d+))\.(output|input|task|status|error)$/i
const VARIABLE_REFERENCE_PATTERN = /^vars\.([A-Za-z_][A-Za-z0-9_]*)$/
/** Same shape as VARIABLE_REFERENCE_PATTERN's capture group — used to gate `exportVar` writes. */
const EXPORT_VAR_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

type PipelineStepRuntimeValue = Pick<AgentPipelineExecutionStep, 'stepIndex' | 'agentId' | 'task' | 'input' | 'output' | 'status' | 'error'>
const MAX_STEP_RETRIES = 3
const MAX_PIPELINE_REFERENCE_CHARS = 24_000
const MAX_PIPELINE_HANDOFF_CHARS = 32_000
const MAX_PIPELINE_INPUT_CHARS = 80_000
const PIPELINE_ERROR_MAX_CHARS = 1_000
const DEFAULT_STEP_TIMEOUT_MS = 5 * 60 * 1000

export interface ExecuteAgentPipelineOptions {
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
): string | undefined {
  const normalized = reference.trim().toLowerCase()
  const previousStep = previousSteps[previousSteps.length - 1]

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
): { resolvedTask: string; usedReferences: boolean } {
  let usedReferences = false

  const resolvedTask = task.replace(PIPELINE_REFERENCE_PATTERN, (_match, rawReference: string) => {
    usedReferences = true
    const value = resolvePipelineReference(rawReference, previousSteps, variables)
    // Return value directly from function to avoid $-substitution in replacement string
    if (value == null || value === '') return `[Missing ${rawReference.trim()}]`
    return value
  })

  return { resolvedTask, usedReferences }
}

function buildStepInput(
  step: AgentPipeline['steps'][number],
  previousSteps: PipelineStepRuntimeValue[],
  variables: Record<string, string> = {},
): string {
  const { resolvedTask, usedReferences } = resolvePipelineTemplate(step.task, previousSteps, variables)
  const latestProducedStep = findLatestProducedStep(previousSteps)
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

function clampStepOutput(step: AgentPipeline['steps'][number], output: string): { output: string; warnings?: string[] } {
  const maxOutputChars = step.maxOutputChars ?? MAX_PIPELINE_HANDOFF_CHARS
  if (output.length <= maxOutputChars) return { output }
  return {
    output: clampPipelineText('Pipeline step output', output, maxOutputChars),
    warnings: [`Step output truncated from ${output.length.toLocaleString()} to ${maxOutputChars.toLocaleString()} characters.`],
  }
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
    await savePipelineToDisk(state.workspacePath, updatedPipeline)
  }
}

async function buildPipelineExecutionContext(agent: Agent) {
  const state = useAppStore.getState()
  const allSkills = mergeSkillsWithBuiltins((state.skills ?? []) as Skill[])
  const tools = getToolsForAgent(agent.skills, allSkills, {
    allowedTools: agent.allowedTools,
    disallowedTools: agent.disallowedTools,
    permissionMode: agent.permissionMode as 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions' | undefined,
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

export async function executeAgentPipeline(
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

  const skipRemainingSteps = (fromIndex: number, reason: string) => {
    const skippedAt = Date.now()
    for (let skippedIndex = fromIndex; skippedIndex < pipeline.steps.length; skippedIndex += 1) {
      const skippedStep = pipeline.steps[skippedIndex]
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

  for (const [index, step] of pipeline.steps.entries()) {
    if (step.enabled === false) {
      const skippedAt = Date.now()
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
        previousOutput = message
        didFail = true
        executionError = executionError ?? message
        if (step.continueOnError === false) {
          skipRemainingSteps(index + 1, 'Skipped after previous step failed')
          break
        }
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
        continue
      }
    }

    // Respect cancellation between steps.
    if (options.abortSignal?.aborted) {
      const completedAt = Date.now()
      executionSteps.push({
        id: generateId('pipe-step'),
        runId,
        stepIndex: index,
        agentId: step.agentId,
        ...(step.name?.trim() ? { name: step.name.trim() } : {}),
        task: step.task,
        input: buildStepInput(step, executionSteps, variables),
        status: 'error',
        startedAt: completedAt,
        completedAt,
        durationMs: 0,
        error: 'Cancelled by user',
      })
      didFail = true
      executionError = executionError ?? 'Cancelled by user'
      continue
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

    if (!step.task.trim()) {
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
      previousOutput = message
      didFail = true
      executionError = executionError ?? message
      if (step.continueOnError === false) {
        skipRemainingSteps(index + 1, 'Skipped after previous step failed')
        break
      }
      continue
    }

    const stepStart = Date.now()
    const input = buildStepInput(step, executionSteps, variables)
    const runtimeState = useAppStore.getState()
    const agent = runtimeState.agents.find((item) => item.id === step.agentId)
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
      previousOutput = 'Agent not found'
      didFail = true
      executionError = executionError ?? 'Agent not found'
      if (step.continueOnError === false) {
        skipRemainingSteps(index + 1, 'Skipped after previous step failed')
        break
      }
      continue
    }

    const model = resolvePipelineModel(agent, runtimeState.models, step)
    const progressBase: AgentPipelineProgressStep = {
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
    options.onStepUpdate?.(progressBase)

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
        ...progressBase,
        status: 'error',
        completedAt,
        durationMs: completedAt - stepStart,
        attempts: 1,
        error: 'No model available',
        recoveryActions,
      })
      previousOutput = 'No model available'
      didFail = true
      executionError = executionError ?? 'No model available'
      if (step.continueOnError === false) {
        skipRemainingSteps(index + 1, 'Skipped after previous step failed')
        break
      }
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

    const { systemPrompt, tools } = await executionContext
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
          ...progressBase,
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
                  ...progressBase,
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
                  ...progressBase,
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
            ...progressBase,
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
        ...progressBase,
        output: outputResult.output,
        status: 'success',
        completedAt,
        durationMs: completedAt - stepStart,
        attempts,
        ...(stepUsage ? { usage: stepUsage } : {}),
      })
      previousOutput = outputResult.output
      // Publish exported variable so subsequent steps can reference it via
      // `{{vars.NAME}}` and `runIf`. Validation has already enforced that the
      // name is identifier-shaped, but we re-check here as a defense-in-depth
      // guard against pipelines mutated post-validation.
      const exportName = step.exportVar?.trim()
      if (exportName && EXPORT_VAR_NAME_PATTERN.test(exportName)) {
        variables[exportName] = outputResult.output
      }

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
        ...progressBase,
        status: 'error',
        completedAt,
        durationMs: completedAt - stepStart,
        attempts: Math.max(1, attempts),
        error: message,
        recoveryActions,
      })
      previousOutput = message
      didFail = true
      executionError = executionError ?? message
      if (step.continueOnError === false) {
        skipRemainingSteps(index + 1, 'Skipped after previous step failed')
        break
      }
    }
  }

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
  const simulatedSteps: PipelineStepRuntimeValue[] = []
  const dryRunSteps: DryRunStepResult[] = []
  let executedStepCount = 0
  let budgetExceeded: AgentPipelineExecution['budgetExceeded']

  for (const [index, step] of pipeline.steps.entries()) {
    const baseEntry = {
      stepIndex: index,
      agentId: step.agentId,
      ...(step.name?.trim() ? { name: step.name.trim() } : {}),
      task: step.task,
    } satisfies Pick<DryRunStepResult, 'stepIndex' | 'agentId' | 'name' | 'task'>

    if (step.enabled === false) {
      dryRunSteps.push({ ...baseEntry, resolvedInput: '', status: 'disabled', reason: 'Step disabled' })
      simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: '', output: '', status: 'skipped', error: 'Step disabled' })
      continue
    }

    if (step.runIf?.trim()) {
      try {
        const conditionResult = evaluateRunIf(step.runIf, simulatedSteps, variables)
        if (!conditionResult.passed) {
          const reason = conditionResult.reason ?? `Condition not met: ${step.runIf}`
          dryRunSteps.push({ ...baseEntry, resolvedInput: '', status: 'skipped', reason })
          simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: '', output: '', status: 'skipped', error: reason })
          continue
        }
      } catch (error) {
        const reason = `Invalid runIf condition: ${(error as Error).message}`
        dryRunSteps.push({ ...baseEntry, resolvedInput: '', status: 'error', reason })
        simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: '', output: '', status: 'error', error: reason })
        continue
      }
    }

    executedStepCount += 1
    const stepCap = pipeline.budget?.maxStepCount
    if (typeof stepCap === 'number' && stepCap > 0 && executedStepCount > stepCap) {
      budgetExceeded = { type: 'steps', limit: stepCap, observed: executedStepCount }
      const reason = `Pipeline budget exceeded: ${executedStepCount} executed steps > ${stepCap}`
      dryRunSteps.push({ ...baseEntry, resolvedInput: '', status: 'skipped', reason })
      // Mark all remaining steps as skipped too.
      for (let remaining = index + 1; remaining < pipeline.steps.length; remaining += 1) {
        const remainingStep = pipeline.steps[remaining]
        dryRunSteps.push({
          stepIndex: remaining,
          agentId: remainingStep.agentId,
          ...(remainingStep.name?.trim() ? { name: remainingStep.name.trim() } : {}),
          task: remainingStep.task,
          resolvedInput: '',
          status: 'skipped',
          reason,
        })
      }
      break
    }

    const agent = state.agents.find((item) => item.id === step.agentId)
    if (!agent) {
      dryRunSteps.push({ ...baseEntry, resolvedInput: '', status: 'error', reason: `Step ${index + 1} references a missing agent.` })
      simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: '', output: '', status: 'error', error: 'missing agent' })
      continue
    }

    const model = resolvePipelineModel(agent, state.models, step)
    if (!model) {
      dryRunSteps.push({
        ...baseEntry,
        resolvedInput: buildStepInput(step, simulatedSteps, variables),
        status: 'error',
        reason: `Step ${index + 1} agent "${agent.name}" has no runnable model.`,
      })
      simulatedSteps.push({ stepIndex: index, agentId: step.agentId, task: step.task, input: '', output: '', status: 'error', error: 'no model' })
      continue
    }

    const resolvedInput = buildStepInput(step, simulatedSteps, variables)
    const simulatedOutput = `[dry-run output for step ${index + 1}]`
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
  }

  return {
    pipelineId: pipeline.id,
    pipelineName: pipeline.name,
    steps: dryRunSteps,
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
