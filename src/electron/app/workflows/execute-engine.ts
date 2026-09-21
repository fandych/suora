import { executeConditionNode } from "@/electron/app/workflows/execution/node-condition"
import { executeEndNode } from "@/electron/app/workflows/execution/node-end"
import { executeForkNode } from "@/electron/app/workflows/execution/node-fork"
import { executeIfElseNode } from "@/electron/app/workflows/execution/node-if-else"
import { executeJoinNode } from "@/electron/app/workflows/execution/node-join"
import { executeLoopNode } from "@/electron/app/workflows/execution/node-loop"
import { executeParallelNode } from "@/electron/app/workflows/execution/node-parallel"
import { executeScriptNode } from "@/electron/app/workflows/execution/node-script"
import { executeSerialNode } from "@/electron/app/workflows/execution/node-serial"
import { executeStartNode } from "@/electron/app/workflows/execution/node-start"
import { executeTemplateNode } from "@/electron/app/workflows/execution/node-template"
import { executeUnsupportedNode } from "@/electron/app/workflows/execution/node-unsupported"
import { executeVariableNode } from "@/electron/app/workflows/execution/node-variable-assigner"
import { executeWikiRetrievalNode } from "@/electron/app/workflows/execution/node-wiki-retrieval"
import { executeAgentNode } from "@/electron/app/workflows/execution/node-agent"
import { executeAiResponseNode } from "@/electron/app/workflows/execution/node-ai-response"
import { executeDocumentRetrievalNode } from "@/electron/app/workflows/execution/node-document-retrieval"
import { executeEmailNode } from "@/electron/app/workflows/execution/node-email"
import { executeHttpNode } from "@/electron/app/workflows/execution/node-http"
import type {
  WorkflowExecutionContext,
  WorkflowNode,
  WorkflowNodeExecutor,
  WorkflowExecutionMode,
  WorkflowExecutionRuntime,
} from "@/types/workflow-runtime"
import type { WorkflowNodeTraceRecord, WorkflowRunEvent, WorkflowRunStartCommand } from "@/types/workflow"
import {
  applyWorkflowNodeOutput,
  createWorkflowExecutionContext,
  getWorkflowExecutionBudget,
} from "@/electron/app/workflows/context"
import { getNextWorkflowEdges, type WorkflowEdge, withWorkflowTimeout } from "@/electron/app/workflows/policy"
import {
  createCompletedWorkflowTrace,
  createFailedWorkflowTrace,
  createRunningWorkflowTrace,
  createSkippedWorkflowTrace,
  createWorkflowTraceId,
} from "@/electron/app/workflows/trace-recorder"

type WorkflowCommand = WorkflowRunStartCommand & {
  definition: WorkflowRunStartCommand["definition"] & { nodes: WorkflowNode[]; edges: WorkflowEdge[] }
  runtime: WorkflowExecutionRuntime
}

const executors: Record<string, WorkflowNodeExecutor> = {
  start: executeStartNode,
  end: executeEndNode,
  template: executeTemplateNode,
  "variable-assigner": executeVariableNode,
  condition: executeConditionNode,
  "if-else": executeIfElseNode,
  fork: executeForkNode,
  join: executeJoinNode,
  loop: executeLoopNode,
  parallel: executeParallelNode,
  serial: executeSerialNode,
  script: executeScriptNode,
  agent: executeAgentNode,
  "ai-response": executeAiResponseNode,
  "document-retrieval": executeDocumentRetrievalNode,
  "wiki-retrieval": executeWikiRetrievalNode,
  http: executeHttpNode,
  toolset: executeHttpNode,
  webhook: executeHttpNode,
  smtp: executeEmailNode,
}

export async function executeWorkflowCommand(
  command: WorkflowCommand,
  emit: (event: WorkflowRunEvent) => void,
  signal: AbortSignal,
) {
  const context = createWorkflowExecutionContext(command.input) as WorkflowExecutionContext & {
    runtime: WorkflowExecutionRuntime
  }
  context.runtime = command.runtime
  const nodes = new Map(command.definition.nodes.map((node) => [node.id, node]))
  const outgoing = new Map<string, WorkflowEdge[]>()
  for (const edge of command.definition.edges) outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge])
  const start = command.definition.nodes.find((node) => node.data.kind === "start")
  if (!start) throw new Error("Workflow requires a start node.")
  const queue = [start.id]
  const completed = new Set<string>()
  let terminalReached = false
  const traces: WorkflowNodeTraceRecord[] = []
  const { maxSteps, maxDurationMs } = getWorkflowExecutionBudget(command.definition)
  const deadline = Date.now() + maxDurationMs
  let steps = 0

  while (queue.length) {
    if (signal.aborted) throw new Error("Workflow execution cancelled.")
    if (Date.now() > deadline) throw new Error(`Workflow timed out after ${maxDurationMs} ms.`)
    if (steps >= maxSteps) throw new Error(`Workflow reached its ${maxSteps}-step safety limit.`)
    const nodeId = queue.shift()!
    const node = nodes.get(nodeId)
    if (!node || completed.has(nodeId)) continue
    if (node.data.kind === "end") terminalReached = true
    const startedAt = Date.now()
    const traceId = createWorkflowTraceId(nodeId, startedAt, traces.length)
    if (node.data.enabled === false) {
      const trace = createSkippedWorkflowTrace(node, context, traceId, startedAt)
      traces.push(trace)
      emit({ requestId: command.requestId, type: "trace", trace })
      completed.add(nodeId)
      for (const edge of getNextWorkflowEdges(node, undefined, outgoing, context))
        if (!completed.has(edge.target)) queue.push(edge.target)
      continue
    }
    const runningTrace = createRunningWorkflowTrace(node, context, traceId, startedAt)
    emit({ requestId: command.requestId, type: "trace", trace: runningTrace })
    let output: unknown
    try {
      const executor = executors[node.data.kind ?? ""] ?? executeUnsupportedNode
      output = await executeNodeWithRetry(executor, node, context, command.mode, signal)
    } catch (error) {
      const trace = createFailedWorkflowTrace(node, context, traceId, runningTrace.input ?? "", startedAt, error)
      traces.push(trace)
      emit({ requestId: command.requestId, type: "trace", trace })
      completed.add(nodeId)
      if (!node.data.continueOnError) {
        const workflowError = error instanceof Error ? error : new Error(String(error))
        ;(workflowError as Error & { traces?: WorkflowNodeTraceRecord[] }).traces = traces
        throw workflowError
      }
      for (const edge of getNextWorkflowEdges(node, undefined, outgoing, context))
        if (!completed.has(edge.target)) queue.push(edge.target)
      continue
    }
    const skipped = command.mode === "dry-run" && typeof output === "object" && output !== null && "skipped" in output
    applyWorkflowNodeOutput(context, node.id, node.data.label, output, node.data.outputKey)
    const trace = createCompletedWorkflowTrace({
      node,
      traceId,
      output,
      status: skipped ? "skipped" : "success",
      traceInput: runningTrace.input ?? "",
      contextBefore: runningTrace.contextBefore!,
      context,
      startedAt,
    })
    traces.push(trace)
    emit({ requestId: command.requestId, type: "trace", trace })
    completed.add(nodeId)
    steps += 1
    for (const edge of getNextWorkflowEdges(node, output, outgoing, context))
      if (!completed.has(edge.target)) queue.push(edge.target)
  }
  if (!terminalReached) throw new Error("Workflow completed without reaching an end node.")
  return { output: context, traces }
}

async function executeNodeWithRetry(
  executor: WorkflowNodeExecutor,
  node: WorkflowNode,
  context: WorkflowExecutionContext,
  mode: WorkflowExecutionMode,
  signal: AbortSignal,
) {
  const attempts = Math.min(Math.max(node.data.retryCount ?? 0, 0), 5) + 1
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (signal.aborted) throw new Error("Workflow execution cancelled.")
    try {
      const timeoutMs = Math.max(1000, Math.min(node.data.timeoutMs ?? 30_000, 300_000))
      const timeoutController = new AbortController()
      const abortFromParent = () => timeoutController.abort()
      signal.addEventListener("abort", abortFromParent, { once: true })
      try {
        return await withWorkflowTimeout(executor(node, context, mode, timeoutController.signal), timeoutMs, `${node.data.label || node.id} node`)
      } finally {
        signal.removeEventListener("abort", abortFromParent)
        timeoutController.abort()
      }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}
