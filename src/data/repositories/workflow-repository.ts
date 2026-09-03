import type { VersionOption, WorkflowDefinition, WorkflowDetail, WorkflowInvocationRecord, WorkflowNodeTraceRecord, WorkflowSummary } from "@/data/domain/models"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { suoraIpc } from "@/lib/ipc"

function buildWorkflowTraces(definition: WorkflowDefinition) {
  const start = Date.now()
  return definition.nodes.map((node, index) => {
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
  const traces = buildWorkflowTraces(input.definition)
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
      dryRunInput: input.definition.dryRunInputJson,
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

  return invocation
}

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
  const detail = await suoraIpc.workflows.get(workflowId, selectedVersionId) as WorkflowDetail | null
  if (!detail) {
    throw new Error(`Workflow ${workflowId} was not found.`)
  }
  return detail
}

export async function saveWorkflowDraft(workflowId: string, payload: { title: string; summary: string; definition: WorkflowDefinition; selectedVersionId?: string }) {
  await ensureSeeded()
  return suoraIpc.workflows.save({ id: workflowId, title: payload.title, summary: payload.summary, definition: payload.definition, selectedVersionId: payload.selectedVersionId }) as Promise<WorkflowDetail>
}

export async function publishWorkflowVersion(workflowId: string, versionId: string) {
  await ensureSeeded()
  const detail = await getWorkflowDetail(workflowId, versionId)
  return suoraIpc.workflows.save({ id: workflowId, title: detail.workflow.title, summary: detail.workflow.summary, definition: detail.definition, publish: true }) as Promise<WorkflowDetail>
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