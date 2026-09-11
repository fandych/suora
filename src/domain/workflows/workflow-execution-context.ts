import type { WorkflowDefinition } from "@/data/domain/workflow-models"
import type { WorkflowExecutionContext } from "@/data/domain/workflow-runtime-context"

export type { WorkflowExecutionContext } from "@/data/domain/workflow-runtime-context"

export function createWorkflowExecutionContext(input: unknown): WorkflowExecutionContext {
	const context: WorkflowExecutionContext = { input: input && typeof input === "object" ? input : { value: input }, vars: {}, steps: {}, current: undefined }
	context.$input = context.input
	context.$vars = context.vars
	context.$steps = context.steps
	context.$current = context.current
	Object.defineProperty(context, "$context", { value: context, enumerable: false, configurable: true, writable: true })
	return context
}

export function applyWorkflowNodeOutput(context: WorkflowExecutionContext, nodeId: string, label: string, output: unknown, outputKey?: string) {
	context.current = output
	context.$current = output
	context.steps[nodeId] = output
	context.steps[label] = output
	if (outputKey) { context[outputKey] = output; context.vars[outputKey] = output }
}

export function getWorkflowExecutionBudget(definition: Pick<WorkflowDefinition, "budget">) {
	return { maxSteps: Math.min(definition.budget?.maxSteps ?? 100, 1000), maxDurationMs: Math.min(definition.budget?.maxDurationMs ?? 120000, 3_600_000) }
}
export * from "@/data/repositories/workflow-execution-context"
