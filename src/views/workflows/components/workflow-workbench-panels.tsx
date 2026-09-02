import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react"
import type { Node } from "@xyflow/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { WorkflowNodeData } from "@/data/domain/models"
import type { WorkflowDesignIssue } from "@/views/workflows/components/workflow-editor-state"

export function WorkflowLibraryPanel({
  isOpen,
  query,
  matchingNodes,
  presets,
  onQueryChange,
  onSelectNode,
  onAddNode,
  onAddPresetNode,
  onOpenChange,
}: {
  isOpen: boolean
  query: string
  matchingNodes: Node<WorkflowNodeData>[]
  presets: Array<{ kind: WorkflowNodeData["kind"]; label: string; summary: string }>
  onQueryChange: (value: string) => void
  onSelectNode: (nodeId: string) => void
  onAddNode: () => void
  onAddPresetNode: (kind: WorkflowNodeData["kind"]) => void
  onOpenChange: (open: boolean) => void
}) {
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
    <div className="flex max-h-[calc(100vh-10rem)] min-h-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Node library</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">Compact preset blocks for the current workflow.</div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
          <PanelLeftCloseIcon />
        </Button>
      </div>
      <div className="border-b px-3 py-2">
        <Input className="h-8 text-xs" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search presets or nodes" />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-2.5">
          {matchingNodes.length > 0 ? (
            <div className="space-y-1 rounded-xl border bg-muted/30 p-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Matching nodes</div>
              {matchingNodes.slice(0, 5).map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelectNode(node.id)}
                  className="flex w-full items-center justify-between rounded-lg border bg-background px-2.5 py-2 text-left text-[11px] transition-colors hover:border-primary/40"
                >
                  <span className="truncate font-medium text-foreground">{node.data.label}</span>
                  <span className="shrink-0 text-muted-foreground">{node.data.kind}</span>
                </button>
              ))}
            </div>
          ) : null}
          <Button size="sm" variant="outline" className="h-8 w-full justify-start text-xs" onClick={onAddNode}>Add blank node</Button>
          {presets.map((item) => (
            <button
              key={item.kind}
              type="button"
              onClick={() => onAddPresetNode(item.kind)}
              className="flex w-full flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="text-xs font-medium text-foreground">{item.label}</div>
              <div className="text-[11px] leading-4 text-muted-foreground">{item.summary}</div>
            </button>
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