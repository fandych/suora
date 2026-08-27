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

  it('allows structural nodes to omit task bodies', () => {
    const result = validateAgentPipeline(
      pipeline([
        { agentId: 'agent-1', task: '', nodeType: 'parallel', parallelBranches: 3 },
        { agentId: 'agent-1', task: '', nodeType: 'join', joinStrategy: 'wait-all' },
      ]),
      [agent],
      [model],
    )

    expect(result.errors.some((issue) => issue.code === 'empty-task')).toBe(false)
    expect(result.valid).toBe(true)
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

  it('rejects same-step references to variables exported only after the step runs', () => {
    const result = validateAgentPipeline(
      {
        name: 'Pipeline',
        steps: [
          { agentId: 'agent-1', task: 'Use {{vars.generated}} before it exists', exportVar: 'generated' },
          { agentId: 'agent-1', task: 'Use {{vars.generated}} after export' },
        ],
      },
      [agent],
      [model],
    )

    expect(result.valid).toBe(false)
    expect(result.errors.find((issue) => issue.code === 'unknown-variable')?.stepIndex).toBe(0)
  })

  it('rejects agents whose configured model is disabled when no fallback is selected', () => {
    const disabledModel = { ...model, enabled: false }
    const result = validateAgentPipeline(
      pipeline([{ agentId: 'agent-1', task: 'Draft' }]),
      [agent],
      [disabledModel],
    )

    expect(result.valid).toBe(false)
    expect(result.errors.some((issue) => issue.code === 'missing-model')).toBe(true)
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

  it('rejects an invalid exportVar identifier and warns when overwriting a declared variable', () => {
    const invalidResult = validateAgentPipeline(
      {
        name: 'Pipeline',
        steps: [
          { agentId: 'agent-1', task: 'Draft', exportVar: '1bad-name' },
          { agentId: 'agent-1', task: 'Draft', exportVar: '' },
        ],
      },
      [agent],
      [model],
    )

    expect(invalidResult.errors.filter((issue) => issue.code === 'invalid-export-var').length).toBe(2)

    const collisionResult = validateAgentPipeline(
      {
        name: 'Pipeline',
        variables: [{ name: 'topic', defaultValue: 'launch' }],
        steps: [
          { agentId: 'agent-1', task: 'Pick', exportVar: 'topic' },
        ],
      },
      [agent],
      [model],
    )

    expect(collisionResult.warnings.some((issue) => issue.code === 'export-var-collision')).toBe(true)
    // No error should be raised for the legal-but-shadowing case.
    expect(collisionResult.errors.some((issue) => issue.code === 'invalid-export-var')).toBe(false)
  })

  it('validates iteration node settings', () => {
    const invalidResult = validateAgentPipeline(
      {
        name: 'Pipeline',
        steps: [
          { agentId: 'agent-1', task: '', nodeType: 'iteration' },
        ],
      },
      [agent],
      [model],
    )

    expect(invalidResult.errors.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'missing-iteration-source',
      'missing-iteration-target',
    ]))

    const validResult = validateAgentPipeline(
      {
        name: 'Pipeline',
        steps: [
          { agentId: 'agent-1', task: '', nodeType: 'iteration', iterationSource: '{{vars.items}}', iterationPipelineTargetId: 'child', iterationMode: 'parallel', iterationErrorMode: 'continue', iterationItemVar: 'item', iterationIndexVar: 'index' },
        ],
        variables: [{ name: 'items' }],
      },
      [agent],
      [model],
    )

    expect(validResult.errors.some((issue) => issue.code.startsWith('missing-iteration'))).toBe(false)
  })

  it('warns when pipeline or iteration targets are not saved in the current workspace', () => {
    const result = validateAgentPipeline(
      {
        name: 'Pipeline',
        steps: [
          { agentId: 'agent-1', task: 'Invoke child', nodeType: 'pipeline', pipelineTargetId: 'missing-child' },
          { agentId: 'agent-1', task: '', nodeType: 'iteration', iterationSource: '{{vars.items}}', iterationPipelineTargetId: 'missing-child' },
        ],
        variables: [{ name: 'items' }],
      },
      [agent],
      [model],
    )

    expect(result.warnings.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'unknown-pipeline-target',
      'unknown-iteration-target',
    ]))
  })

  it('requires node-specific configuration for pipeline, script, http, and email nodes', () => {
    const result = validateAgentPipeline(
      {
        name: 'Pipeline',
        steps: [
          { agentId: 'agent-1', task: 'Invoke nested flow', nodeType: 'pipeline' },
          { agentId: 'agent-1', task: 'Run script', nodeType: 'script' },
          { agentId: 'agent-1', task: 'Call api', nodeType: 'http' },
          { agentId: 'agent-1', task: 'Send mail', nodeType: 'email' },
        ],
      },
      [agent],
      [model],
    )

    expect(result.errors.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'missing-pipeline-target',
      'missing-script-path',
      'missing-http-url',
      'missing-email-to',
      'missing-email-subject',
    ]))
  })

  it('rejects malformed success status code lists for http and webhook nodes', () => {
    const result = validateAgentPipeline(
      {
        name: 'Pipeline',
        steps: [
          { agentId: 'agent-1', task: 'Call api', nodeType: 'http', httpUrl: 'https://api.example.com', httpSuccessStatuses: '200 nope' },
          { agentId: 'agent-1', task: 'Call webhook', nodeType: 'webhook', webhookUrl: 'https://hooks.example.com/workflows', webhookSuccessStatuses: '99,201' },
        ],
      },
      [agent],
      [model],
    )

    expect(result.errors.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'invalid-http-success-statuses',
      'invalid-webhook-success-statuses',
    ]))
  })

  it('rejects invalid structural-node strategy values', () => {
    const result = validateAgentPipeline(
      {
        name: 'Pipeline',
        steps: [
          { agentId: 'agent-1', task: '', nodeType: 'parallel', parallelBranches: 1 },
          // @ts-expect-error invalid join strategy on purpose
          { agentId: 'agent-1', task: '', nodeType: 'join', joinStrategy: 'wild' },
          // @ts-expect-error invalid condition mode on purpose
          { agentId: 'agent-1', task: 'Check', nodeType: 'condition', conditionMode: 'wild' },
        ],
      },
      [agent],
      [model],
    )

    expect(result.errors.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'invalid-parallel-branches',
      'invalid-join-strategy',
      'invalid-condition-mode',
    ]))
  })

  it('rejects script runtimes not supported by the current executor', () => {
    const result = validateAgentPipeline(
      {
        name: 'Pipeline',
        steps: [
          { agentId: 'agent-1', task: 'Run shell', nodeType: 'script', scriptPath: 'scripts/run.sh', scriptRuntime: 'bash' },
        ],
      },
      [agent],
      [model],
    )

    expect(result.errors.some((issue) => issue.code === 'unsupported-script-runtime')).toBe(true)
  })

  it('requires start to have no incoming edges and end to have no outgoing edges', () => {
    const result = validateAgentPipeline(
      {
        name: 'Pipeline',
        steps: [
          { agentId: 'agent-1', task: 'Draft', nodeType: 'agent' },
          { agentId: 'agent-1', task: '', nodeType: 'start', startParams: [] },
          { agentId: 'agent-1', task: '', nodeType: 'end', endOutputs: [] },
          { agentId: 'agent-1', task: 'Review', nodeType: 'agent' },
        ],
      },
      [agent],
      [model],
    )

    expect(result.errors.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'start-has-incoming',
      'missing-start-params',
      'end-has-outgoing',
      'missing-end-outputs',
    ]))
  })

  it('rejects cyclic workflow graphs', () => {
    const result = validateAgentPipeline(
      {
        name: 'Pipeline',
        steps: [
          { id: 'start', agentId: 'agent-1', task: '', nodeType: 'start', startParams: [{ key: 'topic', defaultValue: 'launch' }], transitions: [{ targetStepId: 'draft' }] },
          { id: 'draft', agentId: 'agent-1', task: 'Draft', transitions: [{ targetStepId: 'start' }] },
        ],
      },
      [agent],
      [model],
    )

    expect(result.errors.some((issue) => issue.code === 'cycle-detected')).toBe(true)
  })

  it('warns when a workflow node is unreachable from the entry path', () => {
    const result = validateAgentPipeline(
      {
        name: 'Pipeline',
        steps: [
          { id: 'start', agentId: 'agent-1', task: '', nodeType: 'start', startParams: [{ key: 'topic', defaultValue: 'launch' }], transitions: [{ targetStepId: 'end' }] },
          { id: 'orphan', agentId: 'agent-1', task: 'Never reached' },
          { id: 'end', agentId: 'agent-1', task: '', nodeType: 'end', endOutputs: [{ key: 'result', value: '{{previous.output}}' }] },
        ],
      },
      [agent],
      [model],
    )

    expect(result.warnings.some((issue) => issue.code === 'unreachable-node' && issue.stepIndex === 1)).toBe(true)
  })
})
