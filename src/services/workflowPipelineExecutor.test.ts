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
  const previousManualEngine = process.env.PIPELINE_EXECUTION_ENGINE_MANUAL
  const previousChatEngine = process.env.PIPELINE_EXECUTION_ENGINE_CHAT
  const previousTimerEngine = process.env.PIPELINE_EXECUTION_ENGINE_TIMER
  const previousViteManualEngine = process.env.VITE_PIPELINE_EXECUTION_ENGINE_MANUAL
  const previousViteChatEngine = process.env.VITE_PIPELINE_EXECUTION_ENGINE_CHAT
  const previousViteTimerEngine = process.env.VITE_PIPELINE_EXECUTION_ENGINE_TIMER

  beforeEach(() => {
    delete process.env.PIPELINE_EXECUTION_ENGINE
    delete process.env.PIPELINE_EXECUTION_ENGINE_MANUAL
    delete process.env.PIPELINE_EXECUTION_ENGINE_CHAT
    delete process.env.PIPELINE_EXECUTION_ENGINE_TIMER
    delete process.env.VITE_PIPELINE_EXECUTION_ENGINE_MANUAL
    delete process.env.VITE_PIPELINE_EXECUTION_ENGINE_CHAT
    delete process.env.VITE_PIPELINE_EXECUTION_ENGINE_TIMER
  })

  afterEach(() => {
    process.env.PIPELINE_EXECUTION_ENGINE = previousEngine
    process.env.PIPELINE_EXECUTION_ENGINE_MANUAL = previousManualEngine
    process.env.PIPELINE_EXECUTION_ENGINE_CHAT = previousChatEngine
    process.env.PIPELINE_EXECUTION_ENGINE_TIMER = previousTimerEngine
    process.env.VITE_PIPELINE_EXECUTION_ENGINE_MANUAL = previousViteManualEngine
    process.env.VITE_PIPELINE_EXECUTION_ENGINE_CHAT = previousViteChatEngine
    process.env.VITE_PIPELINE_EXECUTION_ENGINE_TIMER = previousViteTimerEngine
  })

  it('defaults to legacy execution engine', () => {
    expect(getResolvedPipelineExecutionEngine()).toBe('legacy')
  })

  it('respects process env workflow default', () => {
    process.env.PIPELINE_EXECUTION_ENGINE = 'workflow'
    expect(getResolvedPipelineExecutionEngine()).toBe('workflow')
  })

  it('respects trigger-scoped env before global default', () => {
    process.env.PIPELINE_EXECUTION_ENGINE = 'legacy'
    process.env.PIPELINE_EXECUTION_ENGINE_CHAT = 'workflow'
    expect(getResolvedPipelineExecutionEngine(undefined, 'chat')).toBe('workflow')
  })

  it('lets explicit option override trigger-scoped env', () => {
    process.env.PIPELINE_EXECUTION_ENGINE_CHAT = 'workflow'
    expect(getResolvedPipelineExecutionEngine('legacy', 'chat')).toBe('legacy')
  })

  it('supports VITE trigger-scoped env keys', () => {
    process.env.VITE_PIPELINE_EXECUTION_ENGINE_TIMER = 'workflow'
    expect(getResolvedPipelineExecutionEngine(undefined, 'timer')).toBe('workflow')
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

  it('routes to workflow path when trigger-scoped env enables workflow', async () => {
    process.env.PIPELINE_EXECUTION_ENGINE_TIMER = 'workflow'
    const executeLegacy = vi.fn().mockResolvedValue(baseExecution())
    const result = await executePipelineWithEngineRouting({
      pipeline,
      options: { trigger: 'timer' },
      executeLegacy,
    })
    expect(executeLegacy).toHaveBeenCalledTimes(1)
    expect(result.runtime?.validationWarnings?.some((warning) => warning.includes('runtime world integration'))).toBe(true)
  })
})
