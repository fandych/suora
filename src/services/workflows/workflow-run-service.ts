import type { VersionOption, WorkflowDefinition, WorkflowInvocationRecord } from "@/data/domain/models"
import { dryRunWorkflowSnapshot as dryRunWorkflowSnapshotRepository, runWorkflow as runWorkflowRepository } from "@/data/repositories/workflow-repository"

export function dryRunWorkflowSnapshot(input: {
  workflowId: string
  workflowTitle: string
  selectedVersion: VersionOption
  definition: WorkflowDefinition
  onTrace?: (trace: WorkflowInvocationRecord["traces"][number]) => void
}) {
  return dryRunWorkflowSnapshotRepository(input)
}

export function runWorkflow(workflowId: string, selectedVersionId?: string) {
  return runWorkflowRepository(workflowId, selectedVersionId)
}
