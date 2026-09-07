import type { Edge, Node } from "@xyflow/react"

import type { WorkflowDefinition, WorkflowNodeData } from "@/data/domain/models"
import { getExpressionIssues } from "@/views/workflows/components/workflow-expression-suggestions"

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

  // Detect cyclic dependency loops among non-loop nodes
  const cyclicNodes = new Set<string>()
  const visitState = new Map<string, "unvisited" | "visiting" | "visited">()

  function dfsCheckCycle(nodeId: string) {
    visitState.set(nodeId, "visiting")
    const neighbors = adjacency.get(nodeId) ?? []
    for (const nextId of neighbors) {
      const neighborNode = activeNodes.find((n) => n.id === nextId)
      if (neighborNode?.data.kind === "loop") continue

      const state = visitState.get(nextId) ?? "unvisited"
      if (state === "visiting") {
        cyclicNodes.add(nodeId)
        cyclicNodes.add(nextId)
      } else if (state === "unvisited") {
        dfsCheckCycle(nextId)
      }
    }
    visitState.set(nodeId, "visited")
  }

  for (const node of activeNodes) {
    if (node.data.kind !== "loop" && (visitState.get(node.id) ?? "unvisited") === "unvisited") {
      dfsCheckCycle(node.id)
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
    if (cyclicNodes.has(node.id)) {
      nodeIssues.push({ nodeId: node.id, label, message: "Node is part of an invalid cyclic loop graph.", severity: "error" })
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
    if (node.data.kind === "variable-assigner" && !node.data.variableName?.trim()) {
      nodeIssues.push({ nodeId: node.id, label, message: "Variable assignment needs a variable name.", severity: "error" })
    }
    if (node.data.kind === "template" && !node.data.template?.trim()) {
      nodeIssues.push({ nodeId: node.id, label, message: "Template node needs a template body.", severity: "error" })
    }
    if (node.data.kind === "smtp" && !node.data.emailTo?.trim()) {
      nodeIssues.push({ nodeId: node.id, label, message: "Email node needs a recipient.", severity: "error" })
    }
    if (node.data.kind === "loop" && !(node.data.loopExpression?.trim())) {
      nodeIssues.push({ nodeId: node.id, label, message: "Loop node needs a collection expression.", severity: "error" })
    }
    if (node.data.kind === "condition" && !node.data.runIf?.trim()) {
      nodeIssues.push({ nodeId: node.id, label, message: "Condition node needs an expression.", severity: "error" })
    }
    if (node.data.kind === "if-else" && !(node.data.runIf?.trim() || node.data.branches?.some((branch) => branch.expression.trim()))) {
      nodeIssues.push({ nodeId: node.id, label, message: "Conditional node needs at least one branch expression.", severity: "error" })
    }
    for (const [value, fieldLabel] of [[node.data.headersJson, "Headers"], [node.data.queryJson, "Query parameters"], [node.data.bodyJson, "Body"], [node.data.inputSchemaJson, "Input schema"], [node.data.outputSchemaJson, "Output schema"]] as Array<[string | undefined, string]>) {
      if (value?.trim() && getWorkflowJsonIssue(value, fieldLabel)) {
        nodeIssues.push({ nodeId: node.id, label, message: `${fieldLabel} must be valid JSON.`, severity: "error" })
      }
    }

    const expressionFields: Array<[string | undefined, string, boolean]> = [
      [node.data.prompt, "Prompt", false], [node.data.systemPrompt, "System instructions", false], [node.data.url, "URL", false],
      [node.data.headersJson, "Headers", false], [node.data.queryJson, "Query parameters", false], [node.data.bodyJson, "Body", false],
      [node.data.queryExpression, "Search question", false], [node.data.variableValue, "Variable value", false], [node.data.template, "Template body", false],
      [node.data.inputTemplate, "Result template", false], [node.data.runIf, "Condition expression", false], [node.data.loopExpression, "Collection expression", false],
      [node.data.emailTo, "Email recipient", false], [node.data.emailSubject, "Email subject", false], [node.data.emailBody, "Email message", false],
    ]
    for (const branch of node.data.branches ?? []) expressionFields.push([branch.expression, `Branch "${branch.label}" expression`, false])
    try {
      const outputSchema = JSON.parse(node.data.outputSchemaJson || "{}") as { properties?: Record<string, { default?: unknown }> }
      for (const [name, property] of Object.entries(outputSchema.properties ?? {})) expressionFields.push([typeof property.default === "string" ? property.default : undefined, `Output "${name}" value`, true])
    } catch { /* JSON validation above reports malformed output schemas. */ }
    for (const [value, fieldLabel, allowCurrent] of expressionFields) {
      for (const message of getExpressionIssues(activeNodes, validEdges, node.id, value, fieldLabel, allowCurrent)) nodeIssues.push({ nodeId: node.id, label, message, severity: "error" })
    }

    return nodeIssues
  }).concat(issues)
}

export function getWorkflowDryRunInputIssue(dryRunInput: string) {
  try {
    const parsed = JSON.parse(dryRunInput) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        nodeId: "workflow",
        label: "Dry run input",
        message: "Dry run payload must be a JSON object.",
        severity: "error",
      } satisfies WorkflowDesignIssue
    }
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

export function getWorkflowJsonIssue(value: string, label: string) {
  try {
    JSON.parse(value)
    return null
  } catch {
    return `${label} must be valid JSON.`
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

  const levels = new Map<number, string[]>()
  for (const nodeId of order) {
    const depth = depthMap.get(nodeId) ?? 0
    levels.set(depth, [...(levels.get(depth) ?? []), nodeId])
  }

  const horizontalGap = 80
  const verticalGap = 100
  const levelHeights = new Map<number, number>()
  for (const node of nodes) {
    const depth = depthMap.get(node.id) ?? 0
    const height = node.measured?.height ?? node.height ?? 132
    levelHeights.set(depth, Math.max(levelHeights.get(depth) ?? 0, height))
  }
  const levelOffsets = new Map<number, number>()
  let nextY = 80
  const orderedDepths = [...levels.keys()].sort((left, right) => left - right)
  for (const depth of orderedDepths) {
    levelOffsets.set(depth, nextY)
    nextY += (levelHeights.get(depth) ?? 132) + verticalGap
  }

  const positions = new Map<string, { x: number; y: number }>()
  for (const depth of orderedDepths) {
    let nextX = 120
    const levelHeight = levelHeights.get(depth) ?? 132
    for (const nodeId of levels.get(depth) ?? []) {
      const node = nodeById.get(nodeId)
      if (!node) continue
      const width = node.measured?.width ?? node.width ?? 256
      const height = node.measured?.height ?? node.height ?? 132
      positions.set(nodeId, { x: nextX, y: (levelOffsets.get(depth) ?? 80) + (levelHeight - height) / 2 })
      nextX += width + horizontalGap
    }
  }

  for (const depth of [...orderedDepths].reverse()) {
    for (const nodeId of levels.get(depth) ?? []) {
      const children = (adjacency.get(nodeId) ?? []).map((childId) => ({ node: nodeById.get(childId), position: positions.get(childId) })).filter((item): item is { node: Node<WorkflowNodeData>; position: { x: number; y: number } } => Boolean(item.node && item.position))
      const position = positions.get(nodeId)
      if (!position || children.length === 0) continue
      const left = Math.min(...children.map((item) => item.position.x))
      const right = Math.max(...children.map((item) => item.position.x + (item.node.measured?.width ?? item.node.width ?? 256)))
      const width = nodeById.get(nodeId)?.measured?.width ?? nodeById.get(nodeId)?.width ?? 256
      position.x = Math.max(120, left + (right - left - width) / 2)
    }

    let minimumX = 120
    for (const nodeId of [...(levels.get(depth) ?? [])].sort((left, right) => (positions.get(left)?.x ?? 0) - (positions.get(right)?.x ?? 0))) {
      const position = positions.get(nodeId)
      const node = nodeById.get(nodeId)
      if (!position || !node) continue
      position.x = Math.max(position.x, minimumX)
      minimumX = position.x + (node.measured?.width ?? node.width ?? 256) + horizontalGap
    }
  }

  return nodes.map((node) => {
    const depth = depthMap.get(node.id) ?? 0

    return {
      ...node,
      position: positions.get(node.id) ?? { x: 120, y: levelOffsets.get(depth) ?? 80 },
    }
  })
}