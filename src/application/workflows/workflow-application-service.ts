import { createWorkflow, deleteWorkflow, getWorkflowDetail, listWorkflows, publishWorkflowVersion, saveWorkflowDraft } from "@/data/repositories/workflow-repository"
import { dryRunWorkflowSnapshot, runWorkflow } from "@/services/workflows/workflow-run-service"

export const workflowApplicationService = {
  create: createWorkflow,
  delete: deleteWorkflow,
  getDetail: getWorkflowDetail,
  list: listWorkflows,
  publish: publishWorkflowVersion,
  saveDraft: saveWorkflowDraft,
  dryRun: dryRunWorkflowSnapshot,
  run: runWorkflow,
}
