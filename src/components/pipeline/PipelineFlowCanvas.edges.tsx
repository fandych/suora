import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps, type Edge } from '@xyflow/react'

interface PipelineEdgeData {
  successOnly?: boolean
  condition?: string
  [key: string]: unknown
}

type PipelineEdgeType = Edge<PipelineEdgeData, 'pipelineEdge'>

export const PipelineEdge = memo(function PipelineEdge(props: EdgeProps<PipelineEdgeType>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const hasLabel = data?.successOnly || data?.condition
  const isConditional = !!data?.condition

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: isConditional ? 'rgba(139,92,246,0.5)' : 'rgba(148,163,184,0.35)',
          strokeWidth: 1.5,
          strokeDasharray: isConditional ? '6 4' : undefined,
        }}
      />
      {hasLabel && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-auto nodrag nopan flex items-center gap-1 rounded-lg border border-white/10 bg-slate-800/90 px-2 py-1 text-[9px] text-white/60 shadow-md backdrop-blur-sm"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {data?.successOnly && <span className="text-emerald-400">✓</span>}
            {data?.condition && (
              <span className="max-w-[140px] truncate text-violet-300">
                if {data.condition.length > 30 ? `${data.condition.slice(0, 29)}…` : data.condition}
              </span>
            )}
            {data?.successOnly && !data?.condition && <span>success</span>}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
})
