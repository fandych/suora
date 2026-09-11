import type { WorkflowNodeData, WorkflowNodeTraceRecord, WorkflowTraceSnapshot } from "@/data/domain/workflow-models"
import { createWorkflowTraceSnapshot } from "@/data/repositories/workflow-trace-sanitizer"
import type { WorkflowExecutionContext } from "@/data/repositories/workflow-execution-context"

export function createWorkflowTraceId(nodeId: string, startedAt: number, traceCount: number) {
  return `${nodeId}-${startedAt}-${traceCount}`
}

export function createRunningWorkflowTrace(node: { id: string; data: WorkflowNodeData }, context: WorkflowExecutionContext, traceId: string, startedAt: number): WorkflowNodeTraceRecord {
  const contextBefore = createWorkflowTraceSnapshot(context)
  return { traceId, nodeId: node.id, label: node.data.label, status: "running", input: JSON.stringify(contextBefore), output: "Executing…", startedAt, finishedAt: startedAt, contextBefore }
}

export function createSkippedWorkflowTrace(node: { id: string; data: WorkflowNodeData }, context: WorkflowExecutionContext, traceId: string, startedAt: number): WorkflowNodeTraceRecord {
  const snapshot = createWorkflowTraceSnapshot(context)
  return { traceId, nodeId: node.id, label: node.data.label, status: "skipped", input: JSON.stringify(snapshot), output: "Node disabled.", startedAt, finishedAt: Date.now(), contextBefore: snapshot, contextAfter: snapshot }
}

export function createCompletedWorkflowTrace(input: { node: { id: string; data: WorkflowNodeData }; traceId: string; output: unknown; status: "success" | "skipped"; traceInput: string; contextBefore: WorkflowTraceSnapshot; context: WorkflowExecutionContext; startedAt: number }): WorkflowNodeTraceRecord {
  const contextAfter = createWorkflowTraceSnapshot(input.context)
  return { traceId: input.traceId, nodeId: input.node.id, label: input.node.data.label, status: input.status, input: input.traceInput, output: typeof input.output === "string" ? input.output : JSON.stringify(input.output), startedAt: input.startedAt, finishedAt: Date.now(), contextBefore: input.contextBefore, contextAfter }
}

export function createFailedWorkflowTrace(node: { id: string; data: WorkflowNodeData }, context: WorkflowExecutionContext, traceId: string, traceInput: string, startedAt: number, error: unknown): WorkflowNodeTraceRecord {
  const contextAfter = createWorkflowTraceSnapshot(context)
  return { traceId, nodeId: node.id, label: node.data.label, status: "error", input: traceInput, output: error instanceof Error ? error.message : String(error), startedAt, finishedAt: Date.now(), contextAfter }
}
