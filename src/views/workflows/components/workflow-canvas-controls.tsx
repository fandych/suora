import { useMemo, useState } from "react"
import { CircleAlertIcon, CircleCheckIcon, SearchIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import type { WorkflowDesignIssue } from "@/views/workflows/components/workflow-editor-state"
import type { WorkflowNodeData } from "@/data/domain/models"
import type { Node } from "@xyflow/react"

export function WorkflowNodeSearchControl({
  nodes,
  onNodeSelect,
}: {
  nodes: Node<WorkflowNodeData>[]
  onNodeSelect: (nodeId: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const results = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) {
      return []
    }

    return nodes.filter((node) => `${node.data.label} ${node.data.task ?? ""} ${node.data.description ?? ""} ${node.data.kind}`.toLowerCase().includes(keyword)).slice(0, 8)
  }, [nodes, query])

  if (!isOpen) {
    return (
      <Button type="button" variant="outline" size="icon-sm" className="bg-background/95 shadow-lg" aria-label="Search nodes" title="Search nodes" onClick={() => setIsOpen(true)}>
        <SearchIcon />
      </Button>
    )
  }

  return (
    <div className="w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border bg-background/95 p-2 shadow-xl">
      <div className="flex items-center gap-2">
        <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { setIsOpen(false); setQuery("") } }} placeholder="Search nodes" className="h-8 flex-1 text-xs" />
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close node search" title="Close node search" onClick={() => { setIsOpen(false); setQuery("") }}>
          <XIcon />
        </Button>
      </div>
      <div className="mt-2 max-h-56 overflow-y-auto">
        {results.length > 0 ? results.map((node) => (
          <button
            key={node.id}
            type="button"
            onClick={() => {
              onNodeSelect(node.id)
              setIsOpen(false)
            }}
            className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs hover:bg-muted"
          >
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{node.data.label}</span>
            <span className="ml-2 shrink-0 text-[10px] uppercase text-muted-foreground">{node.data.kind}</span>
          </button>
        )) : <div className="px-2 py-3 text-xs text-muted-foreground">{query.trim() ? "No matching nodes." : "Type to search nodes."}</div>}
      </div>
    </div>
  )
}

export function WorkflowIssuesControl({
  issues,
  onIssueSelect,
}: {
  issues: WorkflowDesignIssue[]
  onIssueSelect: (nodeId: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" className="bg-background/95 shadow-lg" />}>
        {issues.length > 0 ? <CircleAlertIcon className="text-amber-600" /> : <CircleCheckIcon className="text-emerald-600" />}
        {issues.length > 0 ? `${issues.length} issue${issues.length === 1 ? "" : "s"}` : "Ready"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-80 overflow-y-auto">
        {issues.length === 0 ? <DropdownMenuItem disabled>No design issues.</DropdownMenuItem> : issues.map((issue, index) => (
          <DropdownMenuItem key={`${issue.nodeId}-${index}`} onClick={() => onIssueSelect(issue.nodeId)}>
            <CircleAlertIcon className="text-amber-600" />
            <span className="whitespace-normal text-xs leading-5">{issue.message}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}