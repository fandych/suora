import type { AgentPipelineExecution } from '@/types'
import { t } from '@/services/i18n'

type Translate = (key: string, fallback?: string) => string

export function formatPipelineExecutionEngineLabel(
  engine: 'legacy' | 'workflow' | undefined,
  translate: Translate = t,
): string | null {
  if (engine === 'workflow') return translate('agents.pipelineExecutionEngineWorkflow', 'Workflow')
  if (engine === 'legacy') return translate('agents.pipelineExecutionEngineLegacy', 'Legacy')
  return null
}

export function formatPipelineExecutionFallbackReason(
  reason: 'workflow_executor_unavailable' | 'workflow_executor_error' | undefined,
  translate: Translate = t,
): string | null {
  if (reason === 'workflow_executor_unavailable') {
    return translate('agents.pipelineFallbackReasonUnavailable', 'Workflow executor unavailable')
  }
  if (reason === 'workflow_executor_error') {
    return translate('agents.pipelineFallbackReasonError', 'Workflow executor failed and fell back to legacy')
  }
  return null
}

export function buildPipelineExecutionNotificationMessage(
  execution: AgentPipelineExecution,
  translate: Translate = t,
): string | undefined {
  const preview = execution.error || execution.finalOutput?.slice(0, 120) || undefined
  const engineLabel = formatPipelineExecutionEngineLabel(execution.runtime?.executionEngine, translate)
  const fallbackLabel = formatPipelineExecutionFallbackReason(execution.runtime?.executionFallbackReason, translate)
  const diagnostic = engineLabel
    ? `${translate('agents.pipelineExecutionEngine', 'Execution engine')}: ${engineLabel}`
    : null

  return [preview, diagnostic, fallbackLabel].filter(Boolean).join(' • ') || undefined
}
