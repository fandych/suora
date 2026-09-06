import { PlusIcon } from "lucide-react"
import { Position } from "@xyflow/react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { WorkflowNodeData } from "@/data/domain/models"
import type { LucideIcon } from "lucide-react"
import { workflowPresetNodes } from "@/views/workflows/components/workflow-editor-config"
import { WorkflowNodeHandle } from "@/views/workflows/components/workflow-node-primitives"

export function WorkflowButtonHandle({ handleId, position, offset, canEdit, hasConnection, onAdd, getIcon }: { nodeId?: string; handleId: string | null; position: Position; offset?: string; canEdit: boolean; hasConnection: boolean; onAdd: (kind: WorkflowNodeData["kind"]) => void; getIcon: (kind: WorkflowNodeData["kind"]) => LucideIcon }) {
  if (!canEdit || hasConnection) return <WorkflowNodeHandle id={handleId ?? undefined} type="source" position={position} style={offset ? { left: offset } : undefined} />
  return (
    <>
      <WorkflowNodeHandle id={handleId ?? undefined} type="source" position={position} style={offset ? { left: offset } : undefined} />
      <div className="pointer-events-none absolute bottom-[-0.95rem] left-1/2 z-30 -translate-x-1/2">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button type="button" variant="secondary" size="icon-sm" className="pointer-events-auto nodrag nopan rounded-full border border-border/70 bg-background/95 shadow-sm" aria-label="Add next node" title="Add next node" />}>
            <PlusIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="center" className="w-48">
            {workflowPresetNodes.filter((item) => item.kind !== "start").map((item) => {
              const ItemIcon = getIcon(item.kind)
              return <DropdownMenuItem key={item.kind} onClick={() => onAdd(item.kind)}><ItemIcon />{item.label}</DropdownMenuItem>
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
