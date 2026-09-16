import type { Edge, Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"

export type WorkflowValidationIssue = {
  nodeId: string
  label: string
  message: string
  severity: "warning" | "error"
}

export function getWorkflowStructureIssues(nodes: Node<WorkflowNodeData>[], edges: Edge[]): WorkflowValidationIssue[] {
  const activeNodes = nodes.filter((node) => node.data.enabled !== false)
  const activeIds = new Set(activeNodes.map((node) => node.id))
  const issues: WorkflowValidationIssue[] = []
  const nodeIds = new Set<string>()
  for (const node of nodes) {
    if (!node.id.trim())
      issues.push({
        nodeId: "workflow",
        label: "Workflow",
        message: "Every node needs a non-empty id.",
        severity: "error",
      })
    if (nodeIds.has(node.id))
      issues.push({
        nodeId: node.id,
        label: "Workflow",
        message: `Node id '${node.id}' is duplicated.`,
        severity: "error",
      })
    nodeIds.add(node.id)
  }
  if (nodes.length > 200)
    issues.push({
      nodeId: "workflow",
      label: "Workflow",
      message: "Workflow cannot contain more than 200 nodes.",
      severity: "error",
    })
  if (edges.length > 400)
    issues.push({
      nodeId: "workflow",
      label: "Workflow",
      message: "Workflow cannot contain more than 400 edges.",
      severity: "error",
    })
  const edgeKeys = new Set<string>()
  for (const edge of edges) {
    const key = `${edge.source}:${edge.target}:${edge.sourceHandle ?? ""}`
    if (edgeKeys.has(key))
      issues.push({
        nodeId: edge.source,
        label: "Workflow",
        message: "Workflow contains duplicate edges.",
        severity: "error",
      })
    edgeKeys.add(key)
    if (edge.source === edge.target)
      issues.push({
        nodeId: edge.source,
        label: "Workflow",
        message: "A node cannot connect to itself.",
        severity: "error",
      })
    if (!activeIds.has(edge.source) || !activeIds.has(edge.target)) {
      issues.push({
        nodeId: edge.source,
        label: "Workflow",
        message: "Workflow contains an edge connected to a missing or disabled node.",
        severity: "error",
      })
    }
  }
  if (activeNodes.filter((node) => node.data.kind === "start").length !== 1) {
    issues.push({
      nodeId: nodes[0]?.id ?? "workflow",
      label: "Workflow",
      message: "Workflow must contain exactly one active start node.",
      severity: "error",
    })
  }
  if (!activeNodes.some((node) => node.data.kind === "end")) {
    issues.push({
      nodeId: nodes[0]?.id ?? "workflow",
      label: "Workflow",
      message: "Add at least one end node so the workflow can finish cleanly.",
      severity: "error",
    })
  }
  const inbound = new Map<string, number>()
  const outbound = new Map<string, number>()
  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    if (!activeIds.has(edge.source) || !activeIds.has(edge.target)) continue
    inbound.set(edge.target, (inbound.get(edge.target) ?? 0) + 1)
    outbound.set(edge.source, (outbound.get(edge.source) ?? 0) + 1)
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target])
    const source = activeNodes.find((node) => node.id === edge.source)
    if (source?.data.kind === "if-else" && !source.data.branches?.some((branch) => branch.id === edge.sourceHandle))
      issues.push({
        nodeId: source.id,
        label: source.data.label || source.id,
        message: "If / Else edge uses an unknown branch handle.",
        severity: "error",
      })
  }
  const start = activeNodes.find((node) => node.data.kind === "start")
  if (start) {
    const reachable = new Set<string>([start.id])
    const queue = [start.id]
    while (queue.length) {
      const current = queue.shift()!
      for (const target of adjacency.get(current) ?? [])
        if (!reachable.has(target)) {
          reachable.add(target)
          queue.push(target)
        }
    }
    for (const node of activeNodes) {
      if (node.data.kind !== "start" && !reachable.has(node.id))
        issues.push({
          nodeId: node.id,
          label: node.data.label || node.id,
          message: "Node cannot be reached from the start node.",
          severity: "error",
        })
      if (node.data.kind !== "start" && (inbound.get(node.id) ?? 0) === 0)
        issues.push({
          nodeId: node.id,
          label: node.data.label || node.id,
          message: "Node has no upstream connection.",
          severity: "error",
        })
      if (node.data.kind !== "end" && (outbound.get(node.id) ?? 0) === 0)
        issues.push({
          nodeId: node.id,
          label: node.data.label || node.id,
          message: "Node has no downstream connection.",
          severity: "error",
        })
    }
  }
  return issues
}
