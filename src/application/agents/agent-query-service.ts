import { getAgentDetail, listAvailableAgents } from "@/data/repositories/agent-repository"
import { listConfiguredModelProviders } from "@/data/repositories/model-config-repository"

export const agentQueryService = {
  listAvailable: listAvailableAgents,
  getDetail: getAgentDetail,
  listProviders: listConfiguredModelProviders,
}
