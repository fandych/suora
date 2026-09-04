import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { WorkflowNodeData } from "@/data/domain/models"
import { WORKFLOW_NODE_ICONS } from "@/views/workflows/components/workflow-canvas-node"
import type { WorkflowDesignIssue } from "@/views/workflows/components/workflow-editor-state"

const libraryGroups: Array<{ title: string; kinds: WorkflowNodeData["kind"][] }> = [
  { title: "Core", kinds: ["start", "end", "agent"] },
  { title: "Logic", kinds: ["if-else", "fork", "join"] },
  { title: "Knowledge", kinds: ["document-retrieval"] },
  { title: "Execution", kinds: ["http", "script"] },
]

export function WorkflowLibraryPanel({
  isOpen,
  presets,
  canEdit,
  hasStartNode,
  onAddPresetNode,
  onOpenChange,
}: {
  isOpen: boolean
  presets: Array<{ kind: WorkflowNodeData["kind"]; label: string; summary: string }>
  canEdit: boolean
  hasStartNode: boolean
  onAddPresetNode: (kind: WorkflowNodeData["kind"]) => void
  onOpenChange: (open: boolean) => void
}) {
  const groupedPresets = libraryGroups
    .map((group) => ({ title: group.title, items: presets.filter((item) => group.kinds.includes(item.kind)) }))
    .filter((group) => group.items.length > 0)

  if (!isOpen) {
    return (
      <div className="rounded-2xl border bg-card p-2 shadow-sm">
        <Button size="sm" variant="ghost" onClick={() => onOpenChange(true)}>
          <PanelLeftOpenIcon />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex max-h-[calc(100vh-10rem)] min-h-0 w-48 max-w-[calc(100vw-6rem)] flex-col gap-2 overflow-hidden rounded-xl border bg-background/95 p-2 shadow-xl">
      <div className="flex items-center justify-between gap-2 border-b px-1 pb-2 text-xs font-semibold">
        <span>Node library</span>
        <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
          <PanelLeftCloseIcon />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-2.5 pb-5">
          {groupedPresets.map((group) => (
            <div key={group.title} className="flex flex-col gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{group.title}</p>
              <div className="flex flex-col gap-1.5">
                {group.items.map((item) => {
                  const NodeIcon = WORKFLOW_NODE_ICONS[item.kind]
                  const disabled = !canEdit || (item.kind === "start" && hasStartNode)
                  return (
                    <button
                      key={item.kind}
                      type="button"
                      onClick={() => onAddPresetNode(item.kind)}
                      disabled={disabled}
                      title={item.summary}
                      aria-label={`${item.label}: ${item.summary}`}
                      className="flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <NodeIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

export function WorkflowDesignIssuesSummary({
  issues,
  onSelectNode,
}: {
  issues: WorkflowDesignIssue[]
  onSelectNode: (nodeId: string) => void
}) {
  if (issues.length === 0) {
    return null
  }

  return (
    <div className="border-b px-3 py-2">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Design issues</div>
      <div className="space-y-1.5">
        {issues.slice(0, 4).map((issue) => (
          <button
            key={`${issue.nodeId}-${issue.message}`}
            type="button"
            onClick={() => onSelectNode(issue.nodeId)}
            className={cn(
              "flex w-full items-start justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px]",
              issue.severity === "error"
                ? "border-destructive/35 bg-destructive/5 text-destructive"
                : "border-amber-500/35 bg-amber-500/5 text-amber-700 dark:text-amber-300"
            )}
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{issue.label}</span>
              <span className="block text-current/80">{issue.message}</span>
            </span>
            <span className="shrink-0 uppercase">{issue.severity}</span>
          </button>
        ))}
      </div>
    </div>
  )
}