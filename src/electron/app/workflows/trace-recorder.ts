import type { WorkflowNodeData, WorkflowNodeTraceRecord, WorkflowTraceSnapshot } from "@/types/workflow"
import type { WorkflowExecutionContext } from "@/types/workflow"
import { createWorkflowTraceSnapshot } from "@/electron/app/workflows/trace-sanitizer"

const MAX_TRACE_TEXT_BYTES = 16 * 1024

function truncateTraceText(value: string) {
  if (Buffer.byteLength(value, "utf8") <= MAX_TRACE_TEXT_BYTES) return value
  let truncated = value
  while (Buffer.byteLength(`${truncated}… [truncated]`, "utf8") > MAX_TRACE_TEXT_BYTES && truncated.length > 0) {
    truncated = truncated.slice(0, -128)
  }
  return `${truncated}… [truncated]`
}

function serializeTraceValue(value: unknown) {
  try {
    return truncateTraceText(typeof value === "string" ? value : JSON.stringify(value))
  } catch {
    return truncateTraceText(String(value))
  }
}

export function createWorkflowTraceId(nodeId: string, startedAt: number, traceCount: number) {
  return `${nodeId}-${startedAt}-${traceCount}`
}

export function createRunningWorkflowTrace(
  node: { id: string; data: WorkflowNodeData },
  context: WorkflowExecutionContext,
  traceId: string,
  startedAt: number,
): WorkflowNodeTraceRecord {
  const contextBefore = createWorkflowTraceSnapshot(context)
  return {
    traceId,
    nodeId: node.id,
    label: node.data.label,
    status: "running",
    input: serializeTraceValue(contextBefore),
    output: "Executing…",
    startedAt,
    finishedAt: startedAt,
    contextBefore,
  }
}

export function createSkippedWorkflowTrace(
  node: { id: string; data: WorkflowNodeData },
  context: WorkflowExecutionContext,
  traceId: string,
  startedAt: number,
): WorkflowNodeTraceRecord {
  const snapshot = createWorkflowTraceSnapshot(context)
  return {
    traceId,
    nodeId: node.id,
    label: node.data.label,
    status: "skipped",
    input: serializeTraceValue(snapshot),
    output: "Node disabled.",
    startedAt,
    finishedAt: Date.now(),
    contextBefore: snapshot,
    contextAfter: snapshot,
  }
}

export function createCompletedWorkflowTrace(input: {
  node: { id: string; data: WorkflowNodeData }
  traceId: string
  output: unknown
  status: "success" | "skipped"
  traceInput: string
  contextBefore: WorkflowTraceSnapshot
  context: WorkflowExecutionContext
  startedAt: number
}): WorkflowNodeTraceRecord {
  const contextAfter = createWorkflowTraceSnapshot(input.context)
  return {
    traceId: input.traceId,
    nodeId: input.node.id,
    label: input.node.data.label,
    status: input.status,
    input: truncateTraceText(input.traceInput),
    output: serializeTraceValue(input.output),
    startedAt: input.startedAt,
    finishedAt: Date.now(),
    contextBefore: input.contextBefore,
    contextAfter,
  }
}

export function createFailedWorkflowTrace(
  node: { id: string; data: WorkflowNodeData },
  context: WorkflowExecutionContext,
  traceId: string,
  traceInput: string,
  startedAt: number,
  error: unknown,
): WorkflowNodeTraceRecord {
  const contextAfter = createWorkflowTraceSnapshot(context)
  return {
    traceId,
    nodeId: node.id,
    label: node.data.label,
    status: "error",
    input: truncateTraceText(traceInput),
    output: truncateTraceText(error instanceof Error ? error.message : String(error)),
    startedAt,
    finishedAt: Date.now(),
    contextAfter,
  }
}
