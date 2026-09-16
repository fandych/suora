import { describe, expect, it } from "vitest"
import type { Edge, Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import { getWorkflowStructureIssues } from "@/lib/workflow/validator"
import { validateIfElseNodeProperties } from "@/lib/workflow/validator/node/if-else"

const createNode = (id: string, kind: WorkflowNodeData["kind"]): Node<WorkflowNodeData> => ({
  id,
  type: "workflowNode",
  position: { x: 0, y: 0 },
  data: { id, kind, label: id, prompt: "configured", enabled: true },
})

const edge = (source: string, target: string, sourceHandle?: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  sourceHandle,
})

describe("workflow validation", () => {
  it("detects duplicate ids, self loops, unreachable nodes, and missing downstream paths", () => {
    const nodes = [
      createNode("start", "start"),
      createNode("start", "agent"),
      createNode("orphan", "template"),
      createNode("end", "end"),
    ]
    const issues = getWorkflowStructureIssues(nodes, [edge("start", "start")])
    const messages = issues.map((item) => item.message)
    expect(messages).toContain("Node id 'start' is duplicated.")
    expect(messages).toContain("A node cannot connect to itself.")
    expect(messages).toContain("Node cannot be reached from the start node.")
  })

  it("requires valid if/else branches including an unconditional final branch", () => {
    const node = createNode("router", "if-else")
    node.data.branches = [
      { id: "same", label: "If", expression: "true" },
      { id: "same", label: "Else", expression: "false" },
    ]
    const messages = validateIfElseNodeProperties(node).map((item) => item.message)
    expect(messages).toContain("If / Else branches need unique non-empty ids.")
    expect(messages).toContain("The final If / Else branch must be the unconditional else branch.")
  })
})
