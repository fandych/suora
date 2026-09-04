import { BaseEdge, EdgeLabelRenderer, Position, getSmoothStepPath, useStore, type EdgeProps } from "@xyflow/react"

import type { WorkflowNodeData } from "@/data/domain/models"

const LABEL_OFFSET = 18

function getSourceLabelPosition(sourceX: number, sourceY: number, sourcePosition: Position) {
  switch (sourcePosition) {
    case Position.Top:
      return { x: sourceX, y: sourceY - LABEL_OFFSET }
    case Position.Left:
      return { x: sourceX - LABEL_OFFSET, y: sourceY }
    case Position.Right:
      return { x: sourceX + LABEL_OFFSET, y: sourceY }
    case Position.Bottom:
    default:
      return { x: sourceX, y: sourceY + LABEL_OFFSET }
  }
}

export function WorkflowEdge({ id, label, markerEnd, source, sourceHandleId, sourcePosition, sourceX, sourceY, style, targetPosition, targetX, targetY }: EdgeProps) {
  const sourceNodeData = useStore((state) => state.nodeLookup.get(source)?.data as WorkflowNodeData | undefined)
  const [edgePath] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const labelPosition = getSourceLabelPosition(sourceX, sourceY, sourcePosition)
  const branch = sourceNodeData?.kind === "if-else" ? sourceNodeData.branches?.find((item) => item.id === sourceHandleId) : undefined
  const edgeLabel = branch?.label || (typeof label === "string" ? label : "")
  const edgeDescription = branch?.expression || ""

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {edgeLabel ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute max-w-44 rounded-md border border-border/70 bg-background/95 px-1.5 py-1 text-[10px] font-medium text-muted-foreground shadow-sm"
            style={{ transform: `translate(-50%, -50%) translate(${labelPosition.x}px,${labelPosition.y}px)` }}
            title={edgeDescription ? `${edgeLabel}: ${edgeDescription}` : edgeLabel}
          >
            <span className="block truncate text-foreground">{edgeLabel}</span>
            {edgeDescription ? <span className="block truncate text-[9px] font-normal text-muted-foreground/80">{edgeDescription}</span> : null}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

export const workflowEdgeTypes = {
  workflow: WorkflowEdge,
}