import type { Edge, Node } from "@xyflow/react"

import type { WorkflowDefinition, WorkflowNodeData } from "@/data/domain/models"

export const DEFAULT_WORKFLOW_DRY_RUN_INPUT = "{\n  \"leadId\": \"LD-1001\"\n}"

export type WorkflowDesignIssue = {
  nodeId: string
  label: string
  message: string
  severity: "warning" | "error"
}

export function buildWorkflowFingerprint(input: {
  title: string
  summary: string
  definition: WorkflowDefinition
}) {
  return JSON.stringify(input)
}

export function getWorkflowDesignIssues(input: {
  nodes: Node<WorkflowNodeData>[]
  edges: Edge[]
  availableAgentIds: string[]
  availableDocumentIds: string[]
  availableIntegrationIds: string[]
  availableModelIds: string[]
}) {
  const { nodes, edges, availableAgentIds, availableDocumentIds, availableIntegrationIds, availableModelIds } = input
  const issues: WorkflowDesignIssue[] = []
  const activeNodes = nodes.filter((node) => node.data.enabled !== false)
  const activeNodeIds = new Set(activeNodes.map((node) => node.id))
  const validEdges = edges.filter((edge) => activeNodeIds.has(edge.source) && activeNodeIds.has(edge.target))
  const inboundCount = new Map<string, number>()
  const outboundCount = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const edge of validEdges) {
    inboundCount.set(edge.target, (inboundCount.get(edge.target) ?? 0) + 1)
    outboundCount.set(edge.source, (outboundCount.get(edge.source) ?? 0) + 1)
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target])
  }

  const startNodes = activeNodes.filter((node) => node.data.kind === "start")
  const endNodes = activeNodes.filter((node) => node.data.kind === "end")

  if (startNodes.length === 0) {
    issues.push({ nodeId: nodes[0]?.id ?? "workflow", label: "Workflow", message: "Add exactly one start node before publishing or running the workflow.", severity: "error" })
  }
  if (startNodes.length > 1) {
    issues.push({ nodeId: startNodes[1]?.id ?? startNodes[0]?.id ?? "workflow", label: "Workflow", message: "Keep only one active start node in the workflow graph.", severity: "error" })
  }
  if (endNodes.length === 0) {
    issues.push({ nodeId: nodes[0]?.id ?? "workflow", label: "Workflow", message: "Add at least one end node so the workflow can finish cleanly.", severity: "error" })
  }

  const reachable = new Set<string>()
  const queue = [...startNodes.map((node) => node.id)]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || reachable.has(current)) {
      continue
    }

    reachable.add(current)
    for (const nextId of adjacency.get(current) ?? []) {
      if (!reachable.has(nextId)) {
        queue.push(nextId)
      }
    }
  }

  return activeNodes.flatMap((node) => {
    const nodeIssues: WorkflowDesignIssue[] = []
    const label = node.data.label.trim() || node.id

    if (!node.data.label.trim()) {
      nodeIssues.push({ nodeId: node.id, label, message: "Node label is empty.", severity: "error" })
    }
    if (node.data.kind !== "start" && (inboundCount.get(node.id) ?? 0) === 0) {
      nodeIssues.push({ nodeId: node.id, label, message: "Node is disconnected from the upstream workflow path.", severity: "error" })
    }
    if (node.data.kind !== "end" && (outboundCount.get(node.id) ?? 0) === 0) {
      nodeIssues.push({ nodeId: node.id, label, message: "Node has no downstream path or terminal step.", severity: "error" })
    }
    if (startNodes.length > 0 && !reachable.has(node.id)) {
      nodeIssues.push({ nodeId: node.id, label, message: "Node cannot be reached from the start node.", severity: "error" })
    }
    if (node.data.kind === "agent" && !node.data.prompt.trim()) {
      nodeIssues.push({ nodeId: node.id, label, message: "Agent node is missing a prompt.", severity: "error" })
    }
    if (node.data.kind === "agent" && node.data.agentId?.trim() && !availableAgentIds.includes(node.data.agentId)) {
      nodeIssues.push({ nodeId: node.id, label, message: "Agent binding no longer exists in the workspace.", severity: "error" })
    }
    if (node.data.kind === "agent" && node.data.modelId?.trim() && !availableModelIds.includes(node.data.modelId)) {
      nodeIssues.push({ nodeId: node.id, label, message: "Model override no longer exists in the configured provider catalog.", severity: "error" })
    }
    if (node.data.kind === "http" && !node.data.integrationId?.trim() && !node.data.url?.trim()) {
      nodeIssues.push({ nodeId: node.id, label, message: "HTTP node needs a bound integration or URL.", severity: "error" })
    }
    if (node.data.kind === "http" && node.data.integrationId?.trim() && !availableIntegrationIds.includes(node.data.integrationId)) {
      nodeIssues.push({ nodeId: node.id, label, message: "Bound integration no longer exists in the workspace.", severity: "error" })
    }
    if (node.data.kind === "document-retrieval" && !node.data.documentId?.trim()) {
      nodeIssues.push({ nodeId: node.id, label, message: "Document retrieval node has no source document.", severity: "error" })
    }
    if (node.data.kind === "document-retrieval" && node.data.documentId?.trim() && !availableDocumentIds.includes(node.data.documentId)) {
      nodeIssues.push({ nodeId: node.id, label, message: "Bound document no longer exists in the workspace.", severity: "error" })
    }
    if (node.data.kind === "script" && !node.data.script?.trim()) {
      nodeIssues.push({ nodeId: node.id, label, message: "Script node has no script body.", severity: "error" })
    }
    if (node.data.kind === "if-else" && !(node.data.runIf?.trim() || node.data.branches?.some((branch) => branch.expression.trim()))) {
      nodeIssues.push({ nodeId: node.id, label, message: "Conditional node needs at least one branch expression.", severity: "error" })
    }

    return nodeIssues
  }).concat(issues)
}

export function getWorkflowDryRunInputIssue(dryRunInput: string) {
  try {
    JSON.parse(dryRunInput)
    return null
  } catch {
    return {
      nodeId: "workflow",
      label: "Dry run input",
      message: "Dry run payload must be valid JSON.",
      severity: "error",
    } satisfies WorkflowDesignIssue
  }
}

export function getAutoLayoutedWorkflowNodes(input: {
  nodes: Node<WorkflowNodeData>[]
  edges: Edge[]
}) {
  const { nodes, edges } = input
  if (nodes.length <= 1) {
    return nodes
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const inboundCount = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
      continue
    }

    inboundCount.set(edge.target, (inboundCount.get(edge.target) ?? 0) + 1)
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target])
  }

  const rootIds = nodes
    .filter((node) => node.data.kind === "start" || (inboundCount.get(node.id) ?? 0) === 0)
    .map((node) => node.id)
  const queue = rootIds.length > 0 ? [...rootIds] : [nodes[0].id]
  const depthMap = new Map<string, number>()
  const order: string[] = []

  while (queue.length > 0) {
    const currentId = queue.shift()
    if (!currentId || order.includes(currentId)) {
      continue
    }

    order.push(currentId)
    const currentDepth = depthMap.get(currentId) ?? 0
    for (const nextId of adjacency.get(currentId) ?? []) {
      if (!depthMap.has(nextId) || (depthMap.get(nextId) ?? 0) < currentDepth + 1) {
        depthMap.set(nextId, currentDepth + 1)
      }
      if (!order.includes(nextId)) {
        queue.push(nextId)
      }
    }
  }

  for (const node of nodes) {
    if (!order.includes(node.id)) {
      order.push(node.id)
    }
  }

  const columns = new Map<number, string[]>()
  for (const nodeId of order) {
    const depth = depthMap.get(nodeId) ?? 0
    columns.set(depth, [...(columns.get(depth) ?? []), nodeId])
  }

  const horizontalGap = 260
  const verticalGap = 140
  return nodes.map((node) => {
    const depth = depthMap.get(node.id) ?? 0
    const column = columns.get(depth) ?? [node.id]
    const rowIndex = Math.max(column.indexOf(node.id), 0)

    return {
      ...node,
      position: {
        x: 80 + depth * horizontalGap,
        y: 80 + rowIndex * verticalGap,
      },
    }
  })
}