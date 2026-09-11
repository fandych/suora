import { createAgent, deleteAgent, getAgentDetail, listAgents, saveAgentDraft, setSystemAgentDisabled } from "@/data/repositories/agent-repository"
import type { AgentDetail } from "@/data/domain/provider-agent-models"

export const agentApplicationService = {
  list: () => listAgents(),
  create: () => createAgent(),
  getDetail: (agentId: string, versionId?: string) => getAgentDetail(agentId, versionId),
  saveDraft: (draft: AgentDetail, publish = false) => saveAgentDraft(draft, publish),
  remove: (agentId: string) => deleteAgent(agentId),
  setDisabled: (agentId: string, disabled: boolean) => setSystemAgentDisabled(agentId, disabled),
}
