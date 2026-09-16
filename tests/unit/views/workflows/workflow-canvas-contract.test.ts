import { describe, expect, it } from "vitest"
import type { Edge, Node } from "@xyflow/react"

import { buildConnectedWorkflowNode, isValidWorkflowConnection } from "@/lib/workflow/panel-helpers"
import type { WorkflowEdgeData, WorkflowNodeData } from "@/types/workflow"

const createNode = (
  id: string,
  kind: WorkflowNodeData["kind"],
  branches?: WorkflowNodeData["branches"],
): Node<WorkflowNodeData> => ({
  id,
  type: "workflowNode",
  position: { x: 0, y: 0 },
  data: { label: id, kind, prompt: "Configured", branches },
})

describe("workflow canvas connection contract", () => {
  const branches = [
    { id: "if", label: "If", expression: "$input.approved" },
    { id: "else", label: "Else", expression: "" },
  ]

  it("allows an if/else edge only through a defined branch handle", () => {
    const nodes = [createNode("router", "if-else", branches), createNode("end", "end")]
    const edges: Edge<WorkflowEdgeData>[] = []

    expect(
      isValidWorkflowConnection(
        { source: "router", sourceHandle: "if", target: "end", targetHandle: "target-top" },
        nodes,
        edges,
      ),
    ).toBe(true)
    expect(
      isValidWorkflowConnection(
        { source: "router", sourceHandle: "deleted-branch", target: "end", targetHandle: "target-top" },
        nodes,
        edges,
      ),
    ).toBe(false)
  })

  it("creates a branch edge with the selected branch metadata", () => {
    const nodes = [createNode("router", "if-else", branches)]
    const result = buildConnectedWorkflowNode({
      nodes,
      sourceNodeId: "router",
      sourceHandle: "if",
      kind: "agent",
      createNodeData: (kind) => ({ label: "Agent", kind, prompt: "Configured" }),
    })

    expect(result).toEqual(
      expect.objectContaining({
        nextEdge: expect.objectContaining({
          source: "router",
          sourceHandle: "if",
          target: result?.nextId,
          targetHandle: "target-top",
          label: "If",
          data: { condition: "$input.approved", successOnly: false },
        }),
      }),
    )
  })

  it("refuses self-connections and connections to start nodes", () => {
    const nodes = [createNode("agent", "agent"), createNode("start", "start")]
    const edges: Edge<WorkflowEdgeData>[] = []

    expect(isValidWorkflowConnection({ source: "agent", sourceHandle: null, target: "agent", targetHandle: null }, nodes, edges)).toBe(false)
    expect(isValidWorkflowConnection({ source: "agent", sourceHandle: null, target: "start", targetHandle: null }, nodes, edges)).toBe(false)
  })

  it("only permits normal workflow connections from bottom outputs to top inputs", () => {
    const nodes = [createNode("source", "agent"), createNode("target", "agent")]
    const edges: Edge<WorkflowEdgeData>[] = []

    expect(
      isValidWorkflowConnection(
        { source: "source", sourceHandle: "source-right", target: "target", targetHandle: "target-top" },
        nodes,
        edges,
      ),
    ).toBe(false)
    expect(
      isValidWorkflowConnection(
        { source: "source", sourceHandle: null, target: "target", targetHandle: "target-right" },
        nodes,
        edges,
      ),
    ).toBe(false)
    expect(
      isValidWorkflowConnection(
        { source: "source", sourceHandle: null, target: "target", targetHandle: "target-top" },
        nodes,
        edges,
      ),
    ).toBe(true)
  })

  it("refuses duplicate paths and connections from terminal nodes", () => {
    const nodes = [createNode("start", "start"), createNode("end", "end")]
    const existingEdges: Edge<WorkflowEdgeData>[] = [{ id: "start-end", source: "start", target: "end" }]

    expect(
      isValidWorkflowConnection({ source: "start", sourceHandle: null, target: "end", targetHandle: null }, nodes, existingEdges),
    ).toBe(false)
    expect(
      isValidWorkflowConnection({ source: "end", sourceHandle: null, target: "start", targetHandle: null }, nodes, []),
    ).toBe(false)
  })
})
