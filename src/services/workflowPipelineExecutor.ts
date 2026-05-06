import type { AgentPipeline, AgentPipelineExecution } from '@/types'
import type { ExecuteAgentPipelineOptions } from '@/services/agentPipelineService'

export type PipelineExecutionEngine = 'auto' | 'legacy' | 'workflow'

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
  const processValue = typeof process !== 'undefined'
    ? normalizeEngine(process.env.PIPELINE_EXECUTION_ENGINE ?? process.env.VITE_PIPELINE_EXECUTION_ENGINE)
    : 'auto'
  return processValue
}

function resolveExecutionEngine(requested: PipelineExecutionEngine | undefined): 'legacy' | 'workflow' {
  const target = requested ?? 'auto'
  if (target === 'legacy' || target === 'workflow') return target
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
  const engine = resolveExecutionEngine(options.executionEngine)
  if (engine === 'legacy') {
    return executeLegacy(pipeline, options)
  }

  // Suora currently runs the pipeline executor in Electron renderer/runtime
  // without Workflow SDK world/bootstrap integration. Keep behavior stable by
  // routing through the existing executor until runtime wiring lands.
  const execution = await executeLegacy(pipeline, options)
  return appendRuntimeWarning(
    execution,
    'Workflow SDK path is enabled but runtime world integration is not configured; execution used the legacy pipeline executor.',
  )
}

export function getResolvedPipelineExecutionEngine(requested?: PipelineExecutionEngine): 'legacy' | 'workflow' {
  return resolveExecutionEngine(requested)
}
