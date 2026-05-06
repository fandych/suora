import type { AgentPipeline, AgentPipelineExecution } from '@/types'
import type { ExecuteAgentPipelineOptions } from '@/services/agentPipelineService'

export type PipelineExecutionEngine = 'auto' | 'legacy' | 'workflow'
type PipelineExecutionFallbackReason = 'workflow_executor_unavailable' | 'workflow_executor_error'
export const WORKFLOW_ENGINE_FALLBACK_WARNING =
  'Workflow SDK path is enabled but the Workflow executor is not configured; execution used the legacy pipeline executor.'

interface ExecutePipelineWithRoutingArgs {
  pipeline: AgentPipeline
  options: ExecuteAgentPipelineOptions
  executeLegacy: (pipeline: AgentPipeline, options: ExecuteAgentPipelineOptions) => Promise<AgentPipelineExecution>
  executeWorkflow?: (pipeline: AgentPipeline, options: ExecuteAgentPipelineOptions) => Promise<AgentPipelineExecution>
}

function normalizeEngine(value: string | undefined): PipelineExecutionEngine {
  if (value === 'legacy' || value === 'workflow' || value === 'auto') return value
  return 'auto'
}

function readConfiguredDefaultEngine(): PipelineExecutionEngine {
  const configuredEngine = typeof process !== 'undefined'
    ? normalizeEngine(process.env.PIPELINE_EXECUTION_ENGINE ?? process.env.VITE_PIPELINE_EXECUTION_ENGINE)
    : 'auto'
  return configuredEngine
}

function readConfiguredTriggerEngine(trigger: AgentPipelineExecution['trigger']): PipelineExecutionEngine {
  if (typeof process === 'undefined') return 'auto'
  const keyByTrigger: Record<AgentPipelineExecution['trigger'], [string, string]> = {
    manual: ['PIPELINE_EXECUTION_ENGINE_MANUAL', 'VITE_PIPELINE_EXECUTION_ENGINE_MANUAL'],
    chat: ['PIPELINE_EXECUTION_ENGINE_CHAT', 'VITE_PIPELINE_EXECUTION_ENGINE_CHAT'],
    timer: ['PIPELINE_EXECUTION_ENGINE_TIMER', 'VITE_PIPELINE_EXECUTION_ENGINE_TIMER'],
  }
  const [primary, fallback] = keyByTrigger[trigger]
  const triggerScoped = normalizeEngine(process.env[primary] ?? process.env[fallback])
  if (triggerScoped !== 'auto') return triggerScoped
  return 'auto'
}

function resolveExecutionEngine(
  requested: PipelineExecutionEngine | undefined,
  trigger: AgentPipelineExecution['trigger'],
): 'legacy' | 'workflow' {
  const target = requested ?? 'auto'
  if (target === 'legacy' || target === 'workflow') return target
  const triggerScoped = readConfiguredTriggerEngine(trigger)
  if (triggerScoped === 'workflow') return 'workflow'
  if (triggerScoped === 'legacy') return 'legacy'
  const configured = readConfiguredDefaultEngine()
  return configured === 'workflow' ? 'workflow' : 'legacy'
}

function appendRuntimeWarning(execution: AgentPipelineExecution, warning: string): AgentPipelineExecution {
  const runtime = execution.runtime
  if (!runtime) return execution
  const existing = runtime.validationWarnings ?? []
  if (existing.includes(warning)) return execution
  return {
    ...execution,
    runtime: {
      ...runtime,
      validationWarnings: [...existing, warning],
    },
  }
}

function appendRuntimeExecutionMetadata(
  execution: AgentPipelineExecution,
  engine: Exclude<PipelineExecutionEngine, 'auto'>,
  fallbackReason?: PipelineExecutionFallbackReason,
): AgentPipelineExecution {
  const runtime = execution.runtime
  if (!runtime) return execution
  return {
    ...execution,
    runtime: {
      ...runtime,
      executionEngine: engine,
      ...(fallbackReason ? { executionFallbackReason: fallbackReason } : {}),
    },
  }
}

export async function executePipelineWithEngineRouting({
  pipeline,
  options,
  executeLegacy,
  executeWorkflow,
}: ExecutePipelineWithRoutingArgs): Promise<AgentPipelineExecution> {
  const trigger = options.trigger ?? 'manual'
  const engine = resolveExecutionEngine(options.executionEngine, trigger)
  if (engine === 'legacy') {
    const execution = await executeLegacy(pipeline, options)
    return appendRuntimeExecutionMetadata(execution, 'legacy')
  }

  if (executeWorkflow) {
    try {
      const execution = await executeWorkflow(pipeline, options)
      return appendRuntimeExecutionMetadata(execution, 'workflow')
    } catch {
      const execution = await executeLegacy(pipeline, options)
      return appendRuntimeExecutionMetadata(
        appendRuntimeWarning(execution, WORKFLOW_ENGINE_FALLBACK_WARNING),
        'legacy',
        'workflow_executor_error',
      )
    }
  }

  // TODO(workflow-runtime): Wire executeWorkflow with native Workflow SDK
  // world/bootstrap integration in Electron runtime.
  const execution = await executeLegacy(pipeline, options)
  return appendRuntimeExecutionMetadata(
    appendRuntimeWarning(execution, WORKFLOW_ENGINE_FALLBACK_WARNING),
    'legacy',
    'workflow_executor_unavailable',
  )
}

export function getResolvedPipelineExecutionEngine(
  requested?: PipelineExecutionEngine,
  trigger: AgentPipelineExecution['trigger'] = 'manual',
): 'legacy' | 'workflow' {
  return resolveExecutionEngine(requested, trigger)
}
