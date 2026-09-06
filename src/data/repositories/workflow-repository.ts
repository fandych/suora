import type { VersionOption, WorkflowDefinition, WorkflowDetail, WorkflowInvocationRecord, WorkflowSummary } from "@/data/domain/models"
import { emitDataChanged } from "@/data/repositories/data-events"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { executeWorkflowDefinition } from "@/data/repositories/workflow-execution-engine"
import { DEFAULT_WORKFLOW_NOTIFICATION_SETTINGS, normalizeWorkflowNotifications } from "@/data/repositories/workflow-notifications"
import { suoraIpc } from "@/lib/ipc"

async function sendWorkflowNotification(input: {
  workflowTitle: string
  trigger: string
  invocation: WorkflowInvocationRecord
  definition: WorkflowDefinition
}) {
  if (input.trigger === "dry-run") {
    return
  }

  const notifications = input.definition.notifications ?? DEFAULT_WORKFLOW_NOTIFICATION_SETTINGS
  if (!notifications.enabled || !notifications.to.trim()) {
    return
  }

  if (notifications.triggerOn === "manual" && input.trigger !== "manual") {
    return
  }

  if (notifications.triggerOn === "dry-run" && input.trigger !== "dry-run") {
    return
  }

  const output = JSON.parse(input.invocation.output) as { summary?: string; traversedNodes?: string; skippedNodes?: number }
  const subject = notifications.subjectTemplate
    .replace(/\{\{workflowTitle\}\}/g, input.workflowTitle)
    .replace(/\{\{status\}\}/g, input.invocation.status)
    .replace(/\{\{trigger\}\}/g, input.trigger)
  const lines = [
    `Workflow: ${input.workflowTitle}`,
    `Trigger: ${input.trigger}`,
    `Status: ${input.invocation.status}`,
  ]

  if (notifications.includeSummary) {
    lines.push("", output.summary ?? "No summary available.")
    if (output.traversedNodes) {
      lines.push(`Traversed nodes: ${output.traversedNodes}`)
    }
    if (typeof output.skippedNodes === "number") {
      lines.push(`Skipped nodes: ${output.skippedNodes}`)
    }
  }

  if (notifications.includeTrace) {
    lines.push("", "Trace:")
    for (const trace of input.invocation.traces) {
      lines.push(`- ${trace.label}: ${trace.status} | ${trace.output}`)
    }
  }

  await suoraIpc.mail.send({
    to: notifications.to.trim(),
    subject,
    content: lines.join("\n"),
  })
}

async function recordWorkflowInvocation(input: {
  workflowId: string
  workflowTitle: string
  selectedVersion: VersionOption
  definition: WorkflowDefinition
  trigger: string
  onTrace?: (trace: WorkflowInvocationRecord["traces"][number]) => void
}): Promise<WorkflowInvocationRecord> {
  const normalizedDefinition = normalizeWorkflowNotifications(input.definition)
  const dryRunInput = JSON.parse(normalizedDefinition.dryRunInputJson ?? "{}") as unknown
  const executionStartedAt = Date.now()
  const execution = await executeWorkflowDefinition(normalizedDefinition, dryRunInput, input.trigger === "dry-run" ? "dry-run" : "manual", input.onTrace).catch((error) => ({
    traces: [{
      nodeId: normalizedDefinition.nodes.find((node) => node.data.kind === "start")?.id ?? "workflow",
      label: "Workflow execution",
      status: "error" as const,
      input: JSON.stringify(dryRunInput),
      output: error instanceof Error ? error.message : String(error),
      startedAt: Date.now(),
      finishedAt: Date.now(),
    }],
    output: { error: error instanceof Error ? error.message : String(error) },
  }))
  const executionFinishedAt = Date.now()
  const traces = execution.traces
  const hasError = traces.some((trace) => trace.status === "error")
  const traversedNodes = traces.filter((trace) => trace.status === "success").map((trace) => trace.label).join(" -> ")
  const invocation: WorkflowInvocationRecord = {
    id: crypto.randomUUID(),
    versionId: input.selectedVersion.id,
    status: hasError ? "error" : "success",
    trigger: input.trigger,
    input: JSON.stringify({
      version: input.selectedVersion.label,
      nodeCount: input.definition.nodes.length,
      resourceBindings: input.definition.resourceBindings,
      dryRunInput,
    }),
    output: JSON.stringify({
      summary: `${input.trigger === "dry-run" ? "Dry run" : "Executed"} ${input.workflowTitle}`,
      traversedNodes,
      skippedNodes: traces.filter((trace) => trace.status === "skipped").length,
      mode: input.trigger === "dry-run" ? "dry_run" : "production",
      executionTarget: input.trigger === "dry-run" ? "dry_run" : "desktop",
      requestId: crypto.randomUUID(),
      startedAt: executionStartedAt,
      finishedAt: executionFinishedAt,
      durationMs: Math.max(0, executionFinishedAt - executionStartedAt),
      errorMessage: hasError ? traces.find((trace) => trace.status === "error")?.output ?? null : null,
      result: execution.output,
    }),
    traces,
    createdAt: Date.now(),
  }

  await suoraIpc.workflows.recordInvocation({
    workflowId: input.workflowId,
    versionId: invocation.versionId,
    status: invocation.status,
    trigger: invocation.trigger,
    input: invocation.input,
    output: invocation.output,
    traceJson: JSON.stringify(invocation.traces),
  })

  await sendWorkflowNotification({
    workflowTitle: input.workflowTitle,
    trigger: input.trigger,
    invocation,
    definition: normalizedDefinition,
  }).catch(() => undefined)

  return invocation
}

export async function listWorkflows() {
  await ensureSeeded()
  return suoraIpc.workflows.list() as Promise<WorkflowSummary[]>
}

export async function createWorkflow() {
  await ensureSeeded()
  const created = await suoraIpc.workflows.create() as WorkflowDetail
  emitDataChanged("/workflows")
  return created
}

export async function getWorkflowDetail(workflowId: string, selectedVersionId?: string) {
  await ensureSeeded()
  const detail = await suoraIpc.workflows.get(workflowId, selectedVersionId) as WorkflowDetail | null
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
  const saved = await suoraIpc.workflows.save({ id: workflowId, title: payload.title, summary: payload.summary, definition: normalizeWorkflowNotifications(payload.definition), selectedVersionId: payload.selectedVersionId }) as WorkflowDetail
  emitDataChanged("/workflows")
  return saved
}

export async function publishWorkflowVersion(workflowId: string, versionId: string) {
  await ensureSeeded()
  const detail = await getWorkflowDetail(workflowId, versionId)
  const published = await suoraIpc.workflows.save({ id: workflowId, title: detail.workflow.title, summary: detail.workflow.summary, definition: normalizeWorkflowNotifications(detail.definition), publish: true }) as WorkflowDetail
  emitDataChanged("/workflows")
  return published
}

export async function deleteWorkflow(workflowId: string) {
  await ensureSeeded()
  const deleted = await suoraIpc.workflows.delete(workflowId)
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