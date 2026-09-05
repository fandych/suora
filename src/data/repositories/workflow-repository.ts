import type { VersionOption, WorkflowDefinition, WorkflowDetail, WorkflowInvocationRecord, WorkflowNodeTraceRecord, WorkflowSummary } from "@/data/domain/models"
import { emitDataChanged } from "@/data/repositories/data-events"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { DEFAULT_WORKFLOW_NOTIFICATION_SETTINGS, normalizeWorkflowNotifications } from "@/data/repositories/workflow-notifications"
import { suoraIpc } from "@/lib/ipc"

async function sendWorkflowNotification(input: {
  workflowTitle: string
  trigger: string
  invocation: WorkflowInvocationRecord
  definition: WorkflowDefinition
}) {
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

function getWorkflowTraceInputPreview(node: WorkflowDefinition["nodes"][number]) {
  switch (node.data.kind) {
    case "start":
      return JSON.stringify({ trigger: "workflow-start", outputKey: node.data.outputKey || "request" }, null, 2)
    case "agent":
      return JSON.stringify({ agentId: node.data.agentId || null, modelId: node.data.modelId || null, task: node.data.task || "", prompt: node.data.prompt || "" }, null, 2)
    case "document-retrieval":
      return JSON.stringify({ documentId: node.data.documentId || null, queryExpression: node.data.queryExpression || "$input.query", resultLimit: node.data.resultLimit ?? 5 }, null, 2)
    case "http":
      return JSON.stringify({ integrationId: node.data.integrationId || null, method: node.data.method || "POST", url: node.data.url || "", headersJson: node.data.headersJson || "{}", bodyJson: node.data.bodyJson || "{}" }, null, 2)
    case "script":
      return JSON.stringify({ runtime: node.data.runtime || "node", timeoutSeconds: node.data.timeoutSeconds ?? 60, outputKey: node.data.outputKey || "script_result" }, null, 2)
    case "if-else":
      return JSON.stringify({ runIf: node.data.runIf || "", branches: node.data.branches ?? [] }, null, 2)
    case "fork":
      return JSON.stringify({ branchCount: node.data.branchCount ?? 2, outputKey: node.data.outputKey || "fork_result" }, null, 2)
    case "join":
      return JSON.stringify({ joinStrategy: node.data.joinStrategy ?? "wait-all", outputKey: node.data.outputKey || "join_result" }, null, 2)
    case "end":
      return JSON.stringify({ inputTemplate: node.data.inputTemplate || "", outputKey: node.data.outputKey || "response" }, null, 2)
    default:
      return JSON.stringify({ kind: node.data.kind, task: node.data.task || "", outputKey: node.data.outputKey || "" }, null, 2)
  }
}

function buildWorkflowTraces(definition: WorkflowDefinition) {
  const normalizedDefinition = normalizeWorkflowNotifications(definition)
  const start = Date.now()
  return normalizedDefinition.nodes.map((node, index) => {
    const isDisabled = node.data.enabled === false
    const isConditionSkipped = node.data.kind === "if-else" && /(^|\s)(false|skip|0)(\s|$)/i.test(node.data.runIf ?? node.data.branches?.[0]?.expression ?? "")
    const isAgentError = node.data.kind === "agent" && !node.data.prompt.trim()
    const isHttpError = node.data.kind === "http" && !node.data.url?.trim() && !node.data.integrationId?.trim()
    const isScriptError = node.data.kind === "script" && !node.data.script?.trim()
    const isDocumentError = node.data.kind === "document-retrieval" && !node.data.documentId?.trim()
    const isError = !isDisabled && !isConditionSkipped && (isAgentError || isHttpError || isScriptError || isDocumentError)
    const status: WorkflowNodeTraceRecord["status"] = isDisabled ? "queued" : isConditionSkipped ? "queued" : isError ? "error" : "success"
    const output = isDisabled
      ? `${node.data.label} skipped because the node is disabled.`
      : isConditionSkipped
        ? `${node.data.label} skipped because runIf evaluated to false.`
        : isAgentError
          ? `${node.data.label} failed because the agent prompt is empty.`
          : isHttpError
            ? `${node.data.label} failed because no integration or URL is configured.`
            : isScriptError
              ? `${node.data.label} failed because no script body is configured.`
              : isDocumentError
                ? `${node.data.label} failed because no document source is configured.`
                : node.data.kind === "document-retrieval"
                  ? `${node.data.label} retrieved up to ${node.data.resultLimit ?? 5} passages from ${node.data.documentName || node.data.documentId}.`
                  : node.data.kind === "http"
                    ? `${node.data.label} called ${node.data.integrationName || node.data.url || node.data.integrationId}.`
                    : node.data.kind === "script"
                      ? `${node.data.label} executed ${node.data.runtime || "node"} script.`
                      : node.data.kind === "fork"
                        ? `${node.data.label} split execution into ${node.data.branchCount ?? 2} branches.`
                        : node.data.kind === "join"
                          ? `${node.data.label} merged branch outputs using ${node.data.joinStrategy ?? "wait-all"}.`
                          : node.data.kind === "if-else"
                            ? `${node.data.label} evaluated ${node.data.branches?.length ?? 2} conditional branches.`
                            : node.data.kind === "end"
                              ? `${node.data.label} finalized the workflow output.`
                              : `${node.data.kind} completed for ${node.data.label}${node.data.agentId ? ` using ${node.data.agentId}` : ""}`
    return {
      nodeId: node.id,
      label: node.data.label,
      status,
      input: getWorkflowTraceInputPreview(node),
      output,
      startedAt: start + index * 320,
      finishedAt: start + index * 320 + Math.min(node.data.timeoutMs ?? 30000, 240),
    } satisfies WorkflowNodeTraceRecord
  })
}

async function recordWorkflowInvocation(input: {
  workflowId: string
  workflowTitle: string
  selectedVersion: VersionOption
  definition: WorkflowDefinition
  trigger: string
}): Promise<WorkflowInvocationRecord> {
  const normalizedDefinition = normalizeWorkflowNotifications(input.definition)
  const traces = buildWorkflowTraces(normalizedDefinition)
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
      dryRunInput: normalizedDefinition.dryRunInputJson,
    }),
    output: JSON.stringify({
      summary: `${input.trigger === "dry-run" ? "Dry run" : "Executed"} ${input.workflowTitle}`,
      traversedNodes,
      skippedNodes: traces.filter((trace) => trace.status === "queued").length,
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