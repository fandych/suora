// File-based agent persistence: {workspacePath}/agents/{agentId}.json
import type { Agent } from '@/types'

type ElectronBridge = { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> }

function getElectron(): ElectronBridge | undefined {
  return (window as unknown as { electron?: ElectronBridge }).electron
}

function agentsDir(workspacePath: string): string {
  return `${workspacePath}/agents`
}

function agentFilePath(workspacePath: string, agentId: string): string {
  return `${agentsDir(workspacePath)}/${agentId}.json`
}

/** Load all agents from the workspace agents directory */
export async function loadAgentsFromDisk(workspacePath: string): Promise<Agent[]> {
  const electron = getElectron()
  if (!electron || !workspacePath) return []

  try {
    const entries = (await electron.invoke('fs:listDir', agentsDir(workspacePath))) as
      | { name: string; isDirectory: boolean; path: string }[]
      | { error: string }

    if (!Array.isArray(entries)) return [] // dir doesn't exist yet

    const agents: Agent[] = []
    for (const entry of entries) {
      if (entry.isDirectory || !entry.name.endsWith('.json')) continue
      try {
        const raw = await electron.invoke('fs:readFile', entry.path)
        if (typeof raw === 'string') {
          agents.push(JSON.parse(raw) as Agent)
        }
      } catch {
        // skip corrupt files
      }
    }
    return agents
  } catch {
    return []
  }
}

/** Save a single agent to disk */
export async function saveAgentToDisk(workspacePath: string, agent: Agent): Promise<boolean> {
  const electron = getElectron()
  if (!electron || !workspacePath) return false

  try {
    await electron.invoke('system:ensureDirectory', agentsDir(workspacePath))
    const json = JSON.stringify(agent, null, 2)
    const result = (await electron.invoke(
      'fs:writeFile',
      agentFilePath(workspacePath, agent.id),
      json,
    )) as { success?: boolean }
    return result?.success ?? false
  } catch {
    return false
  }
}

/** Delete an agent file from disk */
export async function deleteAgentFromDisk(workspacePath: string, agentId: string): Promise<boolean> {
  const electron = getElectron()
  if (!electron || !workspacePath) return false

  try {
    const result = (await electron.invoke(
      'fs:deleteFile',
      agentFilePath(workspacePath, agentId),
    )) as { success?: boolean }
    return result?.success ?? false
  } catch {
    return false
  }
}
