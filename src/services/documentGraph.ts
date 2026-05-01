import type { DocumentGroup, DocumentItem, DocumentNode } from '@/types'
import { getDocumentDisplayName, searchDocuments } from '@/services/documents'

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

export interface QueryDocumentGraphOptions {
  query?: string | null
  documentIdOrTitle?: string | null
  groupId?: string | null
  seedLimit?: number
  relatedLimit?: number
}

export interface DocumentGraphQueryDocument {
  id: string
  title: string
  groupId: string
  path?: string
  excerpt: string
  score: number
  isSeed: boolean
  reasons: string[]
}

export interface DocumentGraphQueryResult {
  seeds: DocumentGraphQueryDocument[]
  relatedDocuments: DocumentGraphQueryDocument[]
  tags: string[]
  externalLinks: string[]
}

interface DocumentReference {
  label: string
  target: string
}

interface GraphDocumentMatch {
  doc: DocumentItem
  score: number
  reasons: Set<string>
  isSeed: boolean
}

// Regex factories: each call returns a fresh /g regex so `lastIndex` state cannot
// leak between invocations (which would happen if these were module-level constants
// shared across concurrent or nested callers).
const makeTagPattern = () => /(?:^|\s)#([\p{L}\p{N}_/-]{2,})/gu
const makeWikiReferencePattern = () => /\[\[([^\]\n]+)\]\]/g
const makeDocLinkPattern = () => /\[([^\]\n]+)\]\(#doc:([^)]+)\)/g
const makeMarkdownExternalLinkPattern = () => /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g
const makeRawExternalLinkPattern = () => /(^|[\s(])(https?:\/\/[^\s)]+)/g

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

function externalLinkLabel(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function edgeId(type: DocumentGraphEdgeType, source: string, target: string, suffix = '') {
  return `doc-graph-edge:${type}:${source}->${target}${suffix ? `:${suffix}` : ''}`
}

function resolveGraphDocument(nodes: DocumentNode[], documentIdOrTitle: string, groupId?: string | null): DocumentItem | null {
  const query = documentIdOrTitle.trim().toLowerCase()
  const docs = nodes
    .filter(isDocument)
    .filter((doc) => !groupId || doc.groupId === groupId)

  return docs.find((doc) => doc.id === documentIdOrTitle)
    ?? docs.find((doc) => doc.title.toLowerCase() === query)
    ?? docs.find((doc) => doc.title.toLowerCase().includes(query))
    ?? null
}

function summarizeGraphDocument(markdown: string, maxLength = 180) {
  const compact = markdown.replace(/\s+/g, ' ').trim()
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact
}

function describeDocumentConnection(edge: DocumentGraphEdge, seedTitle: string, relatedTitle: string, seedNodeId: string) {
  if (edge.type === 'references') {
    return edge.source === seedNodeId
      ? `${seedTitle} references ${relatedTitle}`
      : `${relatedTitle} references ${seedTitle}`
  }

  return `${seedTitle} is connected to ${relatedTitle}`
}

function toQueryDocument(match: GraphDocumentMatch, graphNode?: DocumentGraphNode): DocumentGraphQueryDocument {
  return {
    id: match.doc.id,
    title: match.doc.title,
    groupId: match.doc.groupId,
    path: graphNode?.metadata.path,
    excerpt: graphNode?.metadata.excerpt ?? summarizeGraphDocument(match.doc.markdown),
    score: match.score,
    isSeed: match.isSeed,
    reasons: Array.from(match.reasons).sort((a, b) => a.localeCompare(b)),
  }
}

export function buildDocumentPath(node: DocumentNode, nodes: DocumentNode[], nodeById?: Map<string, DocumentNode>): string {
  const byId = nodeById ?? new Map(nodes.map((item) => [item.id, item]))
  const displayTitle = (item: DocumentNode) => item.type === 'document' ? getDocumentDisplayName(item.title) : item.title
  const parts = [displayTitle(node)]
  let parentId = node.parentId
  while (parentId) {
    const parent = byId.get(parentId)
    if (!parent) break
    parts.unshift(displayTitle(parent))
    parentId = parent.parentId
  }
  return parts.join(' / ')
}

export function extractDocumentReferenceTargets(markdown: string): DocumentReference[] {
  const refs = new Map<string, DocumentReference>()

  for (const match of markdown.matchAll(makeWikiReferencePattern())) {
    const target = match[1].trim()
    if (target) refs.set(`wiki:${target.toLowerCase()}`, { label: target, target })
  }

  for (const match of markdown.matchAll(makeDocLinkPattern())) {
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

  for (const match of markdown.matchAll(makeTagPattern())) {
    tags.add(match[1])
  }

  return Array.from(tags).sort((a, b) => a.localeCompare(b))
}

export function extractExternalLinks(markdown: string): string[] {
  const links = new Set<string>()

  for (const match of markdown.matchAll(makeMarkdownExternalLinkPattern())) {
    links.add(match[2])
  }

  for (const match of markdown.matchAll(makeRawExternalLinkPattern())) {
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
  const nodeById = new Map<string, DocumentNode>(scopedNodes.map((node) => [node.id, node]))
  // Two distinct lookup maps so that a document whose title equals another
  // document's id cannot accidentally hijack reference resolution.
  const documentById = new Map<string, DocumentItem>()
  const documentByTitle = new Map<string, DocumentItem>()
  const graphNodes = new Map<string, DocumentGraphNode>()
  const graphEdges = new Map<string, DocumentGraphEdge>()
  const backlinksByDocumentId: Record<string, string[]> = {}
  const referencesByDocumentId: Record<string, string[]> = {}
  const tags = new Set<string>()

  documents.forEach((doc) => {
    documentById.set(doc.id.toLowerCase(), doc)
    // Last-write wins for duplicate titles, matching the prior behavior; the
    // unresolved/ambiguous case can be surfaced separately if needed.
    documentByTitle.set(doc.title.toLowerCase(), doc)
    backlinksByDocumentId[doc.id] = []
    referencesByDocumentId[doc.id] = []
  })

  const lookupDocument = (target: string): DocumentItem | undefined => {
    const key = target.toLowerCase()
    return documentById.get(key) ?? documentByTitle.get(key)
  }

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
        path: buildDocumentPath(node, scopedNodes, nodeById),
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
      const targetDoc = lookupDocument(reference.target)
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
          label: externalLinkLabel(url),
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

export function queryDocumentGraph(
  graph: DocumentGraph,
  nodes: DocumentNode[],
  options: QueryDocumentGraphOptions,
): DocumentGraphQueryResult {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const graphNodeByDocumentId = new Map(
    graph.nodes
      .filter((node): node is DocumentGraphNode & { documentId: string } => node.type === 'document' && !!node.documentId)
      .map((node) => [node.documentId, node]),
  )
  const docsById = new Map(
    nodes
      .filter(isDocument)
      .filter((doc) => !options.groupId || doc.groupId === options.groupId)
      .map((doc) => [doc.id, doc]),
  )
  const edgesByNodeId = new Map<string, DocumentGraphEdge[]>()
  const tags = new Set<string>()
  const externalLinks = new Set<string>()
  const matches = new Map<string, GraphDocumentMatch>()
  const seeds: Array<{ doc: DocumentItem; score: number; reason: string }> = []
  const seenSeedIds = new Set<string>()
  const seedLimit = options.seedLimit ?? 4
  const relatedLimit = options.relatedLimit ?? 8
  const trimmedQuery = options.query?.trim()
  const trimmedDocumentIdOrTitle = options.documentIdOrTitle?.trim()

  const addSeed = (doc: DocumentItem, score: number, reason: string) => {
    if (!graphNodeByDocumentId.has(doc.id) || seenSeedIds.has(doc.id)) return
    seenSeedIds.add(doc.id)
    seeds.push({ doc, score, reason })
  }

  const addDocumentMatch = (doc: DocumentItem, score: number, reason: string, isSeed = false) => {
    const existing = matches.get(doc.id)
    if (existing) {
      existing.score = Math.max(existing.score, score)
      existing.isSeed = existing.isSeed || isSeed
      existing.reasons.add(reason)
      return
    }

    matches.set(doc.id, {
      doc,
      score,
      reasons: new Set([reason]),
      isSeed,
    })
  }

  graph.edges.forEach((edge) => {
    const source = edgesByNodeId.get(edge.source) ?? []
    source.push(edge)
    edgesByNodeId.set(edge.source, source)

    const target = edgesByNodeId.get(edge.target) ?? []
    target.push(edge)
    edgesByNodeId.set(edge.target, target)
  })

  if (trimmedQuery) {
    searchDocuments(nodes, options.groupId ?? null, trimmedQuery)
      .slice(0, seedLimit)
      .forEach((result) => {
        addSeed(result.node, result.score + 100, `Matches query "${trimmedQuery}"`)
      })
  }

  if (trimmedDocumentIdOrTitle) {
    const doc = resolveGraphDocument(nodes, trimmedDocumentIdOrTitle, options.groupId ?? null)
    if (doc) {
      addSeed(doc, 120, `Matched document "${doc.title}"`)
    }
  }

  seeds.forEach((seed) => {
    addDocumentMatch(seed.doc, seed.score, seed.reason, true)

    const seedNode = graphNodeByDocumentId.get(seed.doc.id)
    if (!seedNode) return

    for (const edge of edgesByNodeId.get(seedNode.id) ?? []) {
      const neighborId = edge.source === seedNode.id ? edge.target : edge.source
      const neighborNode = nodeById.get(neighborId)
      if (!neighborNode) continue

      if (neighborNode.type === 'document' && neighborNode.documentId && neighborNode.documentId !== seed.doc.id) {
        const relatedDoc = docsById.get(neighborNode.documentId)
        if (!relatedDoc) continue
        addDocumentMatch(
          relatedDoc,
          seed.score + edge.weight * 20,
          describeDocumentConnection(edge, seed.doc.title, relatedDoc.title, seedNode.id),
        )
        continue
      }

      if (neighborNode.type === 'tag') {
        const normalizedTag = neighborNode.label.replace(/^#/, '')
        if (normalizedTag) tags.add(normalizedTag)

        for (const tagEdge of edgesByNodeId.get(neighborNode.id) ?? []) {
          const tagNeighborId = tagEdge.source === neighborNode.id ? tagEdge.target : tagEdge.source
          const tagNeighborNode = nodeById.get(tagNeighborId)
          if (!tagNeighborNode || tagNeighborNode.type !== 'document' || !tagNeighborNode.documentId || tagNeighborNode.documentId === seed.doc.id) {
            continue
          }

          const relatedDoc = docsById.get(tagNeighborNode.documentId)
          if (!relatedDoc) continue
          addDocumentMatch(
            relatedDoc,
            seed.score + tagEdge.weight * 15,
            `Shares tag ${neighborNode.label} with ${seed.doc.title}`,
          )
        }
        continue
      }

      if (neighborNode.type === 'external-link' && neighborNode.metadata.url) {
        externalLinks.add(neighborNode.metadata.url)
      }
    }
  })

  const rankedMatches = Array.from(matches.values()).sort((a, b) => b.score - a.score || b.doc.updatedAt - a.doc.updatedAt || a.doc.title.localeCompare(b.doc.title))

  return {
    seeds: rankedMatches
      .filter((match) => match.isSeed)
      .map((match) => toQueryDocument(match, graphNodeByDocumentId.get(match.doc.id))),
    relatedDocuments: rankedMatches
      .filter((match) => !match.isSeed)
      .slice(0, relatedLimit)
      .map((match) => toQueryDocument(match, graphNodeByDocumentId.get(match.doc.id))),
    tags: Array.from(tags).sort((a, b) => a.localeCompare(b)),
    externalLinks: Array.from(externalLinks).sort((a, b) => a.localeCompare(b)),
  }
}
