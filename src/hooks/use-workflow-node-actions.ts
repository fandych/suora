import { useCallback } from "react"
import type { Dispatch, SetStateAction } from "react"
import {
  addEdge,
  MarkerType,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnSelectionChangeParams,
} from "@xyflow/react"
import type { WorkflowEdgeData, WorkflowNodeData } from "@/types/workflow"
import { createWorkflowNodeData } from "@/lib/workflow/editor-config"
import {
  buildConnectedWorkflowNode,
  hasOutgoingWorkflowConnection,
  isValidWorkflowConnection,
  renameWorkflowNodeId,
} from "@/lib/workflow/panel-helpers"

export function useWorkflowNodeActions(input: {
  nodes: Node<WorkflowNodeData>[]
  edges: Edge<WorkflowEdgeData>[]
  selectedNodeId: string | null
  isReadOnly: boolean
  setNodes: Dispatch<SetStateAction<Node<WorkflowNodeData>[]>>
  setEdges: Dispatch<SetStateAction<Edge<WorkflowEdgeData>[]>>
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>
  setInspectorMode: (mode: "closed" | "properties") => void
  deleteElements?: (payload: { nodes?: Array<{ id: string }>; edges?: Array<{ id: string }> }) => Promise<unknown>
}) {
  const handleConnect = useCallback((connection: Connection) => {
    if (input.isReadOnly || !isValidWorkflowConnection(connection, input.nodes, input.edges)) return
    const sourceNode = input.nodes.find((node) => node.id === connection.source)
    const branch =
      sourceNode?.data.kind === "if-else"
        ? sourceNode.data.branches?.find((item) => item.id === connection.sourceHandle)
        : undefined
    input.setEdges((current) =>
      addEdge(
        {
          id: crypto.randomUUID(),
          ...connection,
          type: "workflow",
          markerEnd: { type: MarkerType.ArrowClosed },
          label: branch?.label,
          data: { condition: branch?.expression ?? "", successOnly: false },
        },
        current,
      ),
    )
  }, [input])
  const isValidConnection = useCallback(
    (connection: Connection) => !input.isReadOnly && isValidWorkflowConnection(connection, input.nodes, input.edges),
    [input.edges, input.isReadOnly, input.nodes],
  )
  const handleNodeClick: NodeMouseHandler<Node<WorkflowNodeData>> = (_event, node) => {
    input.setSelectedNodeId(node.id)
    input.setInspectorMode("properties")
  }
  const handleSelectionChange = ({ nodes }: OnSelectionChangeParams) => {
    const node = nodes[0] as Node<WorkflowNodeData> | undefined
    if (node) input.setSelectedNodeId(node.id)
  }
  const handleNodesDelete = (deletedNodes: Node[]) => {
    const ids = new Set(deletedNodes.map((node) => node.id))
    input.setEdges((current) => current.filter((edge) => !ids.has(edge.source) && !ids.has(edge.target)))
    if (input.selectedNodeId && ids.has(input.selectedNodeId)) {
      input.setSelectedNodeId(null)
      input.setInspectorMode("closed")
    }
  }
  const handleAddNode = () => {
    if (input.isReadOnly) return
    const index = input.nodes.length + 1
    let id = `node-${index}`
    let suffix = index
    while (input.nodes.some((node) => node.id === id)) id = `node-${++suffix}`
    input.setNodes((current) => [
      ...current,
      {
        id,
        type: "workflowNode",
        position: { x: 220 + current.length * 120, y: 260 },
        data: createWorkflowNodeData("agent", index),
      },
    ])
    input.setSelectedNodeId(id)
    input.setInspectorMode("properties")
  }
  const handleAddPresetNode = (kind: WorkflowNodeData["kind"]) => {
    if (input.isReadOnly) return
    const index = input.nodes.length + 1
    let id = `${kind}-${index}`
    let suffix = index
    while (input.nodes.some((node) => node.id === id)) id = `${kind}-${++suffix}`
    input.setNodes((current) => [
      ...current,
      {
        id,
        type: "workflowNode",
        position: { x: 120 + current.length * 120, y: 120 + (current.length % 3) * 90 },
        data: createWorkflowNodeData(kind, index),
      },
    ])
    input.setSelectedNodeId(id)
    input.setInspectorMode("properties")
  }
  const handleAddNodeFromHandle = (sourceNodeId: string, sourceHandle: string | null, kind: string) => {
    if (input.isReadOnly) return
    const insert = buildConnectedWorkflowNode({
      nodes: input.nodes,
      sourceNodeId,
      sourceHandle,
      kind: kind as WorkflowNodeData["kind"],
      createNodeData: createWorkflowNodeData,
    })
    if (!insert) return
    input.setNodes((current) => [...current, insert.nextNode])
    input.setEdges((current) => addEdge({ id: `${insert.nextId}-edge`, ...insert.nextEdge }, current))
    input.setSelectedNodeId(insert.nextId)
    input.setInspectorMode("properties")
  }
  const handleSelectedNodeChange = (patch: Partial<WorkflowNodeData>) => {
    if (!input.selectedNodeId || input.isReadOnly) return
    input.setNodes((current) =>
      current.map((node) => (node.id === input.selectedNodeId ? { ...node, data: { ...node.data, ...patch } } : node)),
    )
  }
  const handleRenameSelectedNodeId = (nextNodeId: string) =>
    renameWorkflowNodeId({
      selectedNodeId: input.selectedNodeId,
      nextNodeId,
      nodes: input.nodes,
      setNodes: input.setNodes,
      setEdges: input.setEdges,
      setSelectedNodeId: input.setSelectedNodeId,
    })
  const handleDuplicateNode = (selectedNode: Node<WorkflowNodeData> | null) => {
    if (!selectedNode || input.isReadOnly) return
    let id = `${selectedNode.id}-copy-${input.nodes.length + 1}`
    let suffix = input.nodes.length + 1
    while (input.nodes.some((node) => node.id === id)) id = `${selectedNode.id}-copy-${++suffix}`
    input.setNodes((current) => [
      ...current,
      { ...selectedNode, id, position: { x: selectedNode.position.x + 48, y: selectedNode.position.y + 48 } },
    ])
    input.setSelectedNodeId(id)
    input.setInspectorMode("properties")
  }
  const handleDeleteNode = () => {
    if (!input.selectedNodeId || input.isReadOnly) return
    const nodeId = input.selectedNodeId
    if (input.deleteElements) {
      void input.deleteElements({ nodes: [{ id: nodeId }] })
    } else {
      input.setNodes((current) => current.filter((node) => node.id !== nodeId))
      input.setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    }
    input.setSelectedNodeId(null)
    input.setInspectorMode("closed")
  }
  return {
    handleConnect,
    isValidConnection,
    handleNodeClick,
    handleSelectionChange,
    handleNodesDelete,
    handleAddNode,
    handleAddPresetNode,
    handleAddNodeFromHandle,
    handleSelectedNodeChange,
    handleRenameSelectedNodeId,
    handleDuplicateNode,
    handleDeleteNode,
    hasOutgoingConnection: (nodeId: string, sourceHandle: string | null) =>
      hasOutgoingWorkflowConnection(input.edges, nodeId, sourceHandle),
  }
}
