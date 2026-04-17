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
import { executeAgentPipeline, executePipelineById, executePipelineByReference } from './agentPipelineService'

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
})
