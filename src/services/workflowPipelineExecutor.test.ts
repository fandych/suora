import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { AgentPipeline, AgentPipelineExecution } from '@/types'
import { executePipelineWithEngineRouting, getResolvedPipelineExecutionEngine } from './workflowPipelineExecutor'

const pipeline: AgentPipeline = {
  id: 'pipe-1',
  name: 'Pipeline',
  steps: [],
  createdAt: 1,
  updatedAt: 1,
}

function baseExecution(): AgentPipelineExecution {
  return {
    id: 'exec-1',
    pipelineId: pipeline.id,
    pipelineName: pipeline.name,
    trigger: 'manual',
    startedAt: 1,
    completedAt: 2,
    status: 'success',
    steps: [],
    runtime: {
      runId: 'run-1',
      agentIds: [],
      modelIds: [],
      startedAt: 1,
      trigger: 'manual',
      validationWarnings: [],
    },
  }
}

describe('workflowPipelineExecutor', () => {
  const previousEngine = process.env.PIPELINE_EXECUTION_ENGINE

  beforeEach(() => {
    delete process.env.PIPELINE_EXECUTION_ENGINE
  })

  afterEach(() => {
    process.env.PIPELINE_EXECUTION_ENGINE = previousEngine
  })

  it('defaults to legacy execution engine', () => {
    expect(getResolvedPipelineExecutionEngine()).toBe('legacy')
  })

  it('respects process env workflow default', () => {
    process.env.PIPELINE_EXECUTION_ENGINE = 'workflow'
    expect(getResolvedPipelineExecutionEngine()).toBe('workflow')
  })

  it('uses legacy executor without warning when forced to legacy', async () => {
    const executeLegacy = vi.fn().mockResolvedValue(baseExecution())
    const result = await executePipelineWithEngineRouting({
      pipeline,
      options: { executionEngine: 'legacy' },
      executeLegacy,
    })
    expect(executeLegacy).toHaveBeenCalledTimes(1)
    expect(result.runtime?.validationWarnings).toEqual([])
  })

  it('falls back to legacy and records warning when workflow engine is requested', async () => {
    const executeLegacy = vi.fn().mockResolvedValue(baseExecution())
    const result = await executePipelineWithEngineRouting({
      pipeline,
      options: { executionEngine: 'workflow' },
      executeLegacy,
    })
    expect(executeLegacy).toHaveBeenCalledTimes(1)
    expect(result.runtime?.validationWarnings?.some((warning) => warning.includes('legacy pipeline executor'))).toBe(true)
  })
})
