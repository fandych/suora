import type { AgentPipeline, AgentPipelineExecution } from '@/types'

type ElectronBridge = { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> }

function getElectron(): ElectronBridge | undefined {
  return (window as unknown as { electron?: ElectronBridge }).electron
}

function pipelinesDir(workspacePath: string): string {
  return `${workspacePath}/pipelines`
}

function pipelineFilePath(workspacePath: string, pipelineId: string): string {
  return `${pipelinesDir(workspacePath)}/${pipelineId}.json`
}

function pipelineHistoryFilePath(workspacePath: string): string {
  return `${pipelinesDir(workspacePath)}/history.json`
}

export async function loadPipelinesFromDisk(workspacePath: string): Promise<AgentPipeline[]> {
  const electron = getElectron()
  if (!electron || !workspacePath) return []

  try {
    const entries = (await electron.invoke('fs:listDir', pipelinesDir(workspacePath))) as
      | { name: string; isDirectory: boolean; path: string }[]
      | { error: string }

    if (!Array.isArray(entries)) return []

    const pipelines: AgentPipeline[] = []
    for (const entry of entries) {
      if (entry.isDirectory || !entry.name.endsWith('.json') || entry.name === 'history.json') continue
      try {
        const raw = await electron.invoke('fs:readFile', entry.path)
        if (typeof raw === 'string') {
          pipelines.push(JSON.parse(raw) as AgentPipeline)
        }
      } catch {
        // Ignore corrupt pipeline files.
      }
    }

    return pipelines.sort((left, right) => right.updatedAt - left.updatedAt)
  } catch {
    return []
  }
}

export async function savePipelineToDisk(workspacePath: string, pipeline: AgentPipeline): Promise<boolean> {
  const electron = getElectron()
  if (!electron || !workspacePath) return false

  try {
    await electron.invoke('system:ensureDirectory', pipelinesDir(workspacePath))
    const result = (await electron.invoke(
      'fs:writeFile',
      pipelineFilePath(workspacePath, pipeline.id),
      JSON.stringify(pipeline, null, 2),
    )) as { success?: boolean }
    return result?.success ?? false
  } catch {
    return false
  }
}

export async function deletePipelineFromDisk(workspacePath: string, pipelineId: string): Promise<boolean> {
  const electron = getElectron()
  if (!electron || !workspacePath) return false

  try {
    const result = (await electron.invoke('fs:deleteFile', pipelineFilePath(workspacePath, pipelineId))) as { success?: boolean }
    return result?.success ?? false
  } catch {
    return false
  }
}

export async function loadPipelineExecutionsFromDisk(workspacePath: string, pipelineId?: string): Promise<AgentPipelineExecution[]> {
  const electron = getElectron()
  if (!electron || !workspacePath) return []

  try {
    const raw = await electron.invoke('fs:readFile', pipelineHistoryFilePath(workspacePath))
    if (typeof raw !== 'string') return []

    const executions = JSON.parse(raw) as AgentPipelineExecution[]
    const filtered = pipelineId
      ? executions.filter((execution) => execution.pipelineId === pipelineId)
      : executions

    return filtered.sort((left, right) => right.startedAt - left.startedAt)
  } catch {
    return []
  }
}

export async function appendPipelineExecutionToDisk(workspacePath: string, execution: AgentPipelineExecution): Promise<boolean> {
  const electron = getElectron()
  if (!electron || !workspacePath) return false

  try {
    await electron.invoke('system:ensureDirectory', pipelinesDir(workspacePath))
    const executions = await loadPipelineExecutionsFromDisk(workspacePath)
    const nextExecutions = [...executions, execution].slice(-500)
    const result = (await electron.invoke(
      'fs:writeFile',
      pipelineHistoryFilePath(workspacePath),
      JSON.stringify(nextExecutions, null, 2),
    )) as { success?: boolean }
    return result?.success ?? false
  } catch {
    return false
  }
}
