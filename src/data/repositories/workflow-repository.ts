import type { VersionOption, WorkflowDefinition, WorkflowDetail, WorkflowInvocationRecord, WorkflowSummary } from "@/data/domain/models"
import { emitDataChanged } from "@/data/repositories/data-events"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { normalizeWorkflowNotifications } from "@/data/repositories/workflow-notifications"
import { projectIpc } from "@/lib/ipc"
import { recordWorkflowInvocation } from "@/services/workflows/workflow-invocation-service"

export async function listWorkflows() {
  await ensureSeeded()
  return projectIpc.workflows.list() as Promise<WorkflowSummary[]>
}

export async function createWorkflow() {
  await ensureSeeded()
  const created = await projectIpc.workflows.create() as WorkflowDetail
  emitDataChanged("/workflows")
  return created
}

export async function getWorkflowDetail(workflowId: string, selectedVersionId?: string) {
  await ensureSeeded()
  const detail = await projectIpc.workflows.get(workflowId, selectedVersionId) as WorkflowDetail | null
  if (!detail) {
    throw new Error(`Workflow ${workflowId} was not found.`)
  }
  return {
    ...detail,
    definition: normalizeWorkflowNotifications(detail.definition),
  }
}

export async function saveWorkflowDraft(workflowId: string, payload: { title: string; summary: string; definition: WorkflowDefinition; selectedVersionId?: string }) {
  await ensureSeeded()
  const saved = await projectIpc.workflows.save({ id: workflowId, title: payload.title, summary: payload.summary, definition: normalizeWorkflowNotifications(payload.definition), selectedVersionId: payload.selectedVersionId }) as WorkflowDetail
  emitDataChanged("/workflows")
  return saved
}

export async function publishWorkflowVersion(workflowId: string, versionId: string) {
  await ensureSeeded()
  const detail = await getWorkflowDetail(workflowId, versionId)
  const published = await projectIpc.workflows.save({ id: workflowId, title: detail.workflow.title, summary: detail.workflow.summary, definition: normalizeWorkflowNotifications(detail.definition), publish: true }) as WorkflowDetail
  emitDataChanged("/workflows")
  return published
}

export async function deleteWorkflow(workflowId: string) {
  await ensureSeeded()
  const deleted = await projectIpc.workflows.delete(workflowId)
  emitDataChanged("/workflows")
  return deleted
}

export async function dryRunWorkflowSnapshot(input: {
  workflowId: string
  workflowTitle: string
  selectedVersion: VersionOption
  definition: WorkflowDefinition
  onTrace?: (trace: WorkflowInvocationRecord["traces"][number]) => void
}) {
  await ensureSeeded()
  return recordWorkflowInvocation({ ...input, trigger: "dry-run" })
}

export async function runWorkflow(workflowId: string, selectedVersionId?: string) {
  await ensureSeeded()
  const snapshot = await getWorkflowDetail(workflowId, selectedVersionId)
  await recordWorkflowInvocation({
    workflowId,
    workflowTitle: snapshot.workflow.title,
    selectedVersion: snapshot.selectedVersion,
    definition: snapshot.definition,
    trigger: "manual",
  })
  return getWorkflowDetail(workflowId, selectedVersionId)
}