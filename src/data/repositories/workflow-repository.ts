import type { WorkflowDefinition, WorkflowDetail, WorkflowSummary } from "@/data/domain/models"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { suoraIpc } from "@/lib/ipc"

export async function listWorkflows() {
  await ensureSeeded()
  return suoraIpc.workflows.list() as Promise<WorkflowSummary[]>
}

export async function createWorkflow() {
  await ensureSeeded()
  return suoraIpc.workflows.create() as Promise<WorkflowDetail>
}

export async function getWorkflowDetail(workflowId: string, selectedVersionId?: string) {
  await ensureSeeded()
  const detail = await suoraIpc.workflows.get(workflowId) as WorkflowDetail | null
  if (!detail) {
    throw new Error(`Workflow ${workflowId} was not found.`)
  }
  if (!selectedVersionId || detail.selectedVersion.id === selectedVersionId) {
    return detail
  }
  const selectedVersion = detail.versions.find((version) => version.id === selectedVersionId) ?? detail.selectedVersion
  return { ...detail, selectedVersion }
}

export async function saveWorkflowDraft(workflowId: string, payload: { title: string; summary: string; definition: WorkflowDefinition }) {
  await ensureSeeded()
  return suoraIpc.workflows.save({ id: workflowId, title: payload.title, summary: payload.summary, definition: payload.definition }) as Promise<WorkflowDetail>
}

export async function publishWorkflowVersion(workflowId: string, versionId: string) {
  await ensureSeeded()
  const detail = await getWorkflowDetail(workflowId, versionId)
  return suoraIpc.workflows.save({ id: workflowId, title: detail.workflow.title, summary: detail.workflow.summary, definition: detail.definition, publish: true }) as Promise<WorkflowDetail>
}

export async function runWorkflow(workflowId: string, selectedVersionId?: string) {
  await ensureSeeded()
  const snapshot = await getWorkflowDetail(workflowId, selectedVersionId)
  const traversedNodes = snapshot.definition.nodes.map((node) => node.data.label).join(" -> ")
  const start = Date.now()
  const traces = snapshot.definition.nodes.map((node, index) => ({
    nodeId: node.id,
    label: node.data.label,
    status: "success" as const,
    output: `${node.data.kind} completed for ${node.data.label}`,
    startedAt: start + index * 320,
    finishedAt: start + index * 320 + 240,
  }))
  await suoraIpc.workflows.recordInvocation({ workflowId, versionId: snapshot.selectedVersion.id, status: "success", trigger: "manual", input: JSON.stringify({ version: snapshot.selectedVersion.label, nodeCount: snapshot.definition.nodes.length }), output: JSON.stringify({ summary: `Executed ${snapshot.workflow.title}`, traversedNodes }), traceJson: JSON.stringify(traces) })
  return getWorkflowDetail(workflowId, selectedVersionId)
}