import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentPipeline, AgentPipelineExecution } from '@/types'
import {
  appendPipelineExecutionToDisk,
  loadPipelinesFromDisk,
  savePipelineToDisk,
} from './pipelineFiles'

const samplePipeline: AgentPipeline = {
  id: 'pipeline-1',
  name: 'Morning Run',
  steps: [{ agentId: 'agent-1', task: 'Draft update' }],
  createdAt: 1,
  updatedAt: 2,
}

const sampleExecution: AgentPipelineExecution = {
  id: 'exec-1',
  pipelineId: 'pipeline-1',
  pipelineName: 'Morning Run',
  trigger: 'manual',
  startedAt: 10,
  completedAt: 20,
  status: 'success',
  steps: [],
  finalOutput: 'done',
}

describe('pipelineFiles', () => {
  beforeEach(() => {
    vi.mocked(window.electron.invoke).mockReset()
  })

  it('loads saved pipelines from SQLite entities', async () => {
    vi.mocked(window.electron.invoke).mockImplementation(async (channel: string, ...args: unknown[]) => {
      const [table] = args as [string?]
      if (channel === 'db:listEntities' && table === 'pipelines') {
        return { success: true, data: [samplePipeline] }
      }
      return undefined
    })

    const pipelines = await loadPipelinesFromDisk('C:/workspace')

    expect(pipelines).toEqual([samplePipeline])
  })

  it('saves pipelines into SQLite', async () => {
    vi.mocked(window.electron.invoke).mockResolvedValue({ success: true })

    const success = await savePipelineToDisk('C:/workspace', samplePipeline)

    expect(success).toBe(true)
    expect(window.electron.invoke).toHaveBeenCalledWith(
      'db:saveEntity',
      'pipelines',
      'pipeline-1',
      samplePipeline,
    )
  })

  it('stores execution history in SQLite', async () => {
    vi.mocked(window.electron.invoke).mockResolvedValue({ success: true })

    const success = await appendPipelineExecutionToDisk('C:/workspace', sampleExecution)

    expect(success).toBe(true)
    expect(window.electron.invoke).toHaveBeenCalledWith(
      'db:saveEntity',
      'pipeline_executions',
      'exec-1',
      sampleExecution,
    )
  })
})
