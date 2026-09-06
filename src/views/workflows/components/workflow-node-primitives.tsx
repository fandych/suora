import type { ReactNode } from "react"
import { LoaderCircleIcon } from "lucide-react"
import { Handle, type HandleProps } from "@xyflow/react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type WorkflowNodeStatus = "queued" | "running" | "success" | "error" | "skipped" | undefined

export function WorkflowNodeShell({ children, className }: { children: ReactNode; className: string }) {
  return <div tabIndex={0} className={cn("relative w-64 rounded-3xl border shadow-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/50", className)}>{children}</div>
}

export function WorkflowNodeHandle(props: HandleProps) {
  return <Handle {...props} className={cn("z-20! h-2.5! w-2.5! border-0! bg-border!", props.className)} />
}

export function WorkflowNodeStatusBadge({ status }: { status: WorkflowNodeStatus }) {
  if (!status) return null
  const label = status === "success" ? "Succeeded" : status === "error" ? "Failed" : status === "skipped" ? "Skipped" : status === "queued" ? "Waiting" : "Running"
  return <Badge variant={status === "error" ? "destructive" : "outline"} role="status" aria-label={`Node status: ${label}`} className="gap-1 capitalize">{status === "running" ? <LoaderCircleIcon className="size-3 animate-spin text-sky-600" /> : null}{label}</Badge>
}
