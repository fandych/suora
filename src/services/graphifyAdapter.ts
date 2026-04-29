import type { DocumentGraph, DocumentGraphEdge, DocumentGraphNode } from './documentGraph'

export interface GraphifyExportNode {
  id: string
  label: string
  type: string
  weight: number
  attributes: DocumentGraphNode['metadata'] & {
    groupId: string
    documentId?: string
    folderId?: string
  }
}

export interface GraphifyExportEdge {
  id: string
  source: string
  target: string
  type: string
  label?: string
  weight: number
  attributes: DocumentGraphEdge['metadata']
}

export interface GraphifyExport {
  schema: 'suora-document-graph'
  graphifyCompatible: true
  generatedAt: string
  nodes: GraphifyExportNode[]
  edges: GraphifyExportEdge[]
  metadata: {
    source: 'suora-documents'
    note: string
    tags: string[]
    orphanDocumentIds: string[]
  }
}

export function toGraphifyExport(graph: DocumentGraph, generatedAt = new Date().toISOString()): GraphifyExport {
  return {
    schema: 'suora-document-graph',
    graphifyCompatible: true,
    generatedAt,
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      weight: node.weight,
      attributes: {
        ...node.metadata,
        groupId: node.groupId,
        documentId: node.documentId,
        folderId: node.folderId,
      },
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      label: edge.label,
      weight: edge.weight,
      attributes: edge.metadata,
    })),
    metadata: {
      source: 'suora-documents',
      note: 'Graphify is distributed as the Python CLI package graphifyy, so Suora keeps this export adapter decoupled from renderer state and dependencies.',
      tags: graph.tags,
      orphanDocumentIds: graph.orphanDocumentIds,
    },
  }
}
