import { describe, expect, it } from "vitest"
import type { Edge, Node } from "@xyflow/react"
import type { WorkflowEdgeData, WorkflowNodeData } from "@/data/domain/models"
import { getNextWorkflowEdges, getWorkflowExecutionLimits } from "@/data/repositories/workflow-execution-policy"

describe("workflow execution policy", () => {
  it("caps execution budgets at supported limits", () => {
    expect(getWorkflowExecutionLimits({ budget: { maxSteps: 5000, maxDurationMs: 9_000_000 } })).toEqual({ maxSteps: 1000, maxDurationMs: 3_600_000 })
    expect(getWorkflowExecutionLimits({})).toEqual({ maxSteps: 100, maxDurationMs: 120000 })
  })

  it("selects the matching if-else branch", () => {
    const node = { id: "branch", data: { kind: "if-else", branches: [{ id: "yes", label: "Yes", expression: "$input.ok === true" }, { id: "no", label: "No", expression: "" }] } } as Node<WorkflowNodeData>
    const yes = { id: "yes-edge", source: "branch", target: "yes-node", sourceHandle: "yes" } as Edge<WorkflowEdgeData>
    const no = { id: "no-edge", source: "branch", target: "no-node", sourceHandle: "no" } as Edge<WorkflowEdgeData>
    expect(getNextWorkflowEdges(node, null, new Map([["branch", [yes, no]]]), { input: { ok: true }, vars: {}, steps: {}, current: undefined })).toEqual([yes])
  })
})
