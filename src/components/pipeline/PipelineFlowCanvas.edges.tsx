import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps, type Edge } from '@xyflow/react'

interface PipelineEdgeData {
  successOnly?: boolean
  condition?: string
  label?: string
  isErrorPath?: boolean
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

  const hasLabel = data?.successOnly || data?.condition || data?.label
  const isConditional = !!data?.condition
  const isErrorPath = data?.isErrorPath === true

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: isErrorPath ? 'rgba(239,68,68,0.55)' : (isConditional ? 'rgba(139,92,246,0.45)' : 'rgba(148,163,184,0.55)'),
          strokeWidth: 1.5,
          strokeDasharray: isErrorPath ? '8 5' : (isConditional ? '6 4' : undefined),
        }}
      />
      {hasLabel && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-auto nodrag nopan flex items-center gap-1 rounded-lg border border-border-subtle/80 bg-surface-1/98 px-2.5 py-1 text-[10px] font-medium text-slate-700 shadow-md backdrop-blur-sm"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {data?.successOnly && <span className="text-emerald-600">✓</span>}
            {data?.label && <span className={`max-w-32 truncate ${isErrorPath ? 'text-red-700' : 'text-sky-800'}`}>{data.label}</span>}
            {data?.condition && (
              <span className="max-w-40 truncate text-violet-800">
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
