import type { VersionOption } from "@/data/domain/version-models"
import type { WorkflowDefinition, WorkflowInvocationRecord } from "@/data/domain/workflow-models"
import { getWorkflowDetail } from "@/data/repositories/workflow-repository"
import { recordWorkflowInvocation } from "@/services/workflows/workflow-invocation-service"

export function dryRunWorkflowSnapshot(input: {
  workflowId: string
  workflowTitle: string
  selectedVersion: VersionOption
  definition: WorkflowDefinition
  onTrace?: (trace: WorkflowInvocationRecord["traces"][number]) => void
}) {
  return recordWorkflowInvocation({ ...input, trigger: "dry-run" })
}

export function runWorkflow(workflowId: string, selectedVersionId?: string) {
  return getWorkflowDetail(workflowId, selectedVersionId).then(async (snapshot) => {
    await recordWorkflowInvocation({ workflowId, workflowTitle: snapshot.workflow.title, selectedVersion: snapshot.selectedVersion, definition: snapshot.definition, trigger: "manual" })
    return getWorkflowDetail(workflowId, selectedVersionId)
  })
}
