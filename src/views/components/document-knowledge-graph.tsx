import { useMemo } from "react"
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import type { DocumentGraphEdge, DocumentPageRecord } from "@/data/domain/models"

type DocumentKnowledgeGraphProps = {
  pages: DocumentPageRecord[]
  edges: DocumentGraphEdge[]
  filter: string
}

const DocumentKnowledgeGraph = ({ pages, edges, filter }: DocumentKnowledgeGraphProps) => {
  const graph = useMemo(() => {
    const normalized = filter.trim().toLowerCase()
    const baseNodes: Node[] = pages.map((page, index) => ({
      id: page.title,
      position: { x: 120 + (index % 3) * 220, y: 100 + Math.floor(index / 3) * 180 },
      data: { label: page.title },
      style: normalized && !page.title.toLowerCase().includes(normalized)
        ? { opacity: 0.45 }
        : undefined,
    }))

    const baseEdges: Edge[] = edges
      .filter((edge) => {
        if (!normalized) {
          return true
        }

        return `${edge.source} ${edge.target} ${edge.label}`.toLowerCase().includes(normalized)
      })
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        animated: true,
      }))

    return { nodes: baseNodes, edges: baseEdges }
  }, [edges, filter, pages])

  return (
    <div className="h-96 overflow-hidden rounded-xl border border-border bg-muted/10">
      <ReactFlow nodes={graph.nodes} edges={graph.edges} fitView>
        <Background />
        <MiniMap />
        <Controls />
      </ReactFlow>
    </div>
  )
}

export default DocumentKnowledgeGraph