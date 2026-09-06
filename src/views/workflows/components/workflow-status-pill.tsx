import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

export function WorkflowStatusPill({
  title,
  versionLabel,
  nodeCount,
  isDraft,
  hasUnsavedChanges,
  issueCount,
}: {
  title: string
  versionLabel: string
  nodeCount: number
  isDraft?: boolean
  hasUnsavedChanges?: boolean
  issueCount?: number
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border bg-background/92 px-3 py-1.5 backdrop-blur">
      <span className="text-[11px] font-medium">{title}</span>
      <Separator orientation="vertical" className="h-3" />
      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{versionLabel}</Badge>
      <Badge variant={hasUnsavedChanges ? "secondary" : isDraft ? "outline" : "default"} className="h-5 px-1.5 text-[10px]">{hasUnsavedChanges ? "Unsaved" : isDraft ? "Draft" : "Published"}</Badge>
      {issueCount ? <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{issueCount} issues</Badge> : null}
      <span className="text-[10px] text-muted-foreground">{nodeCount} nodes</span>
    </div>
  )
}