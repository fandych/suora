import { describe, expect, it } from "vitest"
import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/data/domain/workflow-models"
import { createWorkflowExecutionContext } from "@/data/repositories/workflow-execution-context"
import { createCompletedWorkflowTrace, createFailedWorkflowTrace, createRunningWorkflowTrace, createSkippedWorkflowTrace } from "@/data/repositories/workflow-trace-recorder"

const node = { id: "node-1", data: { label: "Node", kind: "template", prompt: "" } } as Node<WorkflowNodeData>

describe("workflow trace recorder", () => {
  it("records running, skipped, completed and failed states", () => {
    const context = createWorkflowExecutionContext({})
    const running = createRunningWorkflowTrace(node, context, "trace-1", 1)
    const skipped = createSkippedWorkflowTrace(node, context, "trace-2", 1)
    const completed = createCompletedWorkflowTrace({ node, traceId: "trace-3", output: "ok", status: "success", traceInput: running.input, contextBefore: running.contextBefore!, context, startedAt: 1 })
    const failed = createFailedWorkflowTrace(node, context, "trace-4", running.input, 1, new Error("failed"))
    expect(running.status).toBe("running")
    expect(skipped.status).toBe("skipped")
    expect(completed.status).toBe("success")
    expect(failed.status).toBe("error")
    expect(failed.output).toBe("failed")
  })
})
