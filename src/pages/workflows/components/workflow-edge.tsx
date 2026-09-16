import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useStore, type EdgeProps } from "@xyflow/react"

import type { WorkflowNodeData } from "@/types/workflow"

export function WorkflowEdge({
  id,
  label,
  markerEnd,
  source,
  sourceHandleId,
  sourcePosition,
  sourceX,
  sourceY,
  style,
  targetPosition,
  targetX,
  targetY,
  selected,
}: EdgeProps) {
  const sourceNodeData = useStore((state) => state.nodeLookup.get(source)?.data as WorkflowNodeData | undefined)
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })
  const branch =
    sourceNodeData?.kind === "if-else" ? sourceNodeData.branches?.find((item) => item.id === sourceHandleId) : undefined
  const edgeLabel = branch?.label || (typeof label === "string" ? label : "")
  const edgeDescription = branch?.expression || ""

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 2.5 : 1.5,
          stroke: selected ? "var(--color-primary)" : style?.stroke,
        }}
      />
      {edgeLabel ? (
        <EdgeLabelRenderer>
          <div
            className={`nodrag nopan pointer-events-none absolute max-w-44 rounded-md border bg-background/95 px-1.5 py-1 text-[10px] font-medium shadow-sm ${selected ? "border-primary text-primary" : "border-border/70 text-muted-foreground"}`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            title={edgeDescription ? `${edgeLabel}: ${edgeDescription}` : edgeLabel}
          >
            <span className="block truncate text-foreground">{edgeLabel}</span>
            {edgeDescription ? (
              <span className="block truncate text-[9px] font-normal text-muted-foreground/80">{edgeDescription}</span>
            ) : null}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

export const workflowEdgeTypes = {
  workflow: WorkflowEdge,
}
