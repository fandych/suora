import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store/appStore'
import type { AgentPipeline } from '@/types'

vi.mock('@/services/aiService', () => ({
  generateResponse: vi.fn(),
  initializeProvider: vi.fn(),
  streamResponseWithTools: vi.fn(),
}))

vi.mock('@/services/pipelineFiles', () => ({
  appendPipelineExecutionToDisk: vi.fn().mockResolvedValue(true),
  loadPipelinesFromDisk: vi.fn().mockResolvedValue([]),
  savePipelineToDisk: vi.fn().mockResolvedValue(true),
}))

import { generateResponse, initializeProvider, streamResponseWithTools } from '@/services/aiService'
import { appendPipelineExecutionToDisk, loadPipelinesFromDisk, savePipelineToDisk } from '@/services/pipelineFiles'
import { dryRunAgentPipeline, executeAgentPipeline, executePipelineById, executePipelineByReference } from './agentPipelineService'

const savedPipeline: AgentPipeline = {
  id: 'pipeline-1',
  name: 'Morning Run',
  steps: [
    { agentId: 'agent-1', task: 'Draft the report' },
    { agentId: 'agent-2', task: 'Review the report' },
  ],
  createdAt: 1,
  updatedAt: 2,
}

describe('agentPipelineService', () => {
  beforeEach(() => {
    vi.mocked(generateResponse).mockReset()
    vi.mocked(initializeProvider).mockReset()
    vi.mocked(streamResponseWithTools).mockReset()
    vi.mocked(appendPipelineExecutionToDisk).mockClear()
    vi.mocked(savePipelineToDisk).mockClear()
    vi.mocked(loadPipelinesFromDisk).mockReset()

    useAppStore.setState({
      workspacePath: 'C:/workspace',
      models: [
        { id: 'model-1', name: 'GPT', provider: 'provider-1', providerType: 'openai', modelId: 'gpt-4.1', enabled: true, isDefault: true },
        { id: 'model-cheap', name: 'GPT mini', provider: 'provider-1', providerType: 'openai', modelId: 'gpt-4.1-mini', enabled: true },
      ],
      agents: [
        { id: 'agent-1', name: 'Writer', systemPrompt: 'Write', modelId: 'model-1', skills: [], enabled: true, memories: [], autoLearn: false },
        { id: 'agent-2', name: 'Reviewer', systemPrompt: 'Review', modelId: 'model-1', skills: [], enabled: true, memories: [], autoLearn: false },
      ],
      agentPipelines: [savedPipeline],
      notifications: [],
    })
  })

  it('executes a saved pipeline and records execution history', async () => {
    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'draft-ready' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'review-ready' }
      })

    const execution = await executeAgentPipeline(savedPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps).toHaveLength(2)
    expect(execution.finalOutput).toBe('review-ready')
    expect(execution.steps[1].input).toContain('draft-ready')
    expect(initializeProvider).toHaveBeenCalledTimes(1)
    expect(appendPipelineExecutionToDisk).toHaveBeenCalledTimes(1)
    expect(savePipelineToDisk).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState().agentPipelines[0].lastRunAt).toBeDefined()
  })

  it('resolves explicit step output references before executing downstream steps', async () => {
    const referencedPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft the report' },
        { agentId: 'agent-2', task: 'Review this exact draft:\n{{steps[1].output}}' },
      ],
    }

    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'draft-ready' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'review-ready' }
      })

    const execution = await executeAgentPipeline(referencedPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[1].input).toContain('Review this exact draft:\ndraft-ready')
    expect(execution.steps[1].input).not.toContain('Previous step output:')
  })

  it('retries a failed step before marking it successful', async () => {
    const retryPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft the report', retryCount: 1 },
      ],
    }

    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'error', error: 'temporary outage' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'draft-ready' }
      })

    const execution = await executeAgentPipeline(retryPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[0].attempts).toBe(2)
    expect(execution.steps[0].output).toBe('draft-ready')
    expect(streamResponseWithTools).toHaveBeenCalledTimes(2)
  })

  it('skips disabled steps without breaking downstream handoff context', async () => {
    const disabledStepPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft the report' },
        { agentId: 'agent-2', task: 'Review the report', enabled: false },
        { agentId: 'agent-2', task: 'Summarize the latest usable result' },
      ],
    }

    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'draft-ready' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'summary-ready' }
      })

    const execution = await executeAgentPipeline(disabledStepPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[1].status).toBe('skipped')
    expect(execution.steps[2].input).toContain('draft-ready')
    expect(execution.finalOutput).toBe('summary-ready')
  })

  it('stops and marks remaining steps skipped when continue on error is disabled', async () => {
    const stopOnErrorPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft the report', continueOnError: false },
        { agentId: 'agent-2', task: 'Review the report' },
      ],
    }

    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'error', error: 'draft failed' }
    })

    const execution = await executeAgentPipeline(stopOnErrorPipeline)

    expect(execution.status).toBe('error')
    expect(execution.steps).toHaveLength(2)
    expect(execution.steps[0].status).toBe('error')
    expect(execution.steps[1].status).toBe('skipped')
    expect(streamResponseWithTools).toHaveBeenCalledTimes(1)
  })

  it('fails blank enabled steps without calling the model', async () => {
    const invalidPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: '   ' },
        { agentId: 'agent-2', task: 'Review the report' },
      ],
    }

    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'review-ready' }
    })

    const execution = await executeAgentPipeline(invalidPipeline)

    expect(execution.status).toBe('error')
    expect(execution.steps[0].status).toBe('error')
    expect(execution.steps[0].error).toBe('Step 1 has an empty task.')
    expect(streamResponseWithTools).not.toHaveBeenCalled()
  })

  it('returns dry-run validation failures before calling the model', async () => {
    const invalidPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [{ agentId: 'missing-agent', task: 'Draft the report' }],
    }

    const execution = await executeAgentPipeline(invalidPipeline)

    expect(execution.status).toBe('error')
    expect(execution.error).toContain('Step 1 references a missing agent')
    expect(execution.runId).toBeTruthy()
    expect(execution.runtime?.runId).toBe(execution.runId)
    expect(execution.steps[0].recoveryActions?.[0].label).toBe('Choose another agent')
    expect(streamResponseWithTools).not.toHaveBeenCalled()
  })

  it('truncates step output when a max output budget is configured', async () => {
    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'abcdef' }
    })

    const execution = await executeAgentPipeline({
      ...savedPipeline,
      steps: [{ agentId: 'agent-1', task: 'Draft the report', maxOutputChars: 3 }],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toContain('[Pipeline step output truncated: 3 characters omitted]')
    expect(execution.steps[0].warnings?.[0]).toContain('Step output truncated')
    expect(execution.steps[0].outputType).toBe('text')
  })

  it('marks every remaining step cancelled when aborted before execution', async () => {
    const controller = new AbortController()
    controller.abort()

    const execution = await executeAgentPipeline(savedPipeline, { abortSignal: controller.signal })

    expect(execution.status).toBe('error')
    expect(execution.error).toBe('Cancelled by user')
    expect(execution.steps).toHaveLength(2)
    expect(execution.steps.every((step) => step.status === 'error' && step.error === 'Cancelled by user')).toBe(true)
    expect(streamResponseWithTools).not.toHaveBeenCalled()
  })

  it('redacts secrets and local paths from recorded pipeline errors', async () => {
    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield {
        type: 'error',
        error: 'failed with sk-abcdefghijklmnopqrstuvwxyz123456 at C:\\Users\\Fandy\\secret\\trace.log',
      }
    })

    const execution = await executeAgentPipeline({
      ...savedPipeline,
      steps: [{ agentId: 'agent-1', task: 'Draft the report', continueOnError: false }],
    })

    expect(execution.status).toBe('error')
    expect(execution.steps[0].error).toContain('sk-***REDACTED***')
    expect(execution.steps[0].error).toContain('<...>/trace.log')
    expect(execution.steps[0].error).not.toContain('Fandy')
  })

  it('creates an error execution when a pipeline cannot be resolved by id', async () => {
    vi.mocked(loadPipelinesFromDisk).mockResolvedValueOnce([])
    useAppStore.setState({ agentPipelines: [] })

    const execution = await executePipelineById('missing-pipeline', { trigger: 'timer', timerId: 'timer-1' })

    expect(execution.status).toBe('error')
    expect(execution.error).toBe('Pipeline not found')
    expect(execution.timerId).toBe('timer-1')
    expect(appendPipelineExecutionToDisk).toHaveBeenCalledTimes(1)
  })

  it('streams step progress updates when a callback is provided', async () => {
    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'draft-ready' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'review-ready' }
      })

    const updates: Array<{ stepIndex: number; status: string; output?: string }> = []
    const execution = await executeAgentPipeline(savedPipeline, {
      onStepUpdate: (step) => {
        updates.push({
          stepIndex: step.stepIndex,
          status: step.status,
          output: step.output,
        })
      },
    })

    expect(execution.status).toBe('success')
    expect(initializeProvider).toHaveBeenCalledTimes(1)
    expect(streamResponseWithTools).toHaveBeenCalledTimes(2)
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ stepIndex: 0, status: 'running' }),
      expect.objectContaining({ stepIndex: 0, status: 'success', output: 'draft-ready' }),
      expect.objectContaining({ stepIndex: 1, status: 'running' }),
      expect.objectContaining({ stepIndex: 1, status: 'success', output: 'review-ready' }),
    ]))
  })

  it('executes a saved pipeline by name for chat-triggered runs', async () => {
    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'draft-ready' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'review-ready' }
      })

    const execution = await executePipelineByReference('morning run', { trigger: 'chat' })

    expect(execution.status).toBe('success')
    expect(execution.trigger).toBe('chat')
    expect(execution.pipelineId).toBe('pipeline-1')
    expect(execution.pipelineName).toBe('Morning Run')
  })

  it('reports ambiguous partial pipeline references without executing a model call', async () => {
    useAppStore.setState({
      agentPipelines: [
        savedPipeline,
        { ...savedPipeline, id: 'pipeline-2', name: 'Morning Report' },
      ],
    })

    const execution = await executePipelineByReference('Morning', { trigger: 'chat' })

    expect(execution.status).toBe('error')
    expect(execution.error).toContain('Pipeline reference is ambiguous')
    expect(execution.recoveryActions?.[0].label).toBe('Choose an exact pipeline name')
    expect(streamResponseWithTools).not.toHaveBeenCalled()
  })

  it('skips a step whose runIf condition does not match and records the reason', async () => {
    const conditionalPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft the report' },
        { agentId: 'agent-2', task: 'Review the report', runIf: "step1.output contains 'approved'" },
      ],
    }

    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'draft-ready' }
    })

    const execution = await executeAgentPipeline(conditionalPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[1].status).toBe('skipped')
    expect(execution.steps[1].skipReason).toMatch(/Condition not met/)
    expect(execution.steps[1].skipReason).toContain("step1.output contains 'approved'")
    expect(streamResponseWithTools).toHaveBeenCalledTimes(1)
    expect(execution.finalOutput).toBe('draft-ready')
  })

  it('runs a step whose runIf condition matches', async () => {
    const conditionalPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft the report' },
        { agentId: 'agent-2', task: 'Review the report', runIf: "step1.status == 'success'" },
      ],
    }

    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'draft-ready' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'review-ready' }
      })

    const execution = await executeAgentPipeline(conditionalPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[1].status).toBe('success')
    expect(streamResponseWithTools).toHaveBeenCalledTimes(2)
  })

  it('rejects pipelines with malformed runIf expressions during validation', async () => {
    const invalidPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft', runIf: '==' },
      ],
    }

    const execution = await executeAgentPipeline(invalidPipeline)

    expect(execution.status).toBe('error')
    expect(execution.error).toMatch(/invalid runIf/i)
    expect(streamResponseWithTools).not.toHaveBeenCalled()
  })

  it('substitutes pipeline-level variables and records them in the runtime snapshot', async () => {
    const variablePipeline: AgentPipeline = {
      ...savedPipeline,
      variables: [
        { name: 'mode', defaultValue: 'live' },
        { name: 'reviewer' },
      ],
      steps: [
        { agentId: 'agent-1', task: 'Draft for {{vars.mode}} mode for {{vars.reviewer}}' },
      ],
    }

    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'drafted' }
    })

    const execution = await executeAgentPipeline(variablePipeline, {
      variables: { reviewer: 'Alice' },
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].input).toContain('Draft for live mode for Alice')
    expect(execution.runtime?.variables).toEqual({ mode: 'live', reviewer: 'Alice' })
  })

  it('uses vars in runIf conditions to gate steps', async () => {
    const variablePipeline: AgentPipeline = {
      ...savedPipeline,
      variables: [{ name: 'mode' }],
      steps: [
        { agentId: 'agent-1', task: 'Draft' },
        { agentId: 'agent-2', task: 'Review', runIf: "vars.mode == 'live'" },
      ],
    }

    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'draft-ready' }
    })

    const execution = await executeAgentPipeline(variablePipeline, {
      variables: { mode: 'dry-run' },
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[1].status).toBe('skipped')
    expect(execution.steps[1].skipReason).toContain("vars.mode == 'live'")
  })

  it('captures token usage per step and aggregates it on the execution', async () => {
    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'draft-ready' }
        yield { type: 'usage', promptTokens: 10, completionTokens: 5, totalTokens: 15 }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'review-ready' }
        yield { type: 'usage', promptTokens: 20, completionTokens: 7, totalTokens: 27 }
      })

    const execution = await executeAgentPipeline(savedPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[0].usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 })
    expect(execution.steps[1].usage).toEqual({ promptTokens: 20, completionTokens: 7, totalTokens: 27 })
    expect(execution.usage).toEqual({ promptTokens: 30, completionTokens: 12, totalTokens: 42 })
  })

  it('aborts the run and skips remaining steps when the token budget is exceeded', async () => {
    const budgetPipeline: AgentPipeline = {
      ...savedPipeline,
      budget: { maxTotalTokens: 20 },
      steps: [
        { agentId: 'agent-1', task: 'Draft the report' },
        { agentId: 'agent-2', task: 'Review the report' },
      ],
    }

    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'draft-ready' }
        yield { type: 'usage', promptTokens: 30, completionTokens: 0, totalTokens: 30 }
      })

    const execution = await executeAgentPipeline(budgetPipeline)

    expect(execution.status).toBe('error')
    expect(execution.budgetExceeded).toEqual({ type: 'tokens', limit: 20, observed: 30 })
    expect(execution.steps).toHaveLength(2)
    expect(execution.steps[0].status).toBe('success')
    expect(execution.steps[1].status).toBe('skipped')
    expect(execution.steps[1].skipReason).toContain('budget')
    expect(streamResponseWithTools).toHaveBeenCalledTimes(1)
  })

  it('aborts the run when the step-count cap is reached', async () => {
    const budgetPipeline: AgentPipeline = {
      ...savedPipeline,
      budget: { maxStepCount: 1 },
      steps: [
        { agentId: 'agent-1', task: 'Draft the report' },
        { agentId: 'agent-2', task: 'Review the report' },
      ],
    }

    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'draft-ready' }
      })

    const execution = await executeAgentPipeline(budgetPipeline)

    expect(execution.status).toBe('error')
    expect(execution.budgetExceeded?.type).toBe('steps')
    expect(execution.steps[0].status).toBe('success')
    expect(execution.steps[1].status).toBe('skipped')
  })

  it('honors the per-step retry backoff before retrying', async () => {
    vi.useFakeTimers()
    try {
      const retryPipeline: AgentPipeline = {
        ...savedPipeline,
        steps: [
          { agentId: 'agent-1', task: 'Draft', retryCount: 1, retryBackoffMs: 100, retryBackoffStrategy: 'fixed' },
        ],
      }

      vi.mocked(streamResponseWithTools)
        .mockImplementationOnce(async function* () {
          yield { type: 'error', error: 'temporary' }
        })
        .mockImplementationOnce(async function* () {
          yield { type: 'text-delta', text: 'recovered' }
        })

      const promise = executeAgentPipeline(retryPipeline)
      // Allow the rejected attempt to flow through the microtask queue.
      await vi.advanceTimersByTimeAsync(0)
      // Before the backoff elapses, the retry has not been triggered.
      expect(streamResponseWithTools).toHaveBeenCalledTimes(1)
      // After the backoff, the retry runs.
      await vi.advanceTimersByTimeAsync(100)
      const execution = await promise

      expect(execution.status).toBe('success')
      expect(execution.steps[0].attempts).toBe(2)
      expect(streamResponseWithTools).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('uses exponential growth for the retry backoff when configured', async () => {
    vi.useFakeTimers()
    try {
      const retryPipeline: AgentPipeline = {
        ...savedPipeline,
        steps: [
          { agentId: 'agent-1', task: 'Draft', retryCount: 2, retryBackoffMs: 50, retryBackoffStrategy: 'exponential' },
        ],
      }

      vi.mocked(streamResponseWithTools)
        .mockImplementationOnce(async function* () { yield { type: 'error', error: 'fail-1' } })
        .mockImplementationOnce(async function* () { yield { type: 'error', error: 'fail-2' } })
        .mockImplementationOnce(async function* () { yield { type: 'text-delta', text: 'recovered' } })

      const promise = executeAgentPipeline(retryPipeline)

      await vi.advanceTimersByTimeAsync(0)
      expect(streamResponseWithTools).toHaveBeenCalledTimes(1)
      // First retry waits ~50ms.
      await vi.advanceTimersByTimeAsync(50)
      expect(streamResponseWithTools).toHaveBeenCalledTimes(2)
      // Second retry waits ~100ms (50 * 2^1).
      await vi.advanceTimersByTimeAsync(100)
      const execution = await promise

      expect(execution.status).toBe('success')
      expect(execution.steps[0].attempts).toBe(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('uses the per-step model override when present', async () => {
    const overridePipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft', modelId: 'model-cheap' },
      ],
    }

    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'cheap-output' }
    })

    const execution = await executeAgentPipeline(overridePipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[0].modelId).toBe('model-cheap')
    // The mocked streamResponseWithTools is called with the model identifier as the first arg.
    const callArgs = vi.mocked(streamResponseWithTools).mock.calls[0]
    expect(callArgs[0]).toContain('gpt-4.1-mini')
  })

  it('falls back to the agent default at runtime when the step model override is disabled', async () => {
    // Disabled-model override is a warning at validation time, not an error,
    // so the run still proceeds — falling through to the agent's default model.
    useAppStore.setState({
      models: [
        { id: 'model-1', name: 'GPT', provider: 'provider-1', providerType: 'openai', modelId: 'gpt-4.1', enabled: true, isDefault: true },
        { id: 'model-cheap', name: 'GPT mini', provider: 'provider-1', providerType: 'openai', modelId: 'gpt-4.1-mini', enabled: false },
      ],
      agents: useAppStore.getState().agents,
      agentPipelines: useAppStore.getState().agentPipelines,
      workspacePath: 'C:/workspace',
      notifications: [],
    })
    const overridePipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft', modelId: 'model-cheap' },
      ],
    }

    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'fallback-output' }
    })

    const execution = await executeAgentPipeline(overridePipeline)

    expect(execution.status).toBe('success')
    // Falls back to model-1 (the agent's modelId).
    expect(execution.steps[0].modelId).toBe('model-1')
  })

  it('applies the trim output transform before passing output downstream', async () => {
    const transformPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft', outputTransform: 'trim' },
        { agentId: 'agent-2', task: 'Review {{previous.output}}' },
      ],
    }

    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: '  raw with whitespace  \n' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'reviewed' }
      })

    const execution = await executeAgentPipeline(transformPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toBe('raw with whitespace')
    expect(execution.steps[0].rawOutput).toBe('  raw with whitespace  \n')
    expect(execution.steps[1].input).toContain('Review raw with whitespace')
  })

  it('extracts a JSON path via the json-path output transform', async () => {
    const transformPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft', outputTransform: 'json-path', outputTransformPath: 'data.title' },
      ],
    }

    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: '{"data":{"title":"Hello"}}' }
    })

    const execution = await executeAgentPipeline(transformPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toBe('Hello')
    expect(execution.steps[0].rawOutput).toBe('{"data":{"title":"Hello"}}')
  })

  it('dryRunAgentPipeline classifies steps without invoking any model', () => {
    const dryPipeline: AgentPipeline = {
      ...savedPipeline,
      variables: [{ name: 'topic', defaultValue: 'launch' }],
      steps: [
        { agentId: 'agent-1', task: 'Draft about {{vars.topic}}' },
        { agentId: 'agent-2', task: 'Review', enabled: false },
        { agentId: 'agent-2', task: 'Summarize', runIf: "step1.status == 'success'" },
        { agentId: 'agent-missing', task: 'Broken' },
      ],
    }

    const result = dryRunAgentPipeline(dryPipeline)

    expect(streamResponseWithTools).not.toHaveBeenCalled()
    expect(generateResponse).not.toHaveBeenCalled()
    expect(result.steps).toHaveLength(4)
    expect(result.steps[0].status).toBe('would-run')
    expect(result.steps[0].resolvedInput).toContain('Draft about launch')
    expect(result.steps[0].modelId).toBe('model-1')
    expect(result.steps[1].status).toBe('disabled')
    expect(result.steps[2].status).toBe('would-run')
    expect(result.steps[3].status).toBe('error')
    expect(result.steps[3].reason).toMatch(/missing agent/)
    expect(result.variables.topic).toBe('launch')
  })

  it('dryRunAgentPipeline reports a budget cap that would skip later steps', () => {
    const dryPipeline: AgentPipeline = {
      ...savedPipeline,
      budget: { maxStepCount: 1 },
      steps: [
        { agentId: 'agent-1', task: 'A' },
        { agentId: 'agent-1', task: 'B' },
      ],
    }

    const result = dryRunAgentPipeline(dryPipeline)

    expect(result.budgetExceeded?.type).toBe('steps')
    expect(result.steps[0].status).toBe('would-run')
    expect(result.steps[1].status).toBe('skipped')
    expect(result.steps[1].reason).toMatch(/budget/)
  })

  it('exports a step output into a named pipeline variable for downstream substitution', async () => {
    const exportPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Pick a topic', exportVar: 'topic' },
        { agentId: 'agent-2', task: 'Write about {{vars.topic}}' },
      ],
    }

    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'quantum computing' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'article' }
      })

    const execution = await executeAgentPipeline(exportPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toBe('quantum computing')
    // The second step's prompt should have the exported variable splat in.
    expect(execution.steps[1].input).toContain('Write about quantum computing')
  })

  it('exports the transformed output (not the raw output) into the variable', async () => {
    const exportPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        {
          agentId: 'agent-1',
          task: 'Return JSON',
          outputTransform: 'json-path',
          outputTransformPath: 'data.title',
          exportVar: 'title',
        },
        { agentId: 'agent-2', task: 'Promote {{vars.title}}' },
      ],
    }

    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: '{"data":{"title":"Hello"}}' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'done' }
      })

    const execution = await executeAgentPipeline(exportPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toBe('Hello')
    expect(execution.steps[0].rawOutput).toBe('{"data":{"title":"Hello"}}')
    expect(execution.steps[1].input).toContain('Promote Hello')
  })

  it('makes an exported variable visible to downstream runIf conditions', async () => {
    const exportPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Decide', exportVar: 'decision' },
        { agentId: 'agent-2', task: 'Approve', runIf: "vars.decision == 'approved'" },
        { agentId: 'agent-2', task: 'Reject', runIf: "vars.decision == 'rejected'" },
      ],
    }

    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'approved' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'approved-output' }
      })

    const execution = await executeAgentPipeline(exportPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[0].exportedVar).toBe('decision')
    expect(execution.steps[1].status).toBe('success')
    expect(execution.steps[2].status).toBe('skipped')
  })

  it('dryRunAgentPipeline propagates exported variables through the simulation', () => {
    const dryPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Pick', exportVar: 'choice' },
        { agentId: 'agent-2', task: 'Use {{vars.choice}}' },
      ],
    }

    const result = dryRunAgentPipeline(dryPipeline)

    expect(streamResponseWithTools).not.toHaveBeenCalled()
    expect(result.steps[0].status).toBe('would-run')
    expect(result.steps[0].exportedVar).toBe('choice')
    // The second step's resolved input should reflect the simulated dry-run
    // output rather than an empty string.
    expect(result.steps[1].resolvedInput).toContain('[dry-run output for step 1]')
  })
})
