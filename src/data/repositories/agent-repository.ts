import type { AgentDetail, AgentSummary } from "@/data/domain/models"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { systemAgentMap, systemAgentSummaries } from "@/data/repositories/system-agents"
import { suoraIpc } from "@/lib/ipc"

export async function listAgents() {
  await ensureSeeded()
  const dbAgents = await suoraIpc.agents.list() as AgentSummary[]
  const byId = new Map(dbAgents.map((agent) => [agent.id, agent]))
  for (const systemAgent of systemAgentSummaries) {
    if (!byId.has(systemAgent.id)) {
      byId.set(systemAgent.id, systemAgent)
    }
  }
  return [...byId.values()]
}

export async function getAgentDetail(agentId: string, selectedVersionId?: string) {
  await ensureSeeded()
  const detail = await suoraIpc.agents.get(agentId, selectedVersionId) as AgentDetail | null
  if (detail) {
    return detail
  }
  return systemAgentMap.get(agentId) ?? null
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