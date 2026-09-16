import {
  createWorkflowDefinition,
  deleteWorkflowDefinition,
  getWorkflowDefinition,
  listWorkflowDefinitions,
  recordWorkflowInvocation,
  saveWorkflowDefinition,
} from "@/electron/app/workflows/repository"

export const workflowService = {
  list: () => listWorkflowDefinitions(),
  get: (workflowId: string) => getWorkflowDefinition(workflowId),
  create: () => createWorkflowDefinition(),
  save: (payload: Parameters<typeof saveWorkflowDefinition>[0]) => saveWorkflowDefinition(payload),
  remove: (workflowId: string) => deleteWorkflowDefinition(workflowId),
  recordInvocation: (payload: Parameters<typeof recordWorkflowInvocation>[0]) => recordWorkflowInvocation(payload),
}
