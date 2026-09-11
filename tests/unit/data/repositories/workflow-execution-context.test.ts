import { describe, expect, it } from "vitest"
import { applyWorkflowNodeOutput, createWorkflowExecutionContext, getWorkflowExecutionBudget } from "@/data/repositories/workflow-execution-context"

describe("workflow execution context", () => {
  it("creates aliases for the workflow input and mutable state", () => {
    const context = createWorkflowExecutionContext({ id: "request-1" })
    expect(context.input).toEqual({ id: "request-1" })
    expect(context.$input).toBe(context.input)
    expect(context.$vars).toBe(context.vars)
    expect(context.$steps).toBe(context.steps)
  })

  it("writes node output to steps and output key", () => {
    const context = createWorkflowExecutionContext({})
    applyWorkflowNodeOutput(context, "node-1", "Format", "done", "result")
    expect(context.current).toBe("done")
    expect(context.steps["node-1"]).toBe("done")
    expect(context.steps.Format).toBe("done")
    expect(context.result).toBe("done")
    expect(context.vars.result).toBe("done")
  })

  it("caps the workflow execution budget", () => {
    expect(getWorkflowExecutionBudget({ budget: { maxSteps: 5000, maxDurationMs: 9_000_000 } })).toEqual({ maxSteps: 1000, maxDurationMs: 3_600_000 })
  })
})
