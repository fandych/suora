import type { AgentDetail, AgentSummary } from "@/data/domain/models"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { systemAgentMap, systemAgentSummaries } from "@/data/repositories/system-agents"
import { suoraIpc } from "@/lib/ipc"

type AgentSettingsStore = {
  disabledSystemAgentIds?: string[]
}

const AGENT_SETTINGS_KEY = "suora:agent-settings"

function readBrowserSettings() {
  if (typeof window === "undefined") {
    return null
  }

  return window.localStorage.getItem(AGENT_SETTINGS_KEY)
}

function writeBrowserSettings(store: AgentSettingsStore) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(AGENT_SETTINGS_KEY, JSON.stringify(store))
}

function parseSettings(value?: string | null): AgentSettingsStore {
  if (!value) {
    return {}
  }

  try {
    const parsed = JSON.parse(value) as AgentSettingsStore
    return {
      disabledSystemAgentIds: Array.isArray(parsed.disabledSystemAgentIds)
        ? parsed.disabledSystemAgentIds.filter((item): item is string => typeof item === "string")
        : [],
    }
  } catch {
    return {}
  }
}

async function readSettingsValue() {
  if (suoraIpc.agents.getSettings) {
    try {
      return await suoraIpc.agents.getSettings() as string | null
    } catch {
      return readBrowserSettings()
    }
  }

  return readBrowserSettings()
}

async function saveSettingsStore(store: AgentSettingsStore) {
  if (suoraIpc.agents.saveSettings) {
    try {
      await suoraIpc.agents.saveSettings(store)
      return
    } catch {
      writeBrowserSettings(store)
      return
    }
  }

  writeBrowserSettings(store)
}

async function getDisabledSystemAgentIds() {
  const value = await readSettingsValue()
  return new Set(parseSettings(value).disabledSystemAgentIds ?? [])
}

function hydrateAgent(agent: AgentSummary, disabledSystemAgentIds: Set<string>): AgentSummary {
  const source = agent.kind === "custom" ? "custom" : "system"
  return {
    ...agent,
    source,
    isDisabled: source === "system" ? disabledSystemAgentIds.has(agent.id) : false,
  }
}

export async function listAgents() {
  await ensureSeeded()
  const disabledSystemAgentIds = await getDisabledSystemAgentIds()
  const dbAgents = await suoraIpc.agents.list() as AgentSummary[]
  const byId = new Map(dbAgents.map((agent) => [agent.id, hydrateAgent(agent, disabledSystemAgentIds)]))
  for (const systemAgent of systemAgentSummaries) {
    if (!byId.has(systemAgent.id)) {
      byId.set(systemAgent.id, hydrateAgent(systemAgent, disabledSystemAgentIds))
    }
  }
  return [...byId.values()]
}

export async function getAgentDetail(agentId: string, selectedVersionId?: string) {
  await ensureSeeded()
  const disabledSystemAgentIds = await getDisabledSystemAgentIds()
  const detail = await suoraIpc.agents.get(agentId, selectedVersionId) as AgentDetail | null
  if (detail) {
    return {
      ...detail,
      agent: hydrateAgent(detail.agent, disabledSystemAgentIds),
    }
  }
  const systemDetail = systemAgentMap.get(agentId)
  return systemDetail
    ? {
        ...systemDetail,
        agent: hydrateAgent(systemDetail.agent, disabledSystemAgentIds),
      }
    : null
}

export async function createAgent() {
  await ensureSeeded()
  return suoraIpc.agents.create() as Promise<AgentDetail>
}

export async function saveAgentDraft(agent: AgentDetail, publish = false) {
  await ensureSeeded()
  return suoraIpc.agents.save({
    id: agent.agent.id,
    title: agent.agent.title,
    kind: agent.agent.kind,
    summary: agent.agent.summary,
    config: agent.config,
    selectedVersionId: agent.selectedVersion.id,
    publish,
  }) as Promise<AgentDetail>
}

export async function deleteAgent(agentId: string) {
  await ensureSeeded()
  return suoraIpc.agents.delete(agentId)
}

export async function setSystemAgentDisabled(agentId: string, disabled: boolean) {
  const disabledIds = await getDisabledSystemAgentIds()
  if (disabled) {
    disabledIds.add(agentId)
  } else {
    disabledIds.delete(agentId)
  }

  const nextStore: AgentSettingsStore = {
    disabledSystemAgentIds: [...disabledIds.values()].sort(),
  }

  await saveSettingsStore(nextStore)
  return nextStore
}

export async function listAvailableAgents() {
  const agents = await listAgents()
  return agents.filter((agent) => !agent.isDisabled)
}