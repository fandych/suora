import type { Dispatch, SetStateAction } from "react"
import type { Edge, Node } from "@xyflow/react"

import type { WorkflowEdgeData, WorkflowNodeData } from "@/data/domain/models"

export function parseDryRunObject(inputValue: string) {
  const parsed = JSON.parse(inputValue) as unknown
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Enter a valid JSON object.")
  }
  return parsed as Record<string, unknown>
}

export function renameWorkflowNodeId(input: {
  selectedNodeId: string | null
  nextNodeId: string
  nodes: Node<WorkflowNodeData>[]
  setNodes: Dispatch<SetStateAction<Node<WorkflowNodeData>[]>>
  setEdges: Dispatch<SetStateAction<Edge[]>>
  setSelectedNodeId: (value: string | null) => void
}) {
  const { selectedNodeId, nextNodeId, nodes, setNodes, setEdges, setSelectedNodeId } = input
  if (!selectedNodeId) {
    return "Select a node first."
  }

  const normalized = nextNodeId.trim()
  if (!normalized) {
    return "Node ID is required."
  }
  if (!/^[a-zA-Z0-9-_]+$/.test(normalized)) {
    return "Use letters, numbers, hyphens, or underscores only."
  }
  if (normalized === selectedNodeId) {
    return null
  }
  if (nodes.some((node) => node.id === normalized)) {
    return "Node ID already exists."
  }

  setNodes((current) => current.map((node) => node.id === selectedNodeId ? { ...node, id: normalized } : node))
  setEdges((current) => current.map((edge) => ({
    ...edge,
    source: edge.source === selectedNodeId ? normalized : edge.source,
    target: edge.target === selectedNodeId ? normalized : edge.target,
  })))
  setSelectedNodeId(normalized)
  return null
}

export function hasOutgoingWorkflowConnection(edges: Edge[], nodeId: string, sourceHandle: string | null) {
  return edges.some((edge) => edge.source === nodeId && (sourceHandle === null ? !edge.sourceHandle : edge.sourceHandle === sourceHandle))
}

export function buildConnectedWorkflowNode(input: {
  nodes: Node<WorkflowNodeData>[]
  sourceNodeId: string
  sourceHandle: string | null
  kind: WorkflowNodeData["kind"]
  createNodeData: (kind: WorkflowNodeData["kind"], index: number) => WorkflowNodeData
}) {
  const { nodes, sourceNodeId, sourceHandle, kind, createNodeData } = input
  const sourceNode = nodes.find((node) => node.id === sourceNodeId)
  if (!sourceNode) {
    return null
  }

  const nextIndex = nodes.length + 1
  const nextId = `${kind}-${nextIndex}`
  const branchIndex = sourceNode.data.branches?.findIndex((branch) => branch.id === sourceHandle) ?? -1
  const branchCount = sourceNode.data.branches?.length ?? 0
  const branch = sourceNode.data.kind === "if-else" ? sourceNode.data.branches?.find((item) => item.id === sourceHandle) : undefined

  return {
    nextId,
    nextNode: {
      id: nextId,
      type: "workflowNode",
      position: sourceHandle
        ? { x: sourceNode.position.x + (branchIndex - (branchCount - 1) / 2) * 220, y: sourceNode.position.y + 180 }
        : { x: sourceNode.position.x + 260, y: sourceNode.position.y },
      data: createNodeData(kind, nextIndex),
    } satisfies Node<WorkflowNodeData>,
    nextEdge: {
      source: sourceNodeId,
      sourceHandle,
      target: nextId,
      type: "workflow",
      label: branch?.label,
      data: {
        condition: branch?.expression ?? "",
        successOnly: false,
      } satisfies WorkflowEdgeData,
    },
  }
}