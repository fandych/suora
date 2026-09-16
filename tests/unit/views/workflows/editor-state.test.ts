import { describe, expect, it } from "vitest"
import type { Edge, Node } from "@xyflow/react"

import { getWorkflowDesignIssues } from "@/lib/workflow/editor-state"
import type { WorkflowNodeData } from "@/types/workflow"

const node = (id: string, kind: WorkflowNodeData["kind"], label: string, prompt = "Configured") =>
  ({ id, type: "workflowNode", position: { x: 0, y: 0 }, data: { id, kind, label, prompt } }) as Node<WorkflowNodeData>

const validate = (nodes: Node<WorkflowNodeData>[], edges: Edge[] = []) =>
  getWorkflowDesignIssues({
    nodes,
    edges,
    availableAgentIds: [],
    availableDocumentIds: [],
    availableIntegrationIds: [],
    availableModelIds: [],
  })

describe("workflow design validation", () => {
  it("does not report conditional issues from branch-like data on non-if/else nodes", () => {
    const agent = node("agent", "agent", "Agent")
    const nodes = [
      node("start", "start", "Start"),
      {
        ...agent,
        data: {
          ...agent.data,
          branches: [{ id: "stale-branch", label: "If", expression: "${steps.missing}" }],
        },
      },
      node("end", "end", "End"),
    ]
    const edges = [
      { id: "start-agent", source: "start", target: "agent" },
      { id: "agent-end", source: "agent", target: "end" },
    ]

    expect(validate(nodes, edges).map((issue) => issue.message)).not.toContain(
      "Conditional node needs at least one branch expression.",
    )
    expect(validate(nodes, edges).some((issue) => issue.nodeId === "agent" && issue.message.includes("Branch"))).toBe(
      false,
    )
  })

  it("checks branch expressions when an actual if/else node exists", () => {
    const router = node("router", "if-else", "Router")
    const nodes = [
      node("start", "start", "Start"),
      { ...router, data: { ...router.data, branches: [] } },
      node("end", "end", "End"),
    ]
    const edges = [
      { id: "start-router", source: "start", target: "router" },
      { id: "router-end", source: "router", target: "end" },
    ]

    expect(validate(nodes, edges)).toContainEqual(
      expect.objectContaining({
        nodeId: "router",
        message: "Conditional node needs at least one branch expression.",
      }),
    )
  })
})
