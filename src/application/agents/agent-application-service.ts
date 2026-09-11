import { deleteAgent, getAgentDetail, listAgents, saveAgentDraft } from "@/data/repositories/agent-repository"
import type { AgentDetail } from "@/data/domain/models"

export const agentApplicationService = {
  list: () => listAgents(),
  getDetail: (agentId: string, versionId?: string) => getAgentDetail(agentId, versionId),
  saveDraft: (draft: AgentDetail, publish = false) => saveAgentDraft(draft, publish),
  remove: (agentId: string) => deleteAgent(agentId),
}
