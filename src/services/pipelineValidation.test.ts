import { describe, expect, it } from 'vitest'
import type { Agent, AgentPipeline, Model } from '@/types'
import { validateAgentPipeline } from './pipelineValidation'

const model: Model = { id: 'model-1', name: 'GPT', provider: 'provider-1', providerType: 'openai', modelId: 'gpt-4.1', enabled: true, isDefault: true }
const agent: Agent = { id: 'agent-1', name: 'Writer', systemPrompt: 'Write well', modelId: 'model-1', skills: [], enabled: true, memories: [], autoLearn: false }

function pipeline(steps: AgentPipeline['steps']): AgentPipeline {
  return { id: 'pipeline-1', name: 'Pipeline', steps, createdAt: 1, updatedAt: 2 }
}

describe('pipelineValidation', () => {
  it('rejects missing agents, empty tasks, and invalid budgets', () => {
    const result = validateAgentPipeline(
      pipeline([{ agentId: 'missing-agent', task: ' ', timeoutMs: 0, maxInputChars: -1 }]),
      [agent],
      [model],
    )

    expect(result.valid).toBe(false)
    expect(result.errors.map((issue) => issue.code)).toEqual(expect.arrayContaining(['empty-task', 'missing-agent', 'invalid-timeout', 'invalid-max-input']))
    expect(result.errors.find((issue) => issue.code === 'missing-agent')?.recoveryActions?.[0].label).toBe('Choose another agent')
  })

  it('rejects forward and missing step references', () => {
    const result = validateAgentPipeline(
      pipeline([
        { agentId: 'agent-1', task: 'Use {{steps[2].output}} too early' },
        { agentId: 'agent-1', task: 'Use {{steps[4].output}} never' },
      ]),
      [agent],
      [model],
    )

    expect(result.valid).toBe(false)
    expect(result.errors.map((issue) => issue.code)).toEqual(expect.arrayContaining(['forward-reference', 'invalid-reference']))
  })

  it('warns on unusually large budgets without invalidating the pipeline', () => {
    const result = validateAgentPipeline(
      pipeline([{ agentId: 'agent-1', task: 'Draft', maxOutputChars: 150_000 }]),
      [agent],
      [model],
    )

    expect(result.valid).toBe(true)
    expect(result.warnings.map((issue) => issue.code)).toContain('large-budget')
  })

  it('rejects malformed runIf expressions', () => {
    const result = validateAgentPipeline(
      pipeline([{ agentId: 'agent-1', task: 'Draft', runIf: '==' }]),
      [agent],
      [model],
    )

    expect(result.valid).toBe(false)
    expect(result.errors.map((issue) => issue.code)).toContain('invalid-run-if')
  })

  it('accepts valid runIf expressions', () => {
    const result = validateAgentPipeline(
      pipeline([
        { agentId: 'agent-1', task: 'Draft' },
        { agentId: 'agent-1', task: 'Review', runIf: "step1.status == 'success'" },
      ]),
      [agent],
      [model],
    )

    expect(result.valid).toBe(true)
  })

  it('rejects references to undeclared variables', () => {
    const result = validateAgentPipeline(
      {
        name: 'Pipeline',
        steps: [{ agentId: 'agent-1', task: 'Use {{vars.unknown}}' }],
        variables: [{ name: 'declared' }],
      },
      [agent],
      [model],
    )

    expect(result.valid).toBe(false)
    expect(result.errors.some((issue) => issue.code === 'unknown-variable')).toBe(true)
  })

  it('accepts references to declared variables', () => {
    const result = validateAgentPipeline(
      {
        name: 'Pipeline',
        steps: [{ agentId: 'agent-1', task: 'Use {{vars.mode}}', runIf: "vars.mode == 'live'" }],
        variables: [{ name: 'mode' }],
      },
      [agent],
      [model],
    )

    expect(result.valid).toBe(true)
  })

  it('rejects duplicate or invalid variable names', () => {
    const result = validateAgentPipeline(
      {
        name: 'Pipeline',
        steps: [{ agentId: 'agent-1', task: 'Draft' }],
        variables: [
          { name: 'mode' },
          { name: 'mode' },
          { name: '1bad' },
        ],
      },
      [agent],
      [model],
    )

    expect(result.errors.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['duplicate-variable', 'invalid-variable-name']),
    )
  })

  it('rejects an invalid retry-backoff strategy and negative backoff', () => {
    const result = validateAgentPipeline(
      {
        name: 'Pipeline',
        steps: [
          // @ts-expect-error invalid strategy on purpose
          { agentId: 'agent-1', task: 'Draft', retryCount: 1, retryBackoffStrategy: 'wild' },
          { agentId: 'agent-1', task: 'Review', retryCount: 1, retryBackoffMs: -10 },
        ],
      },
      [agent],
      [model],
    )

    expect(result.errors.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['invalid-retry-strategy', 'invalid-retry-backoff']),
    )
  })

  it('rejects a negative budget cap and warns when the step cap is below the enabled count', () => {
    const result = validateAgentPipeline(
      {
        name: 'Pipeline',
        steps: [
          { agentId: 'agent-1', task: 'Draft' },
          { agentId: 'agent-1', task: 'Review' },
        ],
        budget: { maxTotalTokens: -5, maxStepCount: 1 },
      },
      [agent],
      [model],
    )

    expect(result.errors.some((issue) => issue.code === 'invalid-budget')).toBe(true)
    expect(result.warnings.some((issue) => issue.code === 'budget-step-count-too-low')).toBe(true)
  })

  it('rejects an unknown step model override and warns when the override is disabled', () => {
    const result = validateAgentPipeline(
      {
        name: 'Pipeline',
        steps: [
          { agentId: 'agent-1', task: 'Draft', modelId: 'no-such-model' },
        ],
      },
      [agent],
      [model],
    )

    expect(result.errors.some((issue) => issue.code === 'invalid-step-model')).toBe(true)

    const disabledModel = { ...model, id: 'disabled-model', enabled: false }
    const warnResult = validateAgentPipeline(
      {
        name: 'Pipeline',
        steps: [
          { agentId: 'agent-1', task: 'Draft', modelId: 'disabled-model' },
        ],
      },
      [agent],
      [model, disabledModel],
    )
    expect(warnResult.warnings.some((issue) => issue.code === 'disabled-step-model')).toBe(true)
  })

  it('requires outputTransformPath when outputTransform is json-path', () => {
    const result = validateAgentPipeline(
      {
        name: 'Pipeline',
        steps: [
          { agentId: 'agent-1', task: 'Draft', outputTransform: 'json-path' },
          // @ts-expect-error invalid transform on purpose
          { agentId: 'agent-1', task: 'Draft', outputTransform: 'wat' },
        ],
      },
      [agent],
      [model],
    )

    expect(result.errors.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['missing-transform-path', 'invalid-output-transform']),
    )
  })
})
