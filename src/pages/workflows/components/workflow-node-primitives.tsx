import type { ReactNode } from "react"
import { Handle, type HandleProps } from "@xyflow/react"

import { cn } from "@/lib/utils"

export function WorkflowNodeShell({ children, className }: { children: ReactNode; className: string }) {
  return (
    <div
      tabIndex={0}
      className={cn(
        "relative w-64 rounded-3xl border shadow-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function WorkflowNodeHandle(props: HandleProps) {
  return (
    <Handle
      {...props}
      className={cn(
        "z-20! h-3! w-3! border-2! border-background! bg-primary! shadow-sm transition-transform duration-150 hover:scale-125!",
        props.className,
      )}
    />
  )
}
