import type { DocumentGraphEdge, DocumentPageRecord } from "@/data/domain/models"
import { getDocumentDetail, saveDocumentDraft } from "@/data/repositories/document-repository"

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .split(/[^a-z0-9\u4e00-\u9fa5]+/)
    .filter((token) => token.length >= 2)
}

export function inferKnowledgeGraphEdges(pages: DocumentPageRecord[]): DocumentGraphEdge[] {
  const documentPages = pages.filter((page) => (page.type ?? "document") === "document")
  const edges: DocumentGraphEdge[] = []

  for (let index = 0; index < documentPages.length; index += 1) {
    for (let cursor = index + 1; cursor < documentPages.length; cursor += 1) {
      const left = documentPages[index]
      const right = documentPages[cursor]
      const leftTokens = new Set(tokenize(left.content))
      const rightTokens = new Set(tokenize(right.content))
      const overlap = [...leftTokens].filter((token) => rightTokens.has(token))

      if (overlap.length === 0) {
        continue
      }

      edges.push({
        id: `${left.id}-${right.id}`,
        source: left.title,
        target: right.title,
        label: overlap.slice(0, 3).join(", "),
        status: "pending",
        confidence: Math.min(0.95, 0.45 + overlap.length * 0.1),
      })
    }
  }

  return edges
}

export async function rebuildDocumentKnowledgeGraph(documentId: string, selectedVersionId?: string) {
  const detail = await getDocumentDetail(documentId, selectedVersionId)
  const graphEdges = inferKnowledgeGraphEdges(detail.pages)

  return saveDocumentDraft(documentId, {
    title: detail.document.title,
    summary: detail.document.summary,
    pages: detail.pages,
    graphEdges,
    settings: detail.settings,
  })
}

export async function reviewDocumentKnowledgeGraphEdge(documentId: string, edgeId: string, status: DocumentGraphEdge["status"], selectedVersionId?: string) {
  const detail = await getDocumentDetail(documentId, selectedVersionId)

  return saveDocumentDraft(documentId, {
    title: detail.document.title,
    summary: detail.document.summary,
    pages: detail.pages,
    graphEdges: detail.graphEdges.map((edge) => edge.id === edgeId ? { ...edge, status } : edge),
    settings: detail.settings,
  })
}

export function queryDocumentKnowledgeGraphPath(edges: DocumentGraphEdge[], start: string, target: string) {
  if (!start || !target) {
    return []
  }

  const graph = new Map<string, string[]>()
  for (const edge of edges) {
    const neighbors = graph.get(edge.source) ?? []
    neighbors.push(edge.target)
    graph.set(edge.source, neighbors)
  }

  const queue: Array<{ node: string; path: string[] }> = [{ node: start, path: [start] }]
  const visited = new Set<string>([start])

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) {
      continue
    }

    if (current.node === target) {
      return current.path
    }

    for (const neighbor of graph.get(current.node) ?? []) {
      if (visited.has(neighbor)) {
        continue
      }
      visited.add(neighbor)
      queue.push({ node: neighbor, path: [...current.path, neighbor] })
    }
  }

  return []
}