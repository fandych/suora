import type { AgentPipeline, AgentPipelineExecution } from '@/types'

type ElectronBridge = { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> }

function getElectron(): ElectronBridge | undefined {
  return (window as unknown as { electron?: ElectronBridge }).electron
}

export async function loadPipelinesFromDisk(workspacePath: string): Promise<AgentPipeline[]> {
  const electron = getElectron()
  if (!electron || !workspacePath) return []

  try {
    const result = await electron.invoke('db:listEntities', 'pipelines') as { success?: boolean; data?: unknown; error?: string }
    if (result?.error || !Array.isArray(result.data)) return []
    const pipelines = result.data.filter((entry): entry is AgentPipeline => Boolean(entry && typeof entry === 'object' && 'id' in entry && 'updatedAt' in entry))
    return pipelines.sort((left, right) => right.updatedAt - left.updatedAt)
  } catch {
    return []
  }
}

export async function savePipelineToDisk(workspacePath: string, pipeline: AgentPipeline): Promise<boolean> {
  const electron = getElectron()
  if (!electron || !workspacePath) return false

  try {
    const result = (await electron.invoke('db:saveEntity', 'pipelines', pipeline.id, pipeline)) as { success?: boolean; error?: string }
    return result?.success ?? false
  } catch {
    return false
  }
}

export async function deletePipelineFromDisk(workspacePath: string, pipelineId: string): Promise<boolean> {
  const electron = getElectron()
  if (!electron || !workspacePath) return false

  try {
    const result = (await electron.invoke('db:deleteEntity', 'pipelines', pipelineId)) as { success?: boolean; error?: string }
    return result?.success ?? false
  } catch {
    return false
  }
}

export async function loadPipelineExecutionsFromDisk(workspacePath: string, pipelineId?: string): Promise<AgentPipelineExecution[]> {
  const electron = getElectron()
  if (!electron || !workspacePath) return []

  try {
    const result = await electron.invoke('db:listEntities', 'pipeline_executions') as { success?: boolean; data?: unknown; error?: string }
    if (result?.error || !Array.isArray(result.data)) return []
    const executions = result.data.filter((entry): entry is AgentPipelineExecution => Boolean(entry && typeof entry === 'object' && 'id' in entry && 'startedAt' in entry))
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
    const result = (await electron.invoke('db:saveEntity', 'pipeline_executions', execution.id, execution)) as { success?: boolean; error?: string }
    return result?.success ?? false
  } catch {
    return false
  }
}
