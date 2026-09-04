import { memo, type CSSProperties } from "react"
import { BotIcon, Code2Icon, FileSearchIcon, FlagIcon, GitBranchIcon, GitForkIcon, GitMergeIcon, GlobeIcon, LoaderCircleIcon, PlayIcon, PlusIcon, type LucideIcon } from "lucide-react"
import { Handle, Position, type NodeProps } from "@xyflow/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { WorkflowNodeData } from "@/data/domain/models"
import { cn } from "@/lib/utils"
import { workflowPresetNodes } from "@/views/workflows/components/workflow-editor-config"
import { useWorkflowNodeActions } from "@/views/workflows/components/workflow-node-actions-context"

const NODE_STYLES: Record<WorkflowNodeData["kind"], { container: string; badge: string; icon: LucideIcon }> = {
  start: { container: "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30", badge: "Entry", icon: PlayIcon },
  end: { container: "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40", badge: "Exit", icon: FlagIcon },
  "document-retrieval": { container: "border-sky-200 bg-sky-50/80 dark:border-sky-900 dark:bg-sky-950/30", badge: "Knowledge", icon: FileSearchIcon },
  agent: { container: "border-violet-200 bg-violet-50/80 dark:border-violet-900 dark:bg-violet-950/30", badge: "Integration", icon: BotIcon },
  fork: { container: "border-orange-200 bg-orange-50/80 dark:border-orange-900 dark:bg-orange-950/30", badge: "Control", icon: GitForkIcon },
  join: { container: "border-orange-200 bg-orange-50/80 dark:border-orange-900 dark:bg-orange-950/30", badge: "Control", icon: GitMergeIcon },
  "if-else": { container: "border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30", badge: "Control", icon: GitBranchIcon },
  http: { container: "border-rose-200 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/30", badge: "Integration", icon: GlobeIcon },
  script: { container: "border-slate-300 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-900/40", badge: "Execution", icon: Code2Icon },
}

export const WORKFLOW_NODE_ICONS: Record<WorkflowNodeData["kind"], LucideIcon> = {
  start: PlayIcon,
  end: FlagIcon,
  "document-retrieval": FileSearchIcon,
  agent: BotIcon,
  fork: GitForkIcon,
  join: GitMergeIcon,
  "if-else": GitBranchIcon,
  http: GlobeIcon,
  script: Code2Icon,
}

function getSummary(node: WorkflowNodeData) {
  switch (node.kind) {
    case "start":
      return node.task || "Entry node"
    case "end":
      return node.outputKey?.trim() ? `Return ${node.outputKey}` : "Finalize the workflow output"
    case "document-retrieval":
      return node.documentName?.trim() || node.documentId?.trim() || "No knowledge base selected"
    case "agent":
      return node.agentId?.trim() || node.task?.trim() || node.prompt?.trim() || "No agent configured"
    case "fork":
      return `${node.branchCount ?? 2} branches`
    case "join":
      return `Merge strategy: ${node.joinStrategy ?? "wait-all"}`
    case "if-else":
      return node.runIf?.trim() || node.branches?.[0]?.expression?.trim() || "No condition expression yet"
    case "http":
      return node.url?.trim() ? `${node.method ?? "POST"} ${node.url}` : `${node.method ?? "POST"} request`
    case "script":
      return `${node.runtime ?? "node"} -> $${node.outputKey || "script_result"}`
    default:
      return node.task || node.prompt || "Configure this node"
  }
}

export const WorkflowCanvasNode = memo(function WorkflowCanvasNode({ id, data, selected }: NodeProps) {
  const node = data as WorkflowNodeData
  const style = NODE_STYLES[node.kind]
  const NodeIcon = WORKFLOW_NODE_ICONS[node.kind] ?? style.icon
  const executionStatus = (node as WorkflowNodeData & { executionStatus?: string }).executionStatus
  const summary = getSummary(node)
  const { canEdit, hasOutgoingConnection, onAddNodeFromHandle } = useWorkflowNodeActions()

  function renderAddNodeButton(handleId: string | null, className: string, styleOverride?: CSSProperties) {
    if (!canEdit || hasOutgoingConnection(id, handleId)) {
      return null
    }

    return (
      <div className={className} style={styleOverride}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className="rounded-full border border-border/70 bg-background/95 shadow-sm"
                aria-label="Add next node"
                title="Add next node"
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
              />
            }
          >
            <PlusIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="center" className="w-44">
            {workflowPresetNodes.filter((item) => item.kind !== "start").map((item) => {
              const ItemIcon = WORKFLOW_NODE_ICONS[item.kind]
              return (
                <DropdownMenuItem
                  key={`${handleId ?? "default"}-${item.kind}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    onAddNodeFromHandle(id, handleId, item.kind)
                  }}
                >
                  <ItemIcon />
                  {item.label}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn(
              "relative w-64 rounded-3xl border shadow-sm transition-all",
              style.container,
              selected ? "ring-2 ring-primary/25" : "ring-1 ring-transparent",
              executionStatus === "running" ? "ring-2 ring-sky-500 shadow-sky-200" : "",
              executionStatus === "success" ? "ring-2 ring-emerald-500/70" : "",
              executionStatus === "error" ? "ring-2 ring-red-500/80" : "",
              executionStatus === "queued" ? "opacity-60 grayscale" : "",
              node.enabled === false ? "opacity-55 grayscale" : ""
            )}
          />
        }
      >
          {node.kind !== "start" ? <>
            <Handle type="target" position={Position.Top} style={{ opacity: 0 }} className="h-2.5! w-2.5! border-0! bg-border!" />
            <Handle id="target-right" type="target" position={Position.Right} style={{ top: "38%", opacity: 0 }} className="h-2.5! w-2.5! border-0! bg-border!" />
            <Handle id="target-bottom" type="target" position={Position.Bottom} style={{ left: "38%", opacity: 0 }} className="h-2.5! w-2.5! border-0! bg-border!" />
            <Handle id="target-left" type="target" position={Position.Left} style={{ top: "62%", opacity: 0 }} className="h-2.5! w-2.5! border-0! bg-border!" />
          </> : null}
          <div className="border-b px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border bg-background/75 text-foreground shadow-sm">
                  <NodeIcon className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{style.badge}</p>
                  <div className="truncate text-sm font-semibold text-foreground">{node.label}</div>
                </div>
              </div>
              <div className="flex min-w-0 shrink items-center gap-1.5">
                {executionStatus ? (
                  <Badge variant="outline" className="gap-1 capitalize">
                    {executionStatus === "running" ? <LoaderCircleIcon className="size-3 animate-spin text-sky-600" /> : null}
                    {executionStatus === "success" ? "Succeeded" : executionStatus === "error" ? "Failed" : executionStatus === "queued" ? "Waiting" : executionStatus}
                  </Badge>
                ) : null}
                <Badge variant="outline" className="max-w-24 truncate">{node.kind}</Badge>
              </div>
            </div>
          </div>
          <div className="px-4 py-3">
            <p className="min-w-0 truncate text-xs leading-relaxed text-muted-foreground" title={summary}>{summary}</p>
          </div>
          {node.kind === "if-else" ? (
            <>
              {(node.branches ?? []).map((branch, index, branches) => (
                <div key={branch.id}>
                  <Handle
                    id={branch.id}
                    type="source"
                    position={Position.Bottom}
                    style={{ left: `${((index + 1) / (branches.length + 1)) * 100}%` }}
                    className="h-2.5! w-2.5! border-0! bg-border!"
                  />
                  {renderAddNodeButton(branch.id, "absolute bottom-[-0.95rem] -translate-x-1/2", { left: `${((index + 1) / (branches.length + 1)) * 100}%` })}
                </div>
              ))}
            </>
          ) : <>
            {node.kind !== "end" ? <>
              <Handle type="source" position={Position.Bottom} className="h-2.5! w-2.5! border-0! bg-border!" />
              <Handle id="source-top" type="source" position={Position.Top} style={{ left: "62%", opacity: 0 }} className="h-2.5! w-2.5! border-0! bg-border!" />
              <Handle id="source-right" type="source" position={Position.Right} style={{ top: "62%", opacity: 0 }} className="h-2.5! w-2.5! border-0! bg-border!" />
              <Handle id="source-left" type="source" position={Position.Left} style={{ top: "38%", opacity: 0 }} className="h-2.5! w-2.5! border-0! bg-border!" />
            </> : null}
            {node.kind !== "end" ? renderAddNodeButton(null, "absolute bottom-[-0.95rem] left-1/2 -translate-x-1/2") : null}
          </>}
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-center text-xs">{node.description || "No description configured."}</TooltipContent>
    </Tooltip>
  )
})

export const workflowNodeTypes = {
  workflowNode: WorkflowCanvasNode,
}