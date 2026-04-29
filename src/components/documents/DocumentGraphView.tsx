import { useMemo, useState } from 'react'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { useI18n } from '@/hooks/useI18n'
import { toGraphifyExport } from '@/services/graphifyAdapter'
import type { DocumentGraph, DocumentGraphEdgeType, DocumentGraphNode } from '@/services/documentGraph'

const EDGE_TYPES: DocumentGraphEdgeType[] = ['contains', 'references', 'tagged', 'external-link']
// Keep the adapter preview compact enough for the inspector panel without rendering the full graph JSON.
const GRAPHIFY_PREVIEW_MAX_CHARS = 1400

const NODE_STYLE: Record<DocumentGraphNode['type'], { color: string; radius: number; label: string }> = {
  group: { color: '#12A8A0', radius: 26, label: 'Group' },
  folder: { color: '#D9A441', radius: 21, label: 'Folder' },
  document: { color: '#4D7CFF', radius: 19, label: 'Document' },
  tag: { color: '#35B98F', radius: 16, label: 'Tag' },
  'external-link': { color: '#E45F68', radius: 15, label: 'External' },
}

interface DocumentGraphViewProps {
  graph: DocumentGraph
  selectedDocumentId: string | null
  onSelectDocument: (id: string) => void
}

interface PositionedNode extends DocumentGraphNode {
  x: number
  y: number
  active: boolean
  related: boolean
}

function getRelatedNodeIds(graph: DocumentGraph, selectedDocumentId: string | null) {
  if (!selectedDocumentId) return new Set<string>()
  const selectedNodeId = `doc-graph:${selectedDocumentId}`
  const related = new Set<string>([selectedNodeId])
  graph.edges.forEach((edge) => {
    if (edge.source === selectedNodeId) related.add(edge.target)
    if (edge.target === selectedNodeId) related.add(edge.source)
  })
  return related
}

export function DocumentGraphView({ graph, selectedDocumentId, onSelectDocument }: DocumentGraphViewProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [enabledEdges, setEnabledEdges] = useState<Set<DocumentGraphEdgeType>>(() => new Set(EDGE_TYPES))
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(selectedDocumentId ? `doc-graph:${selectedDocumentId}` : null)
  const [showExport, setShowExport] = useState(false)

  const relatedNodeIds = useMemo(() => getRelatedNodeIds(graph, selectedDocumentId), [graph, selectedDocumentId])
  const filteredEdges = useMemo(() => graph.edges.filter((edge) => enabledEdges.has(edge.type)), [enabledEdges, graph.edges])
  const visibleNodeIds = useMemo(() => {
    const ids = new Set<string>()
    filteredEdges.forEach((edge) => {
      ids.add(edge.source)
      ids.add(edge.target)
    })
    graph.nodes.forEach((node) => {
      if (node.type === 'document' || node.type === 'group') ids.add(node.id)
    })
    return ids
  }, [filteredEdges, graph.nodes])

  const positionedNodes = useMemo<PositionedNode[]>(() => {
    const q = query.trim().toLowerCase()
    const nodes = graph.nodes.filter((node) => visibleNodeIds.has(node.id) && (!q || node.label.toLowerCase().includes(q) || node.metadata.path?.toLowerCase().includes(q)))
    const centerX = 430
    const centerY = 265
    const rings = {
      group: 0,
      document: 155,
      folder: 95,
      tag: 225,
      'external-link': 260,
    } satisfies Record<DocumentGraphNode['type'], number>
    const counts = nodes.reduce<Record<string, number>>((acc, node) => {
      acc[node.type] = (acc[node.type] ?? 0) + 1
      return acc
    }, {})
    const indexes: Record<string, number> = {}

    return nodes.map((node) => {
      const index = indexes[node.type] ?? 0
      indexes[node.type] = index + 1
      const total = counts[node.type] ?? 1
      const angle = total === 1 ? -Math.PI / 2 : (Math.PI * 2 * index) / total - Math.PI / 2
      const radius = rings[node.type]
      return {
        ...node,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        active: node.documentId === selectedDocumentId || node.id === selectedNodeId,
        related: relatedNodeIds.has(node.id),
      }
    })
  }, [graph.nodes, query, relatedNodeIds, selectedDocumentId, selectedNodeId, visibleNodeIds])

  const positionedById = useMemo(() => new Map(positionedNodes.map((node) => [node.id, node])), [positionedNodes])
  const visibleEdges = filteredEdges.filter((edge) => positionedById.has(edge.source) && positionedById.has(edge.target))
  const selectedNode = (selectedNodeId && graph.nodes.find((node) => node.id === selectedNodeId)) || (selectedDocumentId && graph.nodes.find((node) => node.documentId === selectedDocumentId)) || null
  const backlinks = selectedDocumentId ? graph.backlinksByDocumentId[selectedDocumentId] ?? [] : []
  const graphifyPreview = useMemo(() => JSON.stringify(toGraphifyExport(graph), null, 2).slice(0, GRAPHIFY_PREVIEW_MAX_CHARS), [graph])

  const toggleEdge = (edgeType: DocumentGraphEdgeType) => {
    setEnabledEdges((prev) => {
      const next = new Set(prev)
      if (next.has(edgeType)) next.delete(edgeType)
      else next.add(edgeType)
      return next
    })
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_300px] gap-4">
      <div className="relative min-h-0 overflow-hidden rounded-[2rem] border border-border-subtle/70 bg-[radial-gradient(circle_at_20%_15%,rgba(var(--t-accent-rgb),0.18),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)', backgroundSize: '38px 38px' }} />
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{t('documents.graphTitle', 'Knowledge Graph')}</h3>
            <p className="mt-1 text-[11px] text-text-muted">
              {graph.nodes.length} {t('documents.graphNodes', 'nodes')} · {graph.edges.length} {t('documents.graphEdges', 'edges')} · {graph.orphanDocumentIds.length} {t('documents.graphOrphans', 'orphans')}
            </p>
          </div>
          <div className="relative w-56">
            <IconifyIcon name="ui-search" size={13} color="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/60" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('documents.graphSearch', 'Filter graph…')}
              className="w-full rounded-2xl border border-border-subtle/55 bg-surface-0/70 py-2 pl-9 pr-3 text-[11px] text-text-primary outline-none focus:border-accent/30 focus:ring-2 focus:ring-accent/10"
            />
          </div>
        </div>

        <svg viewBox="0 0 860 530" className="relative z-10 mt-3 h-[calc(100%-4.25rem)] min-h-[360px] w-full">
          <defs>
            <filter id="graphGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {visibleEdges.map((edge) => {
            const source = positionedById.get(edge.source)
            const target = positionedById.get(edge.target)
            if (!source || !target) return null
            const highlighted = source.related || target.related || source.active || target.active
            return (
              <g key={edge.id}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={edge.type === 'references' ? '#4D7CFF' : edge.type === 'tagged' ? '#35B98F' : edge.type === 'external-link' ? '#E45F68' : '#D9A441'}
                  strokeOpacity={highlighted ? 0.62 : 0.22}
                  strokeWidth={highlighted ? 2.2 : 1.2}
                  strokeDasharray={edge.type === 'contains' ? '0' : edge.type === 'references' ? '8 5' : '3 6'}
                />
              </g>
            )
          })}
          {positionedNodes.map((node) => {
            const style = NODE_STYLE[node.type]
            const radius = style.radius + Math.min(10, node.weight)
            return (
              <g
                key={node.id}
                role={node.documentId ? 'button' : 'img'}
                tabIndex={node.documentId ? 0 : -1}
                onClick={() => {
                  setSelectedNodeId(node.id)
                  if (node.documentId) onSelectDocument(node.documentId)
                }}
                onKeyDown={(event) => {
                  if (node.documentId && (event.key === 'Enter' || event.key === ' ')) onSelectDocument(node.documentId)
                }}
                className={node.documentId ? 'cursor-pointer outline-none' : 'outline-none'}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius + 8}
                  fill={style.color}
                  opacity={node.active ? 0.2 : node.related ? 0.13 : 0.05}
                  filter={node.active ? 'url(#graphGlow)' : undefined}
                />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  fill={style.color}
                  opacity={node.active ? 0.98 : node.related ? 0.88 : 0.68}
                  stroke="rgba(255,255,255,.72)"
                  strokeWidth={node.active ? 3 : 1.3}
                />
                {node.metadata.orphan && <circle cx={node.x + radius * 0.62} cy={node.y - radius * 0.62} r="5" fill="#E45F68" />}
                <text x={node.x} y={node.y + radius + 17} textAnchor="middle" className="fill-text-primary text-[11px] font-semibold">
                  {node.label.length > 18 ? `${node.label.slice(0, 17)}…` : node.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <aside className="min-h-0 overflow-y-auto rounded-[2rem] border border-border-subtle/70 bg-surface-0/55 p-4">
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">{t('documents.graphFilters', 'Graph Filters')}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {EDGE_TYPES.map((edgeType) => (
              <button
                key={edgeType}
                type="button"
                onClick={() => toggleEdge(edgeType)}
                className={`rounded-2xl border px-3 py-1.5 text-[10px] font-semibold transition-all ${enabledEdges.has(edgeType) ? 'border-accent/25 bg-accent/12 text-accent' : 'border-border-subtle/55 bg-surface-2/45 text-text-muted hover:text-text-primary'}`}
              >
                {edgeType}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-border-subtle/60 bg-surface-1/50 p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">{t('documents.graphSelection', 'Selection')}</h3>
          {selectedNode ? (
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: NODE_STYLE[selectedNode.type].color }} />
                <span className="text-[12px] font-semibold text-text-primary">{selectedNode.label}</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-text-secondary/80">{selectedNode.metadata.path || selectedNode.metadata.url || NODE_STYLE[selectedNode.type].label}</p>
              {selectedNode.metadata.excerpt && <p className="mt-3 line-clamp-4 text-[11px] leading-relaxed text-text-muted">{selectedNode.metadata.excerpt}</p>}
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-text-muted">{t('documents.graphNoSelection', 'Select a graph node to inspect it.')}</p>
          )}
        </section>

        <section className="mt-4 rounded-3xl border border-border-subtle/60 bg-surface-1/50 p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">{t('documents.backlinks', 'Backlinks')}</h3>
          <div className="mt-3 space-y-2">
            {backlinks.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border-subtle/55 px-3 py-4 text-center text-[11px] text-text-muted">{t('documents.noBacklinks', 'No backlinks yet.')}</p>
            ) : backlinks.map((documentId) => {
              const node = graph.nodes.find((item) => item.documentId === documentId)
              if (!node) return null
              return (
                <button key={documentId} type="button" onClick={() => onSelectDocument(documentId)} className="w-full rounded-2xl border border-border-subtle/55 bg-surface-2/55 px-3 py-2 text-left hover:border-accent/25 hover:bg-accent/8">
                  <span className="block truncate text-[12px] font-semibold text-text-primary">{node.label}</span>
                  <span className="mt-1 block truncate text-[10px] text-text-muted">{node.metadata.path}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-border-subtle/60 bg-surface-1/50 p-4">
          <button type="button" onClick={() => setShowExport((value) => !value)} className="flex w-full items-center justify-between text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            <span>{t('documents.graphifyExport', 'Graphify Adapter')}</span>
            <IconifyIcon name="ui-chevron-down" size={13} color="currentColor" className={showExport ? '' : '-rotate-90'} />
          </button>
          {showExport && (
            <pre className="mt-3 max-h-56 overflow-auto rounded-2xl border border-border-subtle/60 bg-surface-2/55 p-3 text-[10px] leading-relaxed text-text-secondary">
              {graphifyPreview}
            </pre>
          )}
        </section>
      </aside>
    </div>
  )
}
