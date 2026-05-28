import { describe, expect, it } from 'vitest'
import type { AgentPipeline } from '@/types'
import type { PipelineValidationResult } from '@/services/pipelineValidation'
import { buildPipelineOptimizationIterations } from './pipelineOptimization'

const basePipeline: AgentPipeline = {
  id: 'pipeline-1',
  name: 'Publish brief',
  description: 'Draft and review a short publication brief.',
  steps: [
    {
      agentId: 'writer',
      task: 'Draft about {{vars.topic}}',
      retryCount: 1,
      retryBackoffMs: 250,
      timeoutMs: 10_000,
      maxInputChars: 4_000,
      maxOutputChars: 2_000,
      modelId: 'cheap-model',
      outputTransform: 'trim',
      exportVar: 'draft',
      continueOnError: false,
    },
    {
      agentId: 'reviewer',
      task: 'Review {{steps[1].output}}',
      runIf: "vars.topic != '' && step1.status == 'success'",
    },
  ],
  variables: [{ name: 'topic', defaultValue: 'release' }],
  budget: { maxTotalTokens: 10_000 },
  createdAt: 1,
  updatedAt: 2,
}

const validResult: PipelineValidationResult = {
  valid: true,
  issues: [],
  warnings: [],
  errors: [],
  enabledSteps: 2,
}

describe('pipelineOptimization', () => {
  it('builds exactly twenty deterministic optimization iterations', () => {
    const iterations = buildPipelineOptimizationIterations(basePipeline, validResult)

    expect(iterations).toHaveLength(20)
    expect(iterations.map((item) => item.iteration)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1))
    expect(iterations.every((item) => item.title && item.detail)).toBe(true)
    expect(iterations.find((item) => item.title === 'Retry resilience')?.status).toBe('configured')
    expect(iterations.find((item) => item.title === 'Whole-run budget')?.status).toBe('configured')
  })

  it('surfaces validation blockers and pipeline gaps as recommendations', () => {
    const iterations = buildPipelineOptimizationIterations(
      {
        ...basePipeline,
        name: '',
        description: '',
        steps: [
          { agentId: 'writer', task: 'Summarize' },
          { agentId: 'writer', task: 'Summarize' },
          { agentId: 'reviewer', task: 'Review later', enabled: false },
        ],
        variables: undefined,
        budget: undefined,
      },
      {
        warnings: [{ severity: 'warning', code: 'large-budget', message: 'Large budget' }],
        errors: [{ severity: 'error', code: 'missing-agent', message: 'Missing agent' }],
        enabledSteps: 2,
      },
    )

    expect(iterations.find((item) => item.title === 'Name and intent')?.status).toBe('recommended')
    expect(iterations.find((item) => item.title === 'Validation blockers')?.detail).toContain('1 validation error')
    expect(iterations.find((item) => item.title === 'Disabled step cleanup')?.detail).toContain('1 disabled step')
    expect(iterations.find((item) => item.title === 'Duplicate task review')?.detail).toContain('1 duplicate task')
    expect(iterations.find((item) => item.title === 'Whole-run budget')?.status).toBe('recommended')
  })
})
