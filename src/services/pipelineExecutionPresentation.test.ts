import { describe, expect, it } from 'vitest'
import type { AgentPipelineExecution } from '@/types'
import {
  buildPipelineExecutionNotificationMessage,
  formatPipelineExecutionEngineLabel,
  formatPipelineExecutionFallbackReason,
} from './pipelineExecutionPresentation'

const baseExecution: AgentPipelineExecution = {
  id: 'exec-1',
  pipelineId: 'pipeline-1',
  pipelineName: 'Morning Run',
  trigger: 'manual',
  startedAt: 10,
  completedAt: 20,
  status: 'success',
  steps: [],
}

describe('pipelineExecutionPresentation', () => {
  it('formats execution engine and fallback labels', () => {
    expect(formatPipelineExecutionEngineLabel('workflow')).toBe('Workflow')
    expect(formatPipelineExecutionEngineLabel('legacy')).toBe('Legacy')
    expect(formatPipelineExecutionFallbackReason('workflow_executor_unavailable')).toBe('Workflow executor unavailable')
    expect(formatPipelineExecutionFallbackReason('workflow_executor_error')).toBe('Workflow executor failed and fell back to legacy')
  })

  it('builds notification messages with preview and routing diagnostics', () => {
    expect(buildPipelineExecutionNotificationMessage({
      ...baseExecution,
      finalOutput: 'done',
      runtime: {
        runId: 'run-1',
        agentIds: [],
        modelIds: [],
        startedAt: 10,
        trigger: 'manual',
        executionEngine: 'legacy',
        executionFallbackReason: 'workflow_executor_error',
      },
    })).toBe('done • Execution engine: Legacy • Workflow executor failed and fell back to legacy')
  })

  it('falls back to diagnostics when there is no output preview', () => {
    expect(buildPipelineExecutionNotificationMessage({
      ...baseExecution,
      runtime: {
        runId: 'run-2',
        agentIds: [],
        modelIds: [],
        startedAt: 10,
        trigger: 'manual',
        executionEngine: 'workflow',
      },
    })).toBe('Execution engine: Workflow')
  })
})
