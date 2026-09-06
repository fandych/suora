import type { ReactNode } from "react"
import { Handle, type HandleProps } from "@xyflow/react"

import { cn } from "@/lib/utils"

export function WorkflowNodeShell({ children, className }: { children: ReactNode; className: string }) {
  return <div tabIndex={0} className={cn("relative w-64 rounded-3xl border shadow-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/50", className)}>{children}</div>
}

export function WorkflowNodeHandle(props: HandleProps) {
  return <Handle {...props} className={cn("z-20! h-2.5! w-2.5! border-0! bg-border!", props.className)} />
}
