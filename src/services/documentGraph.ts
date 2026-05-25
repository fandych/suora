import type { DocumentGroup, DocumentItem, DocumentNode } from '@/types'
import { getDocumentDisplayName, searchDocuments } from '@/services/documents'

export type DocumentGraphNodeType = 'group' | 'folder' | 'document' | 'tag' | 'external-link'
export type DocumentGraphEdgeType = 'contains' | 'references' | 'tagged' | 'external-link'

export type DocumentGraphInsightKind = 'orphan' | 'bridge' | 'sparse-community' | 'surprising-connection'
export type DocumentGraphInsightSeverity = 'high' | 'medium' | 'low'

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
    pageType?: string
    sources?: string[]
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

export interface DocumentGraphCommunity {
  id: string
  label: string
  documentIds: string[]
  cohesion: number
  directReferenceCount: number
}

export interface DocumentGraphInsight {
  id: string
  kind: DocumentGraphInsightKind
  severity: DocumentGraphInsightSeverity
  title: string
  detail: string
  documentIds: string[]
  edgeIds: string[]
  score: number
}

export interface DocumentGraphInsightsReport {
  communities: DocumentGraphCommunity[]
  insights: DocumentGraphInsight[]
  orphanCount: number
  bridgeCount: number
  sparseCommunityCount: number
  surprisingConnectionCount: number
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

const EMPTY_GRAPH_INSIGHTS_REPORT: DocumentGraphInsightsReport = {
  communities: [],
  insights: [],
  orphanCount: 0,
  bridgeCount: 0,
  sparseCommunityCount: 0,
  surprisingConnectionCount: 0,
}

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

function extractFrontmatter(markdown: string): string | null {
  return /^---\n([\s\S]*?)\n---/.exec(markdown)?.[1] ?? null
}

function normalizeFrontmatterValue(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '')
}

function extractFrontmatterString(frontmatter: string | null, key: string): string | null {
  if (!frontmatter) return null
  const pattern = new RegExp(`^${key}:[^\\S\\n]*(.+)$`, 'im')
  const match = pattern.exec(frontmatter)
  if (!match) return null
  const value = normalizeFrontmatterValue(match[1])
  return value && !value.startsWith('[') ? value : null
}

function extractFrontmatterList(frontmatter: string | null, key: string): string[] {
  if (!frontmatter) return []
  const values = new Set<string>()
  const inlinePattern = new RegExp(`^${key}:[^\\S\\n]*\\[([^\\]]+)\\]`, 'im')
  const inlineMatch = inlinePattern.exec(frontmatter)
  if (inlineMatch) {
    inlineMatch[1].split(',').forEach((item) => {
      const normalized = normalizeFrontmatterValue(item)
      if (normalized) values.add(normalized)
    })
  }

  const blockPattern = new RegExp(`^${key}:[^\\S\\n]*\\n((?:[^\\S\\n]*-\\s*.+\\n?)+)`, 'im')
  const blockMatch = blockPattern.exec(frontmatter)
  if (blockMatch) {
    blockMatch[1].split('\n').forEach((line) => {
      const normalized = normalizeFrontmatterValue(line.replace(/^\s*-\s*/, ''))
      if (normalized) values.add(normalized)
    })
  }

  const scalar = extractFrontmatterString(frontmatter, key)
  if (scalar) values.add(scalar)

  return Array.from(values).sort((a, b) => a.localeCompare(b))
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
  extractFrontmatterList(extractFrontmatter(markdown), 'tags').forEach((tag) => tags.add(tag))

  for (const match of markdown.matchAll(makeTagPattern())) {
    tags.add(match[1])
  }

  return Array.from(tags).sort((a, b) => a.localeCompare(b))
}

export function extractDocumentSources(markdown: string): string[] {
  const frontmatter = extractFrontmatter(markdown)
  return Array.from(new Set([
    ...extractFrontmatterList(frontmatter, 'sources'),
    ...extractFrontmatterList(frontmatter, 'source'),
  ])).sort((a, b) => a.localeCompare(b))
}

export function extractDocumentPageType(markdown: string): string | null {
  return extractFrontmatterString(extractFrontmatter(markdown), 'type')
    ?? extractFrontmatterString(extractFrontmatter(markdown), 'pageType')
    ?? null
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
    const sources = extractDocumentSources(doc.markdown)
    const pageType = extractDocumentPageType(doc.markdown)
    const docNodeId = graphNodeId(doc)
    const graphDocNode = graphNodes.get(docNodeId)
    if (graphDocNode) {
      graphDocNode.metadata.sources = sources
      graphDocNode.metadata.pageType = pageType ?? undefined
    }

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
  const documentTagsById = new Map<string, Set<string>>()
  const documentSourcesById = new Map<string, Set<string>>()
  const documentPageTypeById = new Map<string, string>()
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

  for (const doc of docsById.values()) {
    documentTagsById.set(doc.id, new Set(extractDocumentTags(doc.markdown).map((tag) => tag.toLowerCase())))
    documentSourcesById.set(doc.id, new Set(extractDocumentSources(doc.markdown).map((source) => source.toLowerCase())))
    const pageType = extractDocumentPageType(doc.markdown)
    if (pageType) documentPageTypeById.set(doc.id, pageType.toLowerCase())
  }

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

        for (const linkEdge of edgesByNodeId.get(neighborNode.id) ?? []) {
          const linkNeighborId = linkEdge.source === neighborNode.id ? linkEdge.target : linkEdge.source
          const linkNeighborNode = nodeById.get(linkNeighborId)
          if (!linkNeighborNode || linkNeighborNode.type !== 'document' || !linkNeighborNode.documentId || linkNeighborNode.documentId === seed.doc.id) {
            continue
          }

          const relatedDoc = docsById.get(linkNeighborNode.documentId)
          if (!relatedDoc) continue
          addDocumentMatch(
            relatedDoc,
            seed.score + linkEdge.weight * 10,
            `Shares external source ${neighborNode.label} with ${seed.doc.title}`,
          )
        }
      }
    }

    const seedSources = documentSourcesById.get(seed.doc.id) ?? new Set<string>()
    const seedTags = documentTagsById.get(seed.doc.id) ?? new Set<string>()
    const seedPageType = documentPageTypeById.get(seed.doc.id)
    const seedNeighbors = new Set(
      (edgesByNodeId.get(seedNode.id) ?? [])
        .filter((edge) => edge.type !== 'contains')
        .map((edge) => edge.source === seedNode.id ? edge.target : edge.source),
    )

    for (const candidate of docsById.values()) {
      if (candidate.id === seed.doc.id) continue
      const candidateNode = graphNodeByDocumentId.get(candidate.id)
      if (!candidateNode) continue

      const sharedSources = Array.from(documentSourcesById.get(candidate.id) ?? []).filter((source) => seedSources.has(source))
      if (sharedSources.length > 0) {
        addDocumentMatch(
          candidate,
          seed.score + sharedSources.length * 35,
          `Shares source ${sharedSources.slice(0, 2).join(', ')} with ${seed.doc.title}`,
        )
      }

      const candidateNeighbors = new Set(
        (edgesByNodeId.get(candidateNode.id) ?? [])
          .filter((edge) => edge.type !== 'contains')
          .map((edge) => edge.source === candidateNode.id ? edge.target : edge.source),
      )
      const commonNeighborCount = Array.from(candidateNeighbors).filter((neighborId) => seedNeighbors.has(neighborId)).length
      if (commonNeighborCount > 0) {
        addDocumentMatch(
          candidate,
          seed.score + commonNeighborCount * 18,
          `Shares ${commonNeighborCount} graph neighbor${commonNeighborCount === 1 ? '' : 's'} with ${seed.doc.title}`,
        )
      }

      const candidatePageType = documentPageTypeById.get(candidate.id)
      if (seedPageType && candidatePageType === seedPageType) {
        const sharedTags = Array.from(documentTagsById.get(candidate.id) ?? []).filter((tag) => seedTags.has(tag))
        if (sharedTags.length > 0 || sharedSources.length > 0) {
          addDocumentMatch(
            candidate,
            seed.score + 10,
            `Same page type (${seedPageType}) as ${seed.doc.title}`,
          )
        }
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

function getDocumentGraphNodes(graph: DocumentGraph) {
  return graph.nodes.filter((node): node is DocumentGraphNode & { documentId: string } => node.type === 'document' && Boolean(node.documentId))
}

function addUndirected(adjacency: Map<string, Set<string>>, source: string, target: string) {
  const sourceNeighbors = adjacency.get(source) ?? new Set<string>()
  sourceNeighbors.add(target)
  adjacency.set(source, sourceNeighbors)

  const targetNeighbors = adjacency.get(target) ?? new Set<string>()
  targetNeighbors.add(source)
  adjacency.set(target, targetNeighbors)
}

function getDocumentIdsConnectedToNode(graph: DocumentGraph, nodeId: string): string[] {
  const ids = new Set<string>()
  graph.edges.forEach((edge) => {
    if (edge.source !== nodeId && edge.target !== nodeId) return
    const otherNodeId = edge.source === nodeId ? edge.target : edge.source
    const other = graph.nodes.find((node) => node.id === otherNodeId)
    if (other?.type === 'document' && other.documentId) ids.add(other.documentId)
  })
  return Array.from(ids)
}

function buildDocumentInsightAdjacency(graph: DocumentGraph) {
  const documentNodes = getDocumentGraphNodes(graph)
  const documentNodeByGraphId = new Map(documentNodes.map((node) => [node.id, node]))
  const adjacency = new Map<string, Set<string>>(documentNodes.map((node) => [node.documentId, new Set<string>()]))
  const directReferencePairs = new Set<string>()
  const tagNodeIds = new Set<string>()
  const externalNodeIds = new Set<string>()

  graph.edges.forEach((edge) => {
    if (edge.type === 'references') {
      const source = documentNodeByGraphId.get(edge.source)
      const target = documentNodeByGraphId.get(edge.target)
      if (source && target) {
        addUndirected(adjacency, source.documentId, target.documentId)
        directReferencePairs.add([source.documentId, target.documentId].sort().join('\u0000'))
      }
    }

    if (edge.type === 'tagged') tagNodeIds.add(edge.source.startsWith('doc-graph:') && !documentNodeByGraphId.has(edge.source) ? edge.source : edge.target)
    if (edge.type === 'external-link') externalNodeIds.add(edge.source.startsWith('doc-graph:') && !documentNodeByGraphId.has(edge.source) ? edge.source : edge.target)
  })

  for (const nodeId of [...tagNodeIds, ...externalNodeIds]) {
    const connectedIds = getDocumentIdsConnectedToNode(graph, nodeId)
    for (let firstIndex = 0; firstIndex < connectedIds.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < connectedIds.length; secondIndex += 1) {
        addUndirected(adjacency, connectedIds[firstIndex], connectedIds[secondIndex])
      }
    }
  }

  const sourcesByDocumentId = new Map(documentNodes.map((node) => [node.documentId, node.metadata.sources ?? []]))
  const sourceBuckets = new Map<string, string[]>()
  sourcesByDocumentId.forEach((sources, documentId) => {
    sources.forEach((source) => {
      const key = source.toLowerCase()
      const bucket = sourceBuckets.get(key) ?? []
      bucket.push(documentId)
      sourceBuckets.set(key, bucket)
    })
  })

  for (const bucket of sourceBuckets.values()) {
    for (let firstIndex = 0; firstIndex < bucket.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < bucket.length; secondIndex += 1) {
        addUndirected(adjacency, bucket[firstIndex], bucket[secondIndex])
      }
    }
  }

  return { adjacency, directReferencePairs, sourcesByDocumentId }
}

function findDocumentCommunities(graph: DocumentGraph): DocumentGraphCommunity[] {
  const documentNodes = getDocumentGraphNodes(graph)
  const documentNodeById = new Map(documentNodes.map((node) => [node.documentId, node]))
  const { adjacency, directReferencePairs } = buildDocumentInsightAdjacency(graph)
  const visited = new Set<string>()
  const communities: DocumentGraphCommunity[] = []

  for (const node of documentNodes) {
    if (visited.has(node.documentId)) continue
    const stack = [node.documentId]
    const documentIds: string[] = []
    visited.add(node.documentId)

    while (stack.length > 0) {
      const current = stack.pop()
      if (!current) continue
      documentIds.push(current)
      for (const neighbor of adjacency.get(current) ?? []) {
        if (visited.has(neighbor)) continue
        visited.add(neighbor)
        stack.push(neighbor)
      }
    }

    documentIds.sort((a, b) => (documentNodeById.get(a)?.label ?? a).localeCompare(documentNodeById.get(b)?.label ?? b))
    const possiblePairCount = documentIds.length * (documentIds.length - 1) / 2
    const directReferenceCount = documentIds.reduce((count, sourceId, sourceIndex) => {
      return count + documentIds.slice(sourceIndex + 1).filter((targetId) => directReferencePairs.has([sourceId, targetId].sort().join('\u0000'))).length
    }, 0)
    const label = documentNodeById.get(documentIds[0])?.label ?? `Community ${communities.length + 1}`

    communities.push({
      id: `community:${communities.length + 1}`,
      label,
      documentIds,
      cohesion: possiblePairCount === 0 ? 1 : directReferenceCount / possiblePairCount,
      directReferenceCount,
    })
  }

  return communities.sort((a, b) => b.documentIds.length - a.documentIds.length || a.label.localeCompare(b.label))
}

function findBridgeDocumentIds(graph: DocumentGraph): string[] {
  const { adjacency } = buildDocumentInsightAdjacency(graph)
  const documentIds = Array.from(adjacency.keys())
  const visited = new Set<string>()
  const discovery = new Map<string, number>()
  const low = new Map<string, number>()
  const parent = new Map<string, string | null>()
  const articulation = new Set<string>()
  let time = 0

  const visit = (documentId: string) => {
    visited.add(documentId)
    discovery.set(documentId, time)
    low.set(documentId, time)
    time += 1
    let childCount = 0

    for (const neighbor of adjacency.get(documentId) ?? []) {
      if (!visited.has(neighbor)) {
        parent.set(neighbor, documentId)
        childCount += 1
        visit(neighbor)
        low.set(documentId, Math.min(low.get(documentId) ?? 0, low.get(neighbor) ?? 0))

        if (!parent.has(documentId) && childCount > 1) articulation.add(documentId)
        if (parent.has(documentId) && (low.get(neighbor) ?? 0) >= (discovery.get(documentId) ?? 0)) articulation.add(documentId)
      } else if (neighbor !== parent.get(documentId)) {
        low.set(documentId, Math.min(low.get(documentId) ?? 0, discovery.get(neighbor) ?? 0))
      }
    }
  }

  documentIds.forEach((documentId) => {
    if (!visited.has(documentId)) visit(documentId)
  })

  return Array.from(articulation).sort()
}

export function analyzeDocumentGraphInsights(graph: DocumentGraph, nodes: DocumentNode[] = []): DocumentGraphInsightsReport {
  const documentNodes = getDocumentGraphNodes(graph)
  if (documentNodes.length === 0) return EMPTY_GRAPH_INSIGHTS_REPORT

  const documentNodeById = new Map(documentNodes.map((node) => [node.documentId, node]))
  const sourceNodeById = new Map(
    nodes
      .filter(isDocument)
      .map((doc) => [doc.id, {
        tags: extractDocumentTags(doc.markdown).map((tag) => tag.toLowerCase()),
        sources: extractDocumentSources(doc.markdown).map((source) => source.toLowerCase()),
        pageType: extractDocumentPageType(doc.markdown)?.toLowerCase() ?? null,
      }]),
  )
  const communities = findDocumentCommunities(graph)
  const bridgeDocumentIds = findBridgeDocumentIds(graph)
  const insights: DocumentGraphInsight[] = []

  graph.orphanDocumentIds.forEach((documentId) => {
    const node = documentNodeById.get(documentId)
    if (!node) return
    insights.push({
      id: `orphan:${documentId}`,
      kind: 'orphan',
      severity: 'low',
      title: `${node.label} is isolated`,
      detail: 'Add wikilinks, tags, or source frontmatter so this page can participate in graph expansion.',
      documentIds: [documentId],
      edgeIds: [],
      score: 20,
    })
  })

  bridgeDocumentIds.forEach((documentId) => {
    const node = documentNodeById.get(documentId)
    if (!node) return
    insights.push({
      id: `bridge:${documentId}`,
      kind: 'bridge',
      severity: 'medium',
      title: `${node.label} bridges several notes`,
      detail: 'This page sits on a critical path between clusters; keeping its summary and links current improves navigation.',
      documentIds: [documentId],
      edgeIds: graph.edges.filter((edge) => edge.source === node.id || edge.target === node.id).map((edge) => edge.id),
      score: 80 + (graph.edges.filter((edge) => edge.source === node.id || edge.target === node.id).length * 2),
    })
  })

  communities
    .filter((community) => community.documentIds.length >= 3 && community.cohesion < 0.35)
    .forEach((community) => {
      insights.push({
        id: `sparse:${community.id}`,
        kind: 'sparse-community',
        severity: 'medium',
        title: `${community.label} cluster is sparse`,
        detail: `${community.documentIds.length} notes share weak structure but only ${community.directReferenceCount} direct references. Add overview links or split the topic if needed.`,
        documentIds: community.documentIds,
        edgeIds: [],
        score: 60 + community.documentIds.length * 4 - Math.round(community.cohesion * 20),
      })
    })

  graph.edges
    .filter((edge) => edge.type === 'references')
    .forEach((edge) => {
      const source = graph.nodes.find((node) => node.id === edge.source)
      const target = graph.nodes.find((node) => node.id === edge.target)
      if (source?.type !== 'document' || target?.type !== 'document' || !source.documentId || !target.documentId) return
      const sourceMeta = sourceNodeById.get(source.documentId)
      const targetMeta = sourceNodeById.get(target.documentId)
      const sourceType = sourceMeta?.pageType ?? source.metadata.pageType?.toLowerCase() ?? null
      const targetType = targetMeta?.pageType ?? target.metadata.pageType?.toLowerCase() ?? null
      const sharedTags = (sourceMeta?.tags ?? []).filter((tag) => targetMeta?.tags.includes(tag))
      const sharedSources = (sourceMeta?.sources ?? source.metadata.sources?.map((item) => item.toLowerCase()) ?? []).filter((sourceName) => (targetMeta?.sources ?? target.metadata.sources?.map((item) => item.toLowerCase()) ?? []).includes(sourceName))
      const crossType = Boolean(sourceType && targetType && sourceType !== targetType)
      if (!crossType && sharedTags.length > 0 && sharedSources.length > 0) return

      const score = 45 + (crossType ? 25 : 0) + (sharedTags.length === 0 ? 12 : 0) + (sharedSources.length === 0 ? 8 : 0)
      insights.push({
        id: `surprising:${edge.id}`,
        kind: 'surprising-connection',
        severity: crossType ? 'medium' : 'low',
        title: `${source.label} connects to ${target.label}`,
        detail: crossType
          ? `Cross-type link from ${sourceType} to ${targetType}; check whether this deserves an explicit synthesis note.`
          : 'Direct reference with little shared metadata; it may be a useful unexpected connection or may need tags/sources.',
        documentIds: [source.documentId, target.documentId],
        edgeIds: [edge.id],
        score,
      })
    })

  const rankedInsights = insights
    .sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title))
    .slice(0, 12)

  return {
    communities,
    insights: rankedInsights,
    orphanCount: graph.orphanDocumentIds.length,
    bridgeCount: rankedInsights.filter((insight) => insight.kind === 'bridge').length,
    sparseCommunityCount: rankedInsights.filter((insight) => insight.kind === 'sparse-community').length,
    surprisingConnectionCount: rankedInsights.filter((insight) => insight.kind === 'surprising-connection').length,
  }
}
