import type { WorkflowEdgeData, WorkflowNodeData, WorkflowExecutionContext } from "@/types/workflow"
import { evaluateExpression } from "@/electron/app/workflows/expression"

export type WorkflowEdge = {
  id?: string
  source: string
  target: string
  sourceHandle?: string | null
  data?: WorkflowEdgeData
}
export type WorkflowNode = { id: string; data: WorkflowNodeData }

export function withWorkflowTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string) {
  let timerId: ReturnType<typeof globalThis.setTimeout> | null = null
  return Promise.race<T>([
    operation,
    new Promise<T>((_resolve, reject) => {
      timerId = globalThis.setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs} ms.`)), timeoutMs)
    }),
  ]).finally(() => {
    if (timerId) globalThis.clearTimeout(timerId)
  })
}

export function getNextWorkflowEdges(
  node: WorkflowNode,
  output: unknown,
  outgoing: Map<string, WorkflowEdge[]>,
  context: WorkflowExecutionContext,
) {
  const edges = outgoing.get(node.id) ?? []
  if (node.data.kind === "if-else") {
    const branches = node.data.branches ?? []
    const selected =
      branches.find((branch, index) => index < branches.length - 1 && evaluateExpression(branch.expression, context)) ??
      branches.at(-1)
    return edges.filter((edge) => edge.sourceHandle === selected?.id)
  }
  if (node.data.kind === "condition")
    return edges.filter((edge) =>
      edge.data?.condition?.trim() ? evaluateExpression(edge.data.condition, context) : Boolean(output),
    )
  return edges
}
