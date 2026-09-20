import type { WorkflowExecutionContext } from "@/types/workflow"

const RESERVED_WORKFLOW_CONTEXT_KEYS = new Set([
  "__proto__",
  "$context",
  "$current",
  "$input",
  "$steps",
  "$vars",
  "constructor",
  "current",
  "input",
  "prototype",
  "runtime",
  "steps",
  "vars",
])

export function isReservedWorkflowContextKey(value: string | undefined) {
  const normalized = value?.trim()
  return Boolean(normalized && (normalized.startsWith("$") || RESERVED_WORKFLOW_CONTEXT_KEYS.has(normalized)))
}

export function createWorkflowExecutionContext(input: unknown): WorkflowExecutionContext {
  const context: WorkflowExecutionContext = {
    input: input && typeof input === "object" ? input : { value: input },
    vars: {},
    steps: {},
    current: undefined,
  }
  context.$input = context.input
  context.$vars = context.vars
  context.$steps = context.steps
  context.$current = context.current
  Object.defineProperty(context, "$context", { value: context, enumerable: false, configurable: true, writable: true })
  return context
}

export function applyWorkflowNodeOutput(
  context: WorkflowExecutionContext,
  nodeId: string,
  label: string,
  output: unknown,
  outputKey?: string,
) {
  context.current = output
  context.$current = output
  context.steps[nodeId] = output
  context.steps[label] = output
  if (outputKey) {
    if (isReservedWorkflowContextKey(outputKey)) {
      throw new Error(`Workflow output key '${outputKey}' is reserved by the runtime.`)
    }
    context[outputKey] = output
    context.vars[outputKey] = output
  }
}

export function getWorkflowExecutionBudget(definition: { budget?: { maxSteps?: number; maxDurationMs?: number } }) {
  return {
    maxSteps: Math.min(definition.budget?.maxSteps ?? 100, 1000),
    maxDurationMs: Math.min(definition.budget?.maxDurationMs ?? 120000, 3_600_000),
  }
}
