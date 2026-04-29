import type { DocumentGroup, DocumentItem, DocumentNode } from '@/types'

export type DocumentGraphNodeType = 'group' | 'folder' | 'document' | 'tag' | 'external-link'
export type DocumentGraphEdgeType = 'contains' | 'references' | 'tagged' | 'external-link'

export interface DocumentGraphNode {
  id: string
  type: DocumentGraphNodeType
  label: string
  groupId: string
  documentId?: string
  folderId?: string
  weight: number
  metadata: {
    path?: string
    excerpt?: string
    url?: string
    unresolved?: boolean
    orphan?: boolean
  }
}

export interface DocumentGraphEdge {
  id: string
  source: string
  target: string
  type: DocumentGraphEdgeType
  label?: string
  weight: number
  metadata: {
    documentId?: string
    reference?: string
    url?: string
  }
}

export interface DocumentGraph {
  nodes: DocumentGraphNode[]
  edges: DocumentGraphEdge[]
  backlinksByDocumentId: Record<string, string[]>
  referencesByDocumentId: Record<string, string[]>
  orphanDocumentIds: string[]
  tags: string[]
}

export interface BuildDocumentGraphOptions {
  groupId?: string | null
}

interface DocumentReference {
  label: string
  target: string
}

const TAG_PATTERN = /(?:^|\s)#([\p{L}\p{N}_/-]{2,})/gu
const WIKI_REFERENCE_PATTERN = /\[\[([^\]\n]+)\]\]/g
const DOC_LINK_PATTERN = /\[([^\]\n]+)\]\(#doc:([^)]+)\)/g
const MARKDOWN_EXTERNAL_LINK_PATTERN = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g
const RAW_EXTERNAL_LINK_PATTERN = /(^|[\s(])(https?:\/\/[^\s)]+)/g

function isDocument(node: DocumentNode): node is DocumentItem {
  return node.type === 'document'
}

function graphNodeId(node: DocumentNode | DocumentGroup) {
  return `doc-graph:${node.id}`
}

function tagNodeId(groupId: string, tag: string) {
  return `doc-graph:${groupId}:tag:${tag.toLowerCase()}`
}

function externalNodeId(groupId: string, url: string) {
  return `doc-graph:${groupId}:external:${encodeURIComponent(url)}`
}

function edgeId(type: DocumentGraphEdgeType, source: string, target: string, suffix = '') {
  return `doc-graph-edge:${type}:${source}->${target}${suffix ? `:${suffix}` : ''}`
}

export function buildDocumentPath(node: DocumentNode, nodes: DocumentNode[]): string {
  const byId = new Map(nodes.map((item) => [item.id, item]))
  const parts = [node.title]
  let parentId = node.parentId
  while (parentId) {
    const parent = byId.get(parentId)
    if (!parent) break
    parts.unshift(parent.title)
    parentId = parent.parentId
  }
  return parts.join(' / ')
}

export function extractDocumentReferenceTargets(markdown: string): DocumentReference[] {
  const refs = new Map<string, DocumentReference>()
  let match: RegExpExecArray | null

  while ((match = WIKI_REFERENCE_PATTERN.exec(markdown)) !== null) {
    const target = match[1].trim()
    if (target) refs.set(`wiki:${target.toLowerCase()}`, { label: target, target })
  }

  while ((match = DOC_LINK_PATTERN.exec(markdown)) !== null) {
    const label = match[1].trim()
    const target = match[2].trim()
    if (target) refs.set(`doc:${target.toLowerCase()}`, { label: label || target, target })
  }

  return Array.from(refs.values())
}

export function extractDocumentTags(markdown: string): string[] {
  const tags = new Set<string>()
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(markdown)
  if (frontmatter) {
    const tagList = /^tags:\s*\[([^\]]+)\]/im.exec(frontmatter[1])
    if (tagList) {
      tagList[1].split(',').forEach((tag) => {
        const normalized = tag.trim().replace(/^['"]|['"]$/g, '')
        if (normalized) tags.add(normalized)
      })
    }

    const tagBlock = /^tags:\s*\n((?:\s*-\s*.+\n?)+)/im.exec(frontmatter[1])
    if (tagBlock) {
      tagBlock[1].split('\n').forEach((line) => {
        const normalized = line.replace(/^\s*-\s*/, '').trim().replace(/^['"]|['"]$/g, '')
        if (normalized) tags.add(normalized)
      })
    }
  }

  let match: RegExpExecArray | null
  while ((match = TAG_PATTERN.exec(markdown)) !== null) {
    tags.add(match[1])
  }

  return Array.from(tags).sort((a, b) => a.localeCompare(b))
}

export function extractExternalLinks(markdown: string): string[] {
  const links = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = MARKDOWN_EXTERNAL_LINK_PATTERN.exec(markdown)) !== null) {
    links.add(match[2])
  }

  while ((match = RAW_EXTERNAL_LINK_PATTERN.exec(markdown)) !== null) {
    links.add(match[2])
  }

  return Array.from(links).sort((a, b) => a.localeCompare(b))
}

export function buildDocumentGraph(
  groups: DocumentGroup[],
  nodes: DocumentNode[],
  options: BuildDocumentGraphOptions = {},
): DocumentGraph {
  const scopedGroups = options.groupId ? groups.filter((group) => group.id === options.groupId) : groups
  const scopedGroupIds = new Set(scopedGroups.map((group) => group.id))
  const scopedNodes = nodes.filter((node) => scopedGroupIds.has(node.groupId))
  const documents = scopedNodes.filter(isDocument)
  const nodeById = new Map(scopedNodes.map((node) => [node.id, node]))
  const documentByLookup = new Map<string, DocumentItem>()
  const graphNodes = new Map<string, DocumentGraphNode>()
  const graphEdges = new Map<string, DocumentGraphEdge>()
  const backlinksByDocumentId: Record<string, string[]> = {}
  const referencesByDocumentId: Record<string, string[]> = {}
  const tags = new Set<string>()

  documents.forEach((doc) => {
    documentByLookup.set(doc.id.toLowerCase(), doc)
    documentByLookup.set(doc.title.toLowerCase(), doc)
    backlinksByDocumentId[doc.id] = []
    referencesByDocumentId[doc.id] = []
  })

  const addNode = (node: DocumentGraphNode) => {
    graphNodes.set(node.id, node)
  }

  const addEdge = (edge: DocumentGraphEdge) => {
    graphEdges.set(edge.id, edge)
    const source = graphNodes.get(edge.source)
    const target = graphNodes.get(edge.target)
    if (source) source.weight += edge.weight
    if (target) target.weight += edge.weight
  }

  scopedGroups.forEach((group) => {
    addNode({
      id: graphNodeId(group),
      type: 'group',
      label: group.name,
      groupId: group.id,
      weight: 1,
      metadata: {},
    })
  })

  scopedNodes.forEach((node) => {
    addNode({
      id: graphNodeId(node),
      type: node.type,
      label: node.title,
      groupId: node.groupId,
      documentId: node.type === 'document' ? node.id : undefined,
      folderId: node.type === 'folder' ? node.id : undefined,
      weight: 1,
      metadata: {
        path: buildDocumentPath(node, scopedNodes),
        excerpt: node.type === 'document' ? node.markdown.replace(/\s+/g, ' ').trim().slice(0, 180) : undefined,
      },
    })
  })

  scopedNodes.forEach((node) => {
    const parent = node.parentId ? nodeById.get(node.parentId) : null
    const sourceId = parent ? graphNodeId(parent) : `doc-graph:${node.groupId}`
    const targetId = graphNodeId(node)
    addEdge({
      id: edgeId('contains', sourceId, targetId),
      source: sourceId,
      target: targetId,
      type: 'contains',
      label: 'contains',
      weight: node.type === 'folder' ? 2 : 1,
      metadata: {},
    })
  })

  documents.forEach((doc) => {
    const docNodeId = graphNodeId(doc)

    extractDocumentReferenceTargets(doc.markdown).forEach((reference) => {
      const targetDoc = documentByLookup.get(reference.target.toLowerCase())
      if (!targetDoc || targetDoc.id === doc.id) return

      const targetNodeId = graphNodeId(targetDoc)
      referencesByDocumentId[doc.id].push(targetDoc.id)
      backlinksByDocumentId[targetDoc.id].push(doc.id)
      addEdge({
        id: edgeId('references', docNodeId, targetNodeId, reference.target.toLowerCase()),
        source: docNodeId,
        target: targetNodeId,
        type: 'references',
        label: reference.label,
        weight: 3,
        metadata: {
          documentId: doc.id,
          reference: reference.target,
        },
      })
    })

    extractDocumentTags(doc.markdown).forEach((tag) => {
      const normalizedTag = tag.trim()
      if (!normalizedTag) return
      tags.add(normalizedTag)
      const targetNodeId = tagNodeId(doc.groupId, normalizedTag)
      if (!graphNodes.has(targetNodeId)) {
        addNode({
          id: targetNodeId,
          type: 'tag',
          label: `#${normalizedTag}`,
          groupId: doc.groupId,
          weight: 1,
          metadata: {},
        })
      }
      addEdge({
        id: edgeId('tagged', docNodeId, targetNodeId, normalizedTag.toLowerCase()),
        source: docNodeId,
        target: targetNodeId,
        type: 'tagged',
        label: `#${normalizedTag}`,
        weight: 2,
        metadata: {
          documentId: doc.id,
          reference: normalizedTag,
        },
      })
    })

    extractExternalLinks(doc.markdown).forEach((url) => {
      const targetNodeId = externalNodeId(doc.groupId, url)
      if (!graphNodes.has(targetNodeId)) {
        addNode({
          id: targetNodeId,
          type: 'external-link',
          label: new URL(url).hostname,
          groupId: doc.groupId,
          weight: 1,
          metadata: { url },
        })
      }
      addEdge({
        id: edgeId('external-link', docNodeId, targetNodeId, url),
        source: docNodeId,
        target: targetNodeId,
        type: 'external-link',
        label: url,
        weight: 1,
        metadata: {
          documentId: doc.id,
          url,
        },
      })
    })
  })

  Object.values(backlinksByDocumentId).forEach((ids) => ids.sort())
  Object.values(referencesByDocumentId).forEach((ids) => ids.sort())

  const orphanDocumentIds = documents
    .filter((doc) => backlinksByDocumentId[doc.id].length === 0 && referencesByDocumentId[doc.id].length === 0)
    .map((doc) => doc.id)
    .sort()

  orphanDocumentIds.forEach((documentId) => {
    const node = graphNodes.get(`doc-graph:${documentId}`)
    if (node) node.metadata.orphan = true
  })

  return {
    nodes: Array.from(graphNodes.values()).sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label)),
    edges: Array.from(graphEdges.values()).sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id)),
    backlinksByDocumentId,
    referencesByDocumentId,
    orphanDocumentIds,
    tags: Array.from(tags).sort((a, b) => a.localeCompare(b)),
  }
}
