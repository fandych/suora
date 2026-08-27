import { useMemo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ConnectionLineType,
  Panel,
  useNodesState,
  useEdgesState,
  type Connection,
  type EdgeChange,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { LayoutDashboardIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, SearchIcon, Maximize2Icon, MinusIcon, PlusIcon } from 'lucide-react'

import { useI18n } from '@/hooks/useI18n'
import type { AgentPipelineStep } from '@/types'
import type { AgentPipelineProgressStep } from '@/services/agentPipelineService'
import type { PipelineValidationIssue } from '@/services/pipelineValidation'
import { convertStepsToFlow } from './PipelineFlowCanvas.utils'
import { PipelinePlaceholderNode, PipelineStepNode } from './PipelineFlowCanvas.nodes'
import { PipelineEdge } from './PipelineFlowCanvas.edges'
import type { PipelineNodeType } from './pipelineNodeLibrary'

interface PipelineFlowCanvasProps {
  steps: AgentPipelineStep[]
  progressSteps: AgentPipelineProgressStep[]
  agentNameMap: Record<string, string>
  className?: string
  onAddStep?: () => void
  onInsertStepAfter?: (stepIndex: number, nodeType: PipelineNodeType) => void
  onConnectSteps?: (sourceStepIndex: number, targetStepIndex: number) => void
  onDisconnectSteps?: (sourceStepIndex: number, targetStepIndex: number) => void
  selectedStepIndex?: number | null
  onStepSelect?: (stepIndex: number) => void
  onCanvasClearSelection?: () => void
  leftPanelContent?: ReactNode
  rightPanelContent?: ReactNode
  topRightPanelContent?: ReactNode
  validationIssues?: PipelineValidationIssue[]
}

const nodeTypes: NodeTypes = {
  pipelineStep: PipelineStepNode,
  placeholder: PipelinePlaceholderNode,
}

const edgeTypes: EdgeTypes = {
  pipelineEdge: PipelineEdge,
}

const proOptions = { hideAttribution: true }

export function PipelineFlowCanvas({ steps, progressSteps, agentNameMap, className, onAddStep, onInsertStepAfter, onConnectSteps, onDisconnectSteps, selectedStepIndex, onStepSelect, onCanvasClearSelection, leftPanelContent, rightPanelContent, topRightPanelContent, validationIssues = [] }: PipelineFlowCanvasProps) {
  const { t } = useI18n()
  const flowInstanceRef = useRef<ReactFlowInstance<Node, Edge> | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(true)
  const [rightPanelWidth, setRightPanelWidth] = useState(320)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [zoomLevel, setZoomLevel] = useState(1)
  const isEmpty = steps.length === 0
  const hasCycle = validationIssues.some((issue) => issue.code === 'cycle-detected')
  const unreachableCount = validationIssues.filter((issue) => issue.code === 'unreachable-node').length

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => {
    const base = convertStepsToFlow(steps, progressSteps, agentNameMap, 'TB', selectedStepIndex ?? undefined, validationIssues)
    return {
      nodes: base.nodes.map((node) => {
        if (node.type !== 'pipelineStep') return node
        const stepIndex = (node.data as { stepIndex?: number }).stepIndex
        if (typeof stepIndex !== 'number') return node
        return {
          ...node,
          data: {
            ...node.data,
            onSelect: onStepSelect ? () => onStepSelect(stepIndex) : undefined,
            canInsertAfter: Boolean(onInsertStepAfter),
            onInsertAfter: onInsertStepAfter ? (nodeType: PipelineNodeType) => onInsertStepAfter(stepIndex, nodeType) : undefined,
          },
        }
      }),
      edges: base.edges,
    }
  }, [steps, progressSteps, agentNameMap, selectedStepIndex, onInsertStepAfter, validationIssues])

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges)
  const searchableNodes = useMemo(() => layoutNodes.filter((node) => node.type === 'pipelineStep'), [layoutNodes])
  const matchedNodes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return []
    return searchableNodes.filter((node) => {
      const data = node.data as { stepName?: string; task?: string; agentName?: string }
      return [data.stepName, data.task, data.agentName].some((value) => (value ?? '').toLowerCase().includes(query))
    }).slice(0, 6)
  }, [searchQuery, searchableNodes])
  const emptyNodes = useMemo(() => ([{
    id: 'pipeline-placeholder',
    type: 'placeholder',
    position: { x: 0, y: 0 },
    data: {
      title: t('agents.pipelineFlowEmptyTitle', 'Start building this pipeline'),
      description: t('agents.pipelineFlowEmptyBody', 'Add the first step to see the workflow take shape in the canvas.'),
      actionLabel: onAddStep ? t('agents.addStep', '+ Add Step') : undefined,
      onAction: onAddStep,
    },
  }]), [onAddStep, t])

  useEffect(() => {
    setNodes((currentNodes) => {
      if (currentNodes.length !== layoutNodes.length) {
        return layoutNodes
      }

      const sameIds = currentNodes.every((node, index) => node.id === layoutNodes[index]?.id)
      if (!sameIds) {
        return layoutNodes
      }

      return layoutNodes.map((node, index) => ({
        ...node,
        position: currentNodes[index]?.position ?? node.position,
      }))
    })
  }, [layoutNodes, setNodes])
  useEffect(() => { setEdges(layoutEdges) }, [layoutEdges, setEdges])
  useEffect(() => {
    if (!flowInstanceRef.current) return
    if (typeof window.requestAnimationFrame !== 'function') {
      flowInstanceRef.current.fitView()
      return
    }
    const rafId = window.requestAnimationFrame(() => {
      flowInstanceRef.current?.fitView()
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [layoutEdges, layoutNodes])

  const onInit = useCallback((instance: ReactFlowInstance<Node, Edge>) => {
    flowInstanceRef.current = instance
    setZoomLevel(instance.getZoom())
    instance.fitView()
  }, [])
  const handleAutoLayout = useCallback(() => {
    setNodes(layoutNodes)
    if (!flowInstanceRef.current) return
    if (typeof window.requestAnimationFrame !== 'function') {
      flowInstanceRef.current.fitView()
      return
    }
    window.requestAnimationFrame(() => {
      flowInstanceRef.current?.fitView({ duration: 250, maxZoom: 1.2 })
    })
  }, [layoutNodes, setNodes])
  const focusNode = useCallback((node: Node) => {
    if (!flowInstanceRef.current) return
    flowInstanceRef.current.fitView({ nodes: [node], duration: 300, maxZoom: 1.2 })
  }, [])
  const handleNodeClick = useCallback((_event: unknown, node: Node) => {
    const stepIndex = (node.data as { stepIndex?: unknown })?.stepIndex
    if (typeof stepIndex === 'number') {
      onStepSelect?.(stepIndex)
    }
  }, [onStepSelect])
  const handlePaneClick = useCallback(() => {
    setSearchOpen(false)
    onCanvasClearSelection?.()
  }, [onCanvasClearSelection])
  const handleConnect = useCallback((connection: Connection) => {
    if (!onConnectSteps || !connection.source || !connection.target) return
    const sourceMatch = connection.source.match(/^step-(\d+)$/)
    const targetMatch = connection.target.match(/^step-(\d+)$/)
    if (!sourceMatch || !targetMatch) return
    onConnectSteps(Number(sourceMatch[1]), Number(targetMatch[1]))
  }, [onConnectSteps])
  const handleEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    onEdgesChange(changes)
    if (!onDisconnectSteps) return
    for (const change of changes) {
      if (change.type !== 'remove' || typeof change.id !== 'string') continue
      const match = change.id.match(/^step-(\d+)-step-(\d+)(?:-\d+)?$/)
      if (!match) continue
      onDisconnectSteps(Number(match[1]), Number(match[2]))
    }
  }, [onDisconnectSteps, onEdgesChange])
  const renderedNodes = isEmpty ? emptyNodes : nodes
  const renderedEdges = isEmpty ? [] : edges

  return (
    <div className={`h-full min-h-0 w-full overflow-hidden rounded-2xl border border-border-subtle bg-surface-0/55 ${className ?? ''}`}>
      <ReactFlow
        nodes={renderedNodes}
        edges={renderedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onInit={onInit}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onConnect={handleConnect}
        onMove={(_event, viewport) => setZoomLevel(viewport.zoom)}
        nodeTypes={nodeTypes}
        edgeTypes={isEmpty ? undefined : edgeTypes}
        proOptions={proOptions}
        fitView={false}
        onlyRenderVisibleElements={false}
        nodesDraggable={!isEmpty}
        nodesConnectable={Boolean(onConnectSteps) && !isEmpty}
        elementsSelectable={!isEmpty}
        panOnDrag
        zoomOnScroll
        connectionLineType={ConnectionLineType.SmoothStep}
        minZoom={isEmpty ? 0.8 : 0.3}
        maxZoom={isEmpty ? 1.2 : 2}
      >
        <Background color="rgba(148,163,184,0.18)" gap={20} />
        <Controls
          showInteractive={false}
          className="rounded-xl! border-border-subtle/70! bg-surface-1/95! shadow-lg! [&>button]:border-border-subtle/60! [&>button]:bg-transparent! [&>button]:text-text-muted! [&>button:hover]:bg-surface-2/80! [&>button:hover]:text-text-primary!"
        />
        <Panel position="top-left" className="m-3!">
          <div className="flex items-start gap-2">
            {libraryOpen && leftPanelContent ? <div className="flex h-[calc(100%-1.5rem)] w-48 max-w-[calc(100vw-6rem)] min-h-0 flex-col gap-2 rounded-xl border border-border-subtle/70 bg-surface-1/95 p-2 shadow-xl backdrop-blur-sm">{leftPanelContent}</div> : null}
            <button
              type="button"
              onClick={() => setLibraryOpen((current) => !current)}
              className="rounded-xl border border-border-subtle/70 bg-surface-1/95 p-2 text-text-secondary shadow-lg backdrop-blur-sm transition-colors hover:border-accent/25 hover:text-text-primary"
              aria-label={libraryOpen ? t('agents.hideNodeLibrary', 'Hide node library') : t('agents.showNodeLibrary', 'Show node library')}
              title={libraryOpen ? t('agents.hideNodeLibrary', 'Hide node library') : t('agents.showNodeLibrary', 'Show node library')}
            >
              {libraryOpen ? <PanelLeftCloseIcon className="size-4" /> : <PanelLeftOpenIcon className="size-4" />}
            </button>
            <button
              type="button"
              onClick={handleAutoLayout}
              className="rounded-xl border border-border-subtle/70 bg-surface-1/95 p-2 text-text-secondary shadow-lg backdrop-blur-sm transition-colors hover:border-accent/25 hover:text-text-primary"
              aria-label={t('agents.pipelineAutoLayout', 'Auto layout')}
              title={t('agents.pipelineAutoLayout', 'Auto layout')}
            >
              <LayoutDashboardIcon className="size-4" />
            </button>
            {searchOpen ? <div className="w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border-subtle/70 bg-surface-1/95 p-2 shadow-xl backdrop-blur-sm">
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onBlur={() => {
                    if (!searchQuery.trim()) {
                      setSearchOpen(false)
                    }
                  }}
                  placeholder={t('agents.pipelineSearchNodes', 'Search nodes...')}
                  className="w-full rounded-xl border border-border-subtle/70 bg-surface-0/88 px-3 py-2 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent/45"
                />
                {searchQuery.trim() ? (
                  <div className="mt-2 space-y-1">
                    {matchedNodes.length > 0 ? matchedNodes.map((node) => {
                      const data = node.data as { stepName?: string; agentName?: string }
                      return (
                        <button
                          key={node.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            focusNode(node)
                            const stepIndex = (node.data as { stepIndex?: unknown })?.stepIndex
                            if (typeof stepIndex === 'number') {
                              onStepSelect?.(stepIndex)
                            }
                            setSearchOpen(false)
                          }}
                          className="block w-full rounded-xl border border-border-subtle/70 bg-surface-0/82 px-3 py-2 text-left text-[11px] text-text-secondary transition-colors hover:border-accent/25 hover:bg-accent/6 hover:text-text-primary"
                        >
                          <div className="font-medium">{data.stepName ?? node.id}</div>
                          <div className="mt-1 text-[10px] text-text-muted">{data.agentName ?? t('common.noData', 'Unknown')}</div>
                        </button>
                      )
                    }) : <div className="rounded-xl border border-dashed border-border-subtle/70 px-3 py-2 text-[11px] text-text-muted">{t('agents.noMatchingPipelineSteps', 'No matching steps.')}</div>}
                  </div>
                ) : null}
              </div> : <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  className="rounded-xl border border-border-subtle/70 bg-surface-1/95 p-2 text-text-secondary shadow-lg backdrop-blur-sm transition-colors hover:border-accent/25 hover:text-text-primary"
                  aria-label={t('agents.pipelineSearchNodes', 'Search nodes...')}
                  title={t('agents.pipelineSearchNodes', 'Search nodes...')}
                >
                  <SearchIcon className="size-4" />
                </button>}
          </div>
          {(hasCycle || unreachableCount > 0) ? <div className="mt-2 flex flex-wrap gap-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-800 shadow-lg backdrop-blur-sm">
              {hasCycle ? <span>{t('agents.pipelineCycleDetected', 'Cycle detected in this workflow graph')}</span> : null}
              {unreachableCount > 0 ? <span>{t('agents.pipelineUnreachableNodes', `${unreachableCount} unreachable node(s) highlighted`).replace('{count}', String(unreachableCount))}</span> : null}
            </div> : null}
        </Panel>
        {topRightPanelContent ? <Panel position="top-right" className="m-3! max-w-[calc(100%-1.5rem)]">{topRightPanelContent}</Panel> : null}
        {rightPanelContent ? (
          <Panel position="top-right" className="top-3! right-3! bottom-3! m-0! p-0!">
            <div className="relative h-full min-h-0 max-w-[calc(100vw-1.5rem)]" style={{ width: rightPanelWidth }}>
              <button
                type="button"
                aria-label={t('agents.resizePropertiesPanel', 'Resize properties panel')}
                title={t('agents.resizePropertiesPanel', 'Resize properties panel')}
                className="absolute top-1/2 -left-2 z-10 h-10 w-1 -translate-y-1/2 touch-none cursor-ew-resize rounded-full bg-border/70 hover:bg-accent"
                onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
                onPointerMove={(event) => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
                    return
                  }

                  setRightPanelWidth((current) => Math.min(520, Math.max(260, current - event.movementX)))
                }}
              />
              <div className="h-full overflow-y-auto rounded-xl border border-border-subtle/70 bg-surface-1/98 p-2 shadow-xl backdrop-blur-sm">
                {rightPanelContent}
              </div>
            </div>
          </Panel>
        ) : null}
        <Panel position="bottom-center" className="m-3!">
          <div className="flex items-center gap-1 rounded-xl border border-border-subtle/70 bg-surface-1/95 p-1 shadow-lg backdrop-blur-sm">
            <button
              type="button"
              onClick={() => flowInstanceRef.current?.zoomOut({ duration: 250 })}
              className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-2/80 hover:text-text-primary"
              aria-label={t('common.zoomOut', 'Zoom out')}
            >
              <MinusIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => flowInstanceRef.current?.zoomTo(1, { duration: 250 })}
              className="min-w-16 rounded-lg px-2 py-2 text-[11px] font-medium text-text-secondary transition-colors hover:bg-surface-2/80 hover:text-text-primary"
            >
              {`${(zoomLevel * 100).toFixed(0)}%`}
            </button>
            <button
              type="button"
              onClick={() => flowInstanceRef.current?.zoomIn({ duration: 250 })}
              className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-2/80 hover:text-text-primary"
              aria-label={t('common.zoomIn', 'Zoom in')}
            >
              <PlusIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => flowInstanceRef.current?.fitView({ duration: 250, maxZoom: 1.2 })}
              className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-2/80 hover:text-text-primary"
              aria-label={t('common.bestFit', 'Best fit')}
            >
              <Maximize2Icon className="size-4" />
            </button>
          </div>
        </Panel>
        {!rightPanelContent ? <MiniMap
            nodeStrokeWidth={3}
            nodeColor={(node) => {
              if (node.type === 'terminal') return 'rgba(148,163,184,0.4)'
              const status = (node.data as { status?: string })?.status
              if (status === 'success') return 'rgba(52,211,153,0.6)'
              if (status === 'error') return 'rgba(248,113,113,0.6)'
              if (status === 'running') return 'rgba(251,191,36,0.6)'
              if (status === 'skipped') return 'rgba(100,116,139,0.4)'
              return 'rgba(148,163,184,0.3)'
            }}
            className="rounded-xl! border-border-subtle/70! bg-surface-1/90!"
            maskColor="rgba(255,255,255,0.65)"
          /> : null}
      </ReactFlow>
    </div>
  )
}
