import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"

import type { WorkflowNodeData } from "@/data/domain/models"

const kindTone: Record<WorkflowNodeData["kind"], string> = {
  start: "border-sky-500/35 bg-sky-500/8",
  end: "border-violet-500/35 bg-violet-500/8",
  "document-retrieval": "border-cyan-500/35 bg-cyan-500/8",
  agent: "border-emerald-500/35 bg-emerald-500/8",
  fork: "border-amber-500/35 bg-amber-500/8",
  join: "border-orange-500/35 bg-orange-500/8",
  "if-else": "border-yellow-500/35 bg-yellow-500/8",
  http: "border-rose-500/35 bg-rose-500/8",
  script: "border-indigo-500/35 bg-indigo-500/8",
}

export const WorkflowCanvasNode = memo(function WorkflowCanvasNode({ data }: NodeProps) {
  const node = data as WorkflowNodeData

  return (
    <div className={`w-64 rounded-2xl border shadow-sm ${kindTone[node.kind]}`}>
      <Handle type="target" position={Position.Left} className="h-2.5! w-2.5! border-0! bg-border!" />
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-xs font-semibold text-foreground">{node.label}</div>
          <div className="rounded-full border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{node.kind}</div>
        </div>
        <div className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">{node.task || node.prompt}</div>
        <div className="flex flex-wrap gap-1">
          {node.agentId ? <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">{node.agentId}</span> : null}
          {node.documentName || node.documentId ? <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">{node.documentName || node.documentId}</span> : null}
          {node.integrationName || node.integrationId ? <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">{node.integrationName || node.integrationId}</span> : null}
          {node.retryCount ? <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">{node.retryCount} retry</span> : null}
          {node.runIf ? <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">conditional</span> : null}
          {node.branchCount ? <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">{node.branchCount} branches</span> : null}
          {node.enabled === false ? <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">disabled</span> : null}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="h-2.5! w-2.5! border-0! bg-border!" />
    </div>
  )
})

export const workflowNodeTypes = {
  workflowNode: WorkflowCanvasNode,
}