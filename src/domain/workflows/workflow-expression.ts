import { interpolate, readPath, type WorkflowVariableContext } from "@/domain/workflows/workflow-variable-context"
import type { IntegrationExecutionResult } from "@/data/repositories/integration-execution-repository"

export type ExecutionContext = WorkflowVariableContext
export function toWorkflowHttpResult(result: IntegrationExecutionResult) { return !result.request || !result.response ? result.body : { request: result.request, response: result.response } }
export function evaluateExpression(expression: string, context: ExecutionContext): boolean {
	const normalized = expression.trim()
	if (!normalized) return false
	if (normalized === "true") return true
	if (normalized === "false") return false
	const match = normalized.match(/^(.+?)\s*(===|!==|==|!=|>=|<=|>|<|contains|startsWith|endsWith)\s*(.+)$/)
	if (!match) { const value = readPath(context, normalized); return Boolean(value && value !== "false" && value !== "0") }
	const leftRaw = match[1].trim(); const operator = match[2].trim(); const rightRaw = match[3].trim()
	const left = leftRaw.startsWith("{{") || leftRaw.startsWith("$") ? readPath(context, leftRaw) : readPath(context, leftRaw) ?? interpolate(leftRaw, context)
	const rightText = rightRaw.startsWith("{{") || rightRaw.startsWith("$") ? readPath(context, rightRaw) : interpolate(rightRaw, context).replace(/^['"]|['"]$/g, "")
	const right = rightText === "true" ? true : rightText === "false" ? false : Number.isFinite(Number(rightText)) && rightText !== "" ? Number(rightText) : rightText
	switch (operator) {
		case "===": return left === right
		case "!==": return left !== right
		case "==": return String(left ?? "") === String(right ?? "")
		case "!=": return String(left ?? "") !== String(right ?? "")
		case ">": return Number(left) > Number(right)
		case "<": return Number(left) < Number(right)
		case ">=": return Number(left) >= Number(right)
		case "<=": return Number(left) <= Number(right)
		case "contains": return String(left ?? "").includes(String(right ?? ""))
		case "startsWith": return String(left ?? "").startsWith(String(right ?? ""))
		case "endsWith": return String(left ?? "").endsWith(String(right ?? ""))
		default: return false
	}
}
export { interpolate, readPath }
