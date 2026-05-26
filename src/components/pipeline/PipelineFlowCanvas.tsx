import { useMemo, useCallback, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useI18n } from '@/hooks/useI18n'
import type { AgentPipelineStep } from '@/types'
import type { AgentPipelineProgressStep } from '@/services/agentPipelineService'
import { convertStepsToFlow } from './PipelineFlowCanvas.utils'
import { PipelineStepNode, TerminalNode } from './PipelineFlowCanvas.nodes'
import { PipelineEdge } from './PipelineFlowCanvas.edges'

interface PipelineFlowCanvasProps {
  steps: AgentPipelineStep[]
  progressSteps: AgentPipelineProgressStep[]
  agentNameMap: Record<string, string>
  className?: string
}

const nodeTypes: NodeTypes = {
  pipelineStep: PipelineStepNode,
  terminal: TerminalNode,
}

const edgeTypes: EdgeTypes = {
  pipelineEdge: PipelineEdge,
}

const proOptions = { hideAttribution: true }

export function PipelineFlowCanvas({ steps, progressSteps, agentNameMap, className }: PipelineFlowCanvasProps) {
  const { t } = useI18n()

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => convertStepsToFlow(steps, progressSteps, agentNameMap),
    [steps, progressSteps, agentNameMap],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges)

  useEffect(() => { setNodes(layoutNodes) }, [layoutNodes, setNodes])
  useEffect(() => { setEdges(layoutEdges) }, [layoutEdges, setEdges])

  const onInit = useCallback((instance: { fitView: () => void }) => {
    instance.fitView()
  }, [])

  if (steps.length === 0) {
    return (
      <div className={`flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-border-subtle text-xs text-text-muted ${className ?? ''}`}>
        {t('agents.pipelineNoStepsToVisualize', 'No pipeline steps to visualize.')}
      </div>
    )
  }

  return (
    <div className={`h-105 overflow-hidden rounded-2xl border border-border-subtle bg-slate-900/60 ${className ?? ''}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        proOptions={proOptions}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        minZoom={0.3}
        maxZoom={2}
      >
        <Background color="rgba(148,163,184,0.08)" gap={20} />
        <Controls
          showInteractive={false}
          className="rounded-xl! border-slate-700/50! bg-slate-800/80! shadow-lg! [&>button]:border-slate-700/30! [&>button]:bg-transparent! [&>button]:text-slate-400! [&>button:hover]:bg-white/5!"
        />
        <MiniMap
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
          className="rounded-xl! border-slate-700/50! bg-slate-800/70!"
          maskColor="rgba(0,0,0,0.6)"
        />
      </ReactFlow>
    </div>
  )
}
