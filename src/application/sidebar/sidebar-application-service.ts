import { deleteAgent, setSystemAgentDisabled } from "@/data/repositories/agent-repository"
import { deleteDocument } from "@/data/repositories/document-repository"
import { deleteModelProvider, listModelProviders, saveModelProvider } from "@/data/repositories/model-config-repository"
import { deleteSkill, getSkillDetail, saveSkillDraft } from "@/data/repositories/skill-repository"
import { deleteWorkflow } from "@/services/workflows/workflow-publish-service"

export const sidebarApplicationService = {
  disableAgent: (agentId: string, disabled: boolean) => setSystemAgentDisabled(agentId, disabled),
  deleteAgent,
  deleteDocument,
  deleteModelProvider,
  deleteSkill,
  deleteWorkflow,
  getSkillDetail,
  listModelProviders,
  saveModelProvider,
  saveSkillDraft,
}
