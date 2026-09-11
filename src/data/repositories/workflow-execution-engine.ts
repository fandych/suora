import type { Edge } from "@xyflow/react"

import type { WorkflowDefinition, WorkflowEdgeData, WorkflowNodeTraceRecord } from "@/data/domain/workflow-models"
import { combineNodeOutput, mapNodeOutput } from "@/data/repositories/workflow-variable-context"
import { evaluateExpression, toWorkflowHttpResult } from "@/data/repositories/workflow-expression"
import { getNextWorkflowEdges, withWorkflowTimeout } from "@/data/repositories/workflow-execution-policy"
import { applyWorkflowNodeOutput, createWorkflowExecutionContext, getWorkflowExecutionBudget, type WorkflowExecutionContext } from "@/data/repositories/workflow-execution-context"
import { createCompletedWorkflowTrace, createFailedWorkflowTrace, createRunningWorkflowTrace, createSkippedWorkflowTrace, createWorkflowTraceId } from "@/data/repositories/workflow-trace-recorder"
import { executeWorkflowNode, type WorkflowExecutionMode } from "@/data/repositories/workflow-node-executor"
import type { WorkflowRuntimePorts } from "@/data/domain/workflow-runtime-ports"

type WorkflowExecutionResult = {
  traces: WorkflowNodeTraceRecord[]
  output: Record<string, unknown>
}

export type ExecutionContext = WorkflowExecutionContext
export { evaluateExpression, toWorkflowHttpResult }
export { interpolate, readPath } from "@/data/repositories/workflow-variable-context"

const defaultWorkflowRuntimePorts: WorkflowRuntimePorts = {
  getChatRuntimeSettings: async () => { throw new Error("Chat runtime settings are not configured.") },
  streamChatAgentResponse: () => { throw new Error("Chat runtime is not configured.") },
  getDocumentDetail: async () => { throw new Error("Document runtime is not configured.") },
  getIntegrationDetail: async () => { throw new Error("Integration runtime is not configured.") },
  executeIntegration: async () => { throw new Error("Integration runtime is not configured.") },
  sendMail: async () => ({ success: false, error: "Mail runtime is not configured." }),
  serializeContext: (context) => JSON.stringify(context),
}

export async function executeWorkflowDefinition(definition: WorkflowDefinition, input: unknown, mode: WorkflowExecutionMode = "manual", onTrace?: (trace: WorkflowNodeTraceRecord) => void, ports?: WorkflowRuntimePorts): Promise<WorkflowExecutionResult> {
  const runtimePorts = ports ?? defaultWorkflowRuntimePorts
  const nodes = new Map(definition.nodes.map((node) => [node.id, node]))
  const outgoing = new Map<string, Edge<WorkflowEdgeData>[]>()
  const incoming = new Map<string, Edge<WorkflowEdgeData>[]>()
  for (const edge of definition.edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge as Edge<WorkflowEdgeData>])
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge as Edge<WorkflowEdgeData>])
  }

  const start = definition.nodes.find((node) => node.data.kind === "start")
  if (!start) throw new Error("Workflow requires a start node.")

  const context = createWorkflowExecutionContext(input)

  const traces: WorkflowNodeTraceRecord[] = []
  const { maxSteps, maxDurationMs } = getWorkflowExecutionBudget(definition)
  const workflowStartedAt = Date.now()

  const nodeStatus = new Map<string, "pending" | "running" | "completed" | "skipped" | "failed">()
  const edgeActive = new Map<string, boolean>()
  for (const [id] of nodes) nodeStatus.set(id, "pending")

  const readyQueue: string[] = [start.id]

  while (readyQueue.length > 0 && traces.length < maxSteps) {
    if (Date.now() - workflowStartedAt > maxDurationMs) {
      throw new Error(`Workflow exceeded its ${maxDurationMs} ms execution budget.`)
    }

    const currentBatch = readyQueue.splice(0, readyQueue.length)
    await Promise.all(
      currentBatch.map(async (id) => {
        const node = nodes.get(id)
        if (!node) return
        nodeStatus.set(id, "running")
        const startedAt = Date.now()
        const traceId = createWorkflowTraceId(id, startedAt, traces.length)

        if (node.data.enabled === false) {
          nodeStatus.set(id, "skipped")
          traces.push(createSkippedWorkflowTrace(node, context, traceId, startedAt))
          onTrace?.(traces.at(-1)!)
          return
        }

        const runningTrace = createRunningWorkflowTrace(node, context, traceId, startedAt)
        const contextBefore = runningTrace.contextBefore!
        const traceInput = runningTrace.input ?? ""
        try {
          onTrace?.(runningTrace)
          const attempts = Math.max(0, Math.min(node.data.retryCount ?? 0, 5)) + 1
          let output: unknown
          let lastError: unknown
          for (let attempt = 0; attempt < attempts; attempt += 1) {
            try {
              output = await withWorkflowTimeout(executeWorkflowNode(node, context, mode, runtimePorts), Math.max(100, Math.min(node.data.timeoutMs ?? 30000, maxDurationMs)), node.data.label)
              lastError = undefined
              break
            } catch (error) {
              lastError = error
            }
          }
          if (lastError) throw lastError

          const outputContext: ExecutionContext = { ...context, current: output, $current: output }
          const nodeOutput = combineNodeOutput(output, mapNodeOutput(node.data.outputSchemaJson, outputContext))
          applyWorkflowNodeOutput(context, node.id, node.data.label, nodeOutput, node.data.outputKey)

          nodeStatus.set(id, "completed")
          const activeEdges = getNextWorkflowEdges(node, output, outgoing, context)
          const allOutgoing = outgoing.get(node.id) ?? []
          for (const edge of allOutgoing) {
            edgeActive.set(edge.id, activeEdges.includes(edge))
          }

          const skipped = mode === "dry-run" && typeof output === "object" && output !== null && "skipped" in output
          traces.push(createCompletedWorkflowTrace({ node, traceId, output, status: skipped ? "skipped" : "success", traceInput, contextBefore, context, startedAt }))
          onTrace?.(traces.at(-1)!)
        } catch (error) {
          nodeStatus.set(id, "failed")
          traces.push(createFailedWorkflowTrace(node, context, traceId, traceInput, startedAt, error))
          onTrace?.(traces.at(-1)!)
          if (!node.data.continueOnError) return
        }
      })
    )

    let progress = false
    for (const [id] of nodes) {
      if (nodeStatus.get(id) !== "pending") continue
      const inEdges = incoming.get(id) ?? []
      if (inEdges.length === 0) continue

      const allInResolved = inEdges.every((edge) => {
        const srcStatus = nodeStatus.get(edge.source)
        return srcStatus === "completed" || srcStatus === "skipped" || srcStatus === "failed"
      })

      if (!allInResolved) continue

      const hasActiveEdge = inEdges.some((edge) => edgeActive.get(edge.id) !== false)
      if (hasActiveEdge) {
        readyQueue.push(id)
        progress = true
      } else {
        nodeStatus.set(id, "skipped")
        progress = true
      }
    }

    if (!progress && readyQueue.length === 0) break
  }

  if (traces.length >= maxSteps) throw new Error(`Workflow reached its ${maxSteps}-step safety limit.`)
  return { traces, output: context }
}
