import type { Agent, AgentPipeline, AgentPipelineExecution, AgentPipelineExecutionStep, Model, Skill } from '@/types'
import type { ModelMessage } from 'ai'
import { generateResponse, initializeProvider, streamResponseWithTools } from '@/services/aiService'
import { appendPipelineExecutionToDisk, loadPipelinesFromDisk, savePipelineToDisk } from '@/services/pipelineFiles'
import { buildSystemPrompt, getSkillSystemPrompts, getToolsForAgent, mergeSkillsWithBuiltins } from '@/services/tools'
import { useAppStore } from '@/store/appStore'
import { generateId } from '@/utils/helpers'

const PIPELINE_REFERENCE_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g
const STEP_REFERENCE_PATTERN = /^(?:steps\[(\d+)\]|step(\d+))\.(output|input|task|status|error)$/i

type PipelineStepRuntimeValue = Pick<AgentPipelineExecutionStep, 'stepIndex' | 'agentId' | 'task' | 'input' | 'output' | 'status' | 'error'>

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
}

export interface AgentPipelineProgressStep {
  stepIndex: number
  agentId: string
  agentName?: string
  task: string
  input: string
  output?: string
  status: 'pending' | 'running' | 'success' | 'error'
  startedAt?: number
  completedAt?: number
  durationMs?: number
  error?: string
}

function resolvePipelineReference(
  reference: string,
  previousSteps: PipelineStepRuntimeValue[],
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

  const stepMatch = normalized.match(STEP_REFERENCE_PATTERN)
  if (!stepMatch) return undefined

  const rawIndex = Number(stepMatch[1] ?? stepMatch[2])
  if (!Number.isFinite(rawIndex) || rawIndex < 1) return undefined

  const referencedStep = previousSteps[rawIndex - 1]
  if (!referencedStep) return undefined

  const field = stepMatch[3] as 'output' | 'input' | 'task' | 'status' | 'error'
  const value = referencedStep[field]
  return value == null ? undefined : String(value)
}

function resolvePipelineTemplate(
  task: string,
  previousSteps: PipelineStepRuntimeValue[],
): { resolvedTask: string; usedReferences: boolean } {
  let usedReferences = false

  const resolvedTask = task.replace(PIPELINE_REFERENCE_PATTERN, (_match, rawReference: string) => {
    usedReferences = true
    const value = resolvePipelineReference(rawReference, previousSteps)
    return value == null || value === ''
      ? `[Missing ${rawReference.trim()}]`
      : value
  })

  return { resolvedTask, usedReferences }
}

function buildStepInput(
  step: AgentPipeline['steps'][number],
  previousSteps: PipelineStepRuntimeValue[],
): string {
  const { resolvedTask, usedReferences } = resolvePipelineTemplate(step.task, previousSteps)
  const previousOutput = previousSteps[previousSteps.length - 1]?.output ?? previousSteps[previousSteps.length - 1]?.error

  return previousOutput && !usedReferences
    ? `Previous step output:\n${previousOutput}\n\nCurrent step task:\n${resolvedTask}`
    : resolvedTask
}

function requiresStreaming(tools: Record<string, unknown>, hasStepUpdates: boolean): boolean {
  return hasStepUpdates || Object.keys(tools).length > 0
}

function resolvePipelineModel(agent: Agent, models: Model[]): Model | undefined {
  if (agent.modelId) {
    return models.find((model) => model.id === agent.modelId)
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

  return pipelines.find((pipeline) => pipeline.name.toLowerCase().includes(lowerReference)) ?? null
}

export async function executeAgentPipeline(
  pipeline: AgentPipeline,
  options: ExecuteAgentPipelineOptions = {},
): Promise<AgentPipelineExecution> {
  const state = useAppStore.getState()
  const executionStart = Date.now()
  const executionSteps: AgentPipelineExecutionStep[] = []
  const executionContextCache = new Map<string, ReturnType<typeof buildPipelineExecutionContext>>()
  const initializedProviders = new Set<string>()
  let previousOutput = ''
  let didFail = false
  let executionError: string | undefined

  for (const [index, step] of pipeline.steps.entries()) {
    // Respect cancellation between steps.
    if (options.abortSignal?.aborted) {
      const completedAt = Date.now()
      executionSteps.push({
        id: generateId('pipe-step'),
        stepIndex: index,
        agentId: step.agentId,
        task: step.task,
        input: buildStepInput(step, executionSteps),
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

    const stepStart = Date.now()
    const input = buildStepInput(step, executionSteps)
    const agent = state.agents.find((item) => item.id === step.agentId)
    if (!agent) {
      const completedAt = Date.now()
      executionSteps.push({
        id: generateId('pipe-step'),
        stepIndex: index,
        agentId: step.agentId,
        task: step.task,
        input,
        status: 'error',
        startedAt: stepStart,
        completedAt,
        durationMs: completedAt - stepStart,
        error: 'Agent not found',
      })
      previousOutput = 'Agent not found'
      didFail = true
      executionError = executionError ?? 'Agent not found'
      continue
    }

    const model = resolvePipelineModel(agent, state.models)
    const progressBase: AgentPipelineProgressStep = {
      stepIndex: index,
      agentId: step.agentId,
      agentName: agent.name,
      task: step.task,
      input,
      status: 'running',
      startedAt: stepStart,
    }
    options.onStepUpdate?.(progressBase)

    if (!model) {
      const completedAt = Date.now()
      executionSteps.push({
        id: generateId('pipe-step'),
        stepIndex: index,
        agentId: step.agentId,
        task: step.task,
        input,
        status: 'error',
        startedAt: stepStart,
        completedAt,
        durationMs: completedAt - stepStart,
        error: 'No model available',
      })
      options.onStepUpdate?.({
        ...progressBase,
        status: 'error',
        completedAt,
        durationMs: completedAt - stepStart,
        error: 'No model available',
      })
      previousOutput = 'No model available'
      didFail = true
      executionError = executionError ?? 'No model available'
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

    try {
      let output = ''
      const shouldStream = requiresStreaming(tools as Record<string, unknown>, Boolean(options.onStepUpdate))

      if (shouldStream) {
        let streamError: string | undefined
        for await (const event of streamResponseWithTools(modelIdentifier, messages, {
          systemPrompt,
          tools,
          maxSteps: Math.max(2, Math.min(agent.maxTurns ?? 5, 30)),
          apiKey: model.apiKey,
          baseUrl: model.baseUrl,
          ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
        })) {
          if (event.type === 'text-delta') {
            output += event.text
            options.onStepUpdate?.({
              ...progressBase,
              output,
            })
          } else if (event.type === 'error') {
            streamError = event.error
          }
        }

        if (streamError) {
          throw new Error(streamError)
        }
      } else {
        output = await generateResponse(modelIdentifier, messages, systemPrompt, model.apiKey, model.baseUrl)
      }

      const completedAt = Date.now()
      executionSteps.push({
        id: generateId('pipe-step'),
        stepIndex: index,
        agentId: step.agentId,
        task: step.task,
        input,
        output,
        status: 'success',
        startedAt: stepStart,
        completedAt,
        durationMs: completedAt - stepStart,
      })
      options.onStepUpdate?.({
        ...progressBase,
        output,
        status: 'success',
        completedAt,
        durationMs: completedAt - stepStart,
      })
      previousOutput = output
    } catch (error) {
      const completedAt = Date.now()
      const message = error instanceof Error ? error.message : String(error)
      executionSteps.push({
        id: generateId('pipe-step'),
        stepIndex: index,
        agentId: step.agentId,
        task: step.task,
        input,
        status: 'error',
        startedAt: stepStart,
        completedAt,
        durationMs: completedAt - stepStart,
        error: message,
      })
      options.onStepUpdate?.({
        ...progressBase,
        status: 'error',
        completedAt,
        durationMs: completedAt - stepStart,
        error: message,
      })
      previousOutput = message
      didFail = true
      executionError = executionError ?? message
    }
  }

  const completedAt = Date.now()
  const execution: AgentPipelineExecution = {
    id: generateId('pipe-exec'),
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
  }

  if (options.persistExecution !== false && state.workspacePath) {
    await appendPipelineExecutionToDisk(state.workspacePath, execution)
  }

  if (options.persistLastRun !== false) {
    await persistPipelineRunMetadata(pipeline.id, completedAt)
  }

  return execution
}

export async function executePipelineById(
  pipelineId: string,
  options: ExecuteAgentPipelineOptions = {},
): Promise<AgentPipelineExecution> {
  const state = useAppStore.getState()
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

    if (options.persistExecution !== false && state.workspacePath) {
      await appendPipelineExecutionToDisk(state.workspacePath, failedExecution)
    }

    return failedExecution
  }

  return executeAgentPipeline(pipeline, options)
}

export async function executePipelineByReference(
  reference: string,
  options: ExecuteAgentPipelineOptions = {},
): Promise<AgentPipelineExecution> {
  const state = useAppStore.getState()
  const pipeline = await findPipelineByReference(reference)

  if (!pipeline) {
    const failedExecution: AgentPipelineExecution = {
      id: generateId('pipe-exec'),
      pipelineId: reference,
      pipelineName: reference.trim() || 'Unknown Pipeline',
      trigger: options.trigger ?? 'manual',
      ...(options.timerId ? { timerId: options.timerId } : {}),
      startedAt: Date.now(),
      completedAt: Date.now(),
      status: 'error',
      steps: [],
      error: 'Pipeline not found',
    }

    if (options.persistExecution !== false && state.workspacePath) {
      await appendPipelineExecutionToDisk(state.workspacePath, failedExecution)
    }

    return failedExecution
  }

  return executeAgentPipeline(pipeline, options)
}
