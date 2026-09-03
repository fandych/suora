import { CircleAlertIcon, CircleCheckIcon, CopyIcon, Loader2Icon, RotateCcwIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { showToast } from "@/lib/app-toast"
import { cn } from "@/lib/utils"

export type ChatToolActivity = {
  id: string
  toolName: string
  input?: Record<string, unknown>
  output?: string
  error?: string
}

type ChatToolEventItemProps = {
  activity: ChatToolActivity
  onRetry?: (activity: ChatToolActivity) => Promise<void> | void
  stepLabel?: string
}

function buildStorageKey(activity: ChatToolActivity) {
  return `suora:chat-tool-trace:${activity.toolName}:${JSON.stringify(activity.input ?? {})}`
}

export function ChatToolEventItem({ activity, onRetry, stepLabel }: ChatToolEventItemProps) {
  const status = activity.error ? "error" : activity.output ? "success" : "running"
  const Icon = status === "error" ? CircleAlertIcon : status === "success" ? CircleCheckIcon : Loader2Icon
  const badgeVariant = status === "error" ? "destructive" : status === "success" ? "secondary" : "outline"
  const storageKey = useMemo(() => buildStorageKey(activity), [activity])
  const [isOpen, setIsOpen] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const summary = status === "error"
    ? `Failed ${activity.toolName}`
    : status === "success"
      ? `Completed ${activity.toolName}`
      : `Executing ${activity.toolName}`

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey)
    if (stored == null) {
      setIsOpen(false)
      return
    }

    setIsOpen(stored === "1")
  }, [storageKey])

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    window.localStorage.setItem(storageKey, open ? "1" : "0")
  }

  const handleCopy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value)
    showToast({ title: `${label} copied`, description: `${activity.toolName} ${label.toLowerCase()} copied to clipboard.`, type: "success", timeout: 2000 })
  }

  const handleRetry = async () => {
    if (!onRetry) {
      return
    }

    setIsRetrying(true)
    try {
      await onRetry(activity)
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <div className={cn(
        "rounded-lg border px-2.5 py-2",
        status === "error" ? "border-destructive/35 bg-destructive/8" : status === "success" ? "border-emerald-200 bg-emerald-50/60" : "border-border bg-background/70"
      )}>
        <div className="flex items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Icon className={cn(status === "running" ? "animate-spin" : "", "size-3.5 shrink-0")} />
              <span className="truncate text-xs font-medium text-foreground">{summary}</span>
              {stepLabel ? <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{stepLabel}</span> : null}
              <Badge variant={badgeVariant}>{status === "error" ? "Error" : status === "success" ? "Success" : "Running"}</Badge>
            </div>
          </div>
          {activity.input ? <Button size="icon-sm" variant="ghost" type="button" onClick={() => void handleCopy(JSON.stringify(activity.input, null, 2), "Input")}> <CopyIcon /> </Button> : null}
          {activity.output ? <Button size="icon-sm" variant="ghost" type="button" onClick={() => void handleCopy(activity.output, "Output")}> <CopyIcon /> </Button> : null}
          {onRetry ? <Button size="icon-sm" variant="ghost" type="button" onClick={() => void handleRetry()} disabled={isRetrying}> <RotateCcwIcon /> </Button> : null}
          {(activity.input || activity.output || activity.error) ? (
            <CollapsibleTrigger className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              {isOpen ? "Hide details" : "Details"}
            </CollapsibleTrigger>
          ) : null}
        </div>
        {(activity.input || activity.output || activity.error) ? (
          <CollapsibleContent>
            <div className="mt-3 flex flex-col gap-3 border-t pt-3">
              {activity.input ? (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Input</div>
                  <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-3 text-xs leading-6 text-foreground">{JSON.stringify(activity.input, null, 2)}</pre>
                </div>
              ) : null}
              {activity.output ? (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Output</div>
                  <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-3 text-xs leading-6 text-foreground">{activity.output}</pre>
                </div>
              ) : null}
              {activity.error ? (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-destructive">Error</div>
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs leading-6 text-destructive">{activity.error}</div>
                </div>
              ) : null}
            </div>
          </CollapsibleContent>
        ) : null}
      </div>
    </Collapsible>
  )
}