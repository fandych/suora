import type { AgentPipeline, AgentPipelineExecution } from '@/types'
import type { ExecuteAgentPipelineOptions } from '@/services/agentPipelineService'

export type PipelineExecutionEngine = 'auto' | 'legacy' | 'workflow'
export const WORKFLOW_ENGINE_FALLBACK_WARNING =
  'Workflow SDK path is enabled but runtime world integration is not configured; execution used the legacy pipeline executor.'

interface ExecutePipelineWithRoutingArgs {
  pipeline: AgentPipeline
  options: ExecuteAgentPipelineOptions
  executeLegacy: (pipeline: AgentPipeline, options: ExecuteAgentPipelineOptions) => Promise<AgentPipelineExecution>
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

export async function executePipelineWithEngineRouting({
  pipeline,
  options,
  executeLegacy,
}: ExecutePipelineWithRoutingArgs): Promise<AgentPipelineExecution> {
  const trigger = options.trigger ?? 'manual'
  const engine = resolveExecutionEngine(options.executionEngine, trigger)
  if (engine === 'legacy') {
    return executeLegacy(pipeline, options)
  }

  // TODO(workflow-runtime): Switch this route to native Workflow SDK execution
  // once Electron-side world/bootstrap integration is available.
  // Suora currently runs the pipeline executor in Electron renderer/runtime
  // without Workflow SDK world/bootstrap integration, so we keep behavior
  // stable by routing through the existing executor.
  const execution = await executeLegacy(pipeline, options)
  return appendRuntimeWarning(execution, WORKFLOW_ENGINE_FALLBACK_WARNING)
}

export function getResolvedPipelineExecutionEngine(
  requested?: PipelineExecutionEngine,
  trigger: AgentPipelineExecution['trigger'] = 'manual',
): 'legacy' | 'workflow' {
  return resolveExecutionEngine(requested, trigger)
}
