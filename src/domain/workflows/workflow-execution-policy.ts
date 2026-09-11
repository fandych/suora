import type { Edge, Node } from "@xyflow/react"
import type { WorkflowEdgeData, WorkflowNodeData } from "@/data/domain/workflow-models"
import type { WorkflowVariableContext } from "@/domain/workflows/workflow-variable-context"
import { evaluateExpression } from "@/domain/workflows/workflow-expression"
export function withWorkflowTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string) { return Promise.race<T>([operation, new Promise<T>((_resolve, reject) => globalThis.setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs} ms.`)), timeoutMs))]) }
export function getWorkflowExecutionLimits(definition: { budget?: { maxSteps?: number; maxDurationMs?: number } }) { return { maxSteps: Math.min(definition.budget?.maxSteps ?? 100, 1000), maxDurationMs: Math.min(definition.budget?.maxDurationMs ?? 120000, 3_600_000) } }
export function getNextWorkflowEdges(node: Node<WorkflowNodeData>, output: unknown, outgoing: Map<string, Edge<WorkflowEdgeData>[]>, context: WorkflowVariableContext) {
	const edges = outgoing.get(node.id) ?? []
	if (node.data.kind === "if-else") { const branches = node.data.branches ?? []; const selected = branches.find((branch, index) => index < branches.length - 1 && evaluateExpression(branch.expression, context)) ?? branches.at(-1); return edges.filter((edge) => edge.sourceHandle === selected?.id) }
	if (node.data.kind === "condition") return edges.filter((edge) => edge.data?.condition?.trim() ? evaluateExpression(edge.data.condition, context) : Boolean(output))
	return edges
}
