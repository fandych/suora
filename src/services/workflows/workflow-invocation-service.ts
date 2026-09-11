import type { VersionOption } from "@/data/domain/version-models"
import type { WorkflowDefinition, WorkflowInvocationRecord } from "@/data/domain/workflow-models"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { executeWorkflowDefinition } from "@/data/repositories/workflow-execution-engine"
import { normalizeWorkflowNotifications } from "@/data/repositories/workflow-notifications"
import { projectIpc } from "@/lib/ipc"
import { sendWorkflowNotification } from "@/services/workflows/workflow-notification-service"
import { rendererWorkflowRuntimeAdapter } from "@/services/workflows/workflow-runtime-adapter"

export async function recordWorkflowInvocation(input: {
  workflowId: string
  workflowTitle: string
  selectedVersion: VersionOption
  definition: WorkflowDefinition
  trigger: string
  onTrace?: (trace: WorkflowInvocationRecord["traces"][number]) => void
}): Promise<WorkflowInvocationRecord> {
  await ensureSeeded()
  const normalizedDefinition = normalizeWorkflowNotifications(input.definition)
  const dryRunInput = JSON.parse(normalizedDefinition.dryRunInputJson ?? "{}") as unknown
  const executionStartedAt = Date.now()
  const execution = await executeWorkflowDefinition(
    normalizedDefinition,
    dryRunInput,
    input.trigger === "dry-run" ? "dry-run" : "manual",
    input.onTrace,
    rendererWorkflowRuntimeAdapter,
  ).catch((error) => ({
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

  await projectIpc.workflows.recordInvocation({
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
