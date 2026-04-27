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

  it('loads saved pipelines from separate pipeline files', async () => {
    vi.mocked(window.electron.invoke).mockImplementation(async (channel: string, ...args: unknown[]) => {
      const [filePath] = args as [string?]
      if (channel === 'fs:listDir' && filePath === 'C:/workspace/pipelines') {
        return [
          { name: 'pipeline-1.json', isDirectory: false, path: 'C:/workspace/pipelines/pipeline-1.json' },
          { name: 'history.json', isDirectory: false, path: 'C:/workspace/pipelines/history.json' },
        ]
      }
      if (channel === 'fs:readFile' && filePath === 'C:/workspace/pipelines/pipeline-1.json') {
        return JSON.stringify(samplePipeline)
      }
      return undefined
    })

    const pipelines = await loadPipelinesFromDisk('C:/workspace')

    expect(pipelines).toEqual([samplePipeline])
  })

  it('saves pipelines into the dedicated pipelines directory', async () => {
    vi.mocked(window.electron.invoke).mockResolvedValue({ success: true })

    const success = await savePipelineToDisk('C:/workspace', samplePipeline)

    expect(success).toBe(true)
    expect(window.electron.invoke).toHaveBeenCalledWith('system:ensureDirectory', 'C:/workspace/pipelines')
    expect(window.electron.invoke).toHaveBeenCalledWith(
      'fs:writeFile',
      'C:/workspace/pipelines/pipeline-1.json',
      JSON.stringify(samplePipeline, null, 2),
    )
  })

  it('sanitizes pipeline ids before writing files', async () => {
    vi.mocked(window.electron.invoke).mockResolvedValue({ success: true })

    const pipeline = { ...samplePipeline, id: '../pipeline-1' }
    const success = await savePipelineToDisk('C:/workspace', pipeline)

    expect(success).toBe(true)
    expect(window.electron.invoke).toHaveBeenCalledWith(
      'fs:writeFile',
      'C:/workspace/pipelines/pipeline-1.json',
      JSON.stringify(pipeline, null, 2),
    )
  })

  it('stores execution history in pipelines/history.json', async () => {
    vi.mocked(window.electron.invoke).mockImplementation(async (channel: string, ...args: unknown[]) => {
      const [filePath] = args as [string?]
      if (channel === 'fs:readFile' && filePath === 'C:/workspace/pipelines/history.json') {
        return JSON.stringify([])
      }
      return { success: true }
    })

    const success = await appendPipelineExecutionToDisk('C:/workspace', sampleExecution)

    expect(success).toBe(true)
    expect(window.electron.invoke).toHaveBeenCalledWith('system:ensureDirectory', 'C:/workspace/pipelines')
    expect(window.electron.invoke).toHaveBeenCalledWith(
      'fs:writeFile',
      'C:/workspace/pipelines/history.json',
      JSON.stringify([sampleExecution], null, 2),
    )
  })
})
