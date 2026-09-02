import type { AgentDetail, AgentSummary } from "@/data/domain/models"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { suoraIpc } from "@/lib/ipc"

export async function listAgents() {
  await ensureSeeded()
  return suoraIpc.agents.list() as Promise<AgentSummary[]>
}

export async function getAgentDetail(agentId: string, selectedVersionId?: string) {
  await ensureSeeded()
  return suoraIpc.agents.get(agentId, selectedVersionId) as Promise<AgentDetail | null>
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