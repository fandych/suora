import { CircleAlertIcon, CircleCheckIcon, CopyIcon, Loader2Icon, RotateCcwIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { copyTextToClipboard } from "@/lib/browser/clipboard"
import { showToast } from "@/services/toast-service"
import { cn } from "@/lib/utils"
import type { ChatToolActivity } from "@/types/chat"

export type { ChatToolActivity }

type ChatToolEventItemProps = {
  activity: ChatToolActivity
  onRetry?: (activity: ChatToolActivity) => Promise<void> | void
  stepLabel?: string
}

function buildStorageKey(activity: ChatToolActivity) {
  return `suora:chat-tool-trace:v2:${activity.id}`
}

export function ChatToolEventItem({ activity, onRetry, stepLabel }: ChatToolEventItemProps) {
  const hasOutput = activity.output !== undefined
  const hasDetails = Boolean(activity.input || hasOutput || activity.error || activity.stopped)
  const status = activity.error ? "error" : activity.stopped ? "stopped" : hasOutput ? "success" : "running"
  const Icon =
    status === "error" || status === "stopped" ? CircleAlertIcon : status === "success" ? CircleCheckIcon : Loader2Icon
  const badgeVariant = status === "error" ? "destructive" : status === "success" ? "secondary" : "outline"
  const storageKey = useMemo(() => buildStorageKey(activity), [activity])
  const [isOpen, setIsOpen] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const summary =
    status === "error"
      ? `Failed ${activity.toolName}`
      : status === "stopped"
        ? `Stopped ${activity.toolName}`
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
  }, [status, storageKey])

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    window.localStorage.setItem(storageKey, open ? "1" : "0")
  }

  const handleCopy = async (value: string, label: string) => {
    try {
      await copyTextToClipboard(value)
      showToast({
        title: `${label} copied`,
        description: `${activity.toolName} ${label.toLowerCase()} copied to clipboard.`,
        type: "success",
        timeout: 2000,
      })
    } catch (error) {
      showToast({
        title: `${label} copy failed`,
        description: error instanceof Error ? error.message : String(error),
        type: "error",
        timeout: 3000,
      })
    }
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
      <div
        className={cn(
          "rounded-xl border px-2.5 py-2 shadow-xs transition-colors",
          status === "error"
            ? "border-destructive/35 bg-destructive/8"
            : status === "stopped"
              ? "border-amber-200 bg-amber-50/70"
              : status === "success"
                ? "border-emerald-200 bg-emerald-50/60"
                : "border-border bg-background/70",
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background/90",
              status === "error"
                ? "border-destructive/30 text-destructive"
                : status === "stopped"
                  ? "border-amber-300 text-amber-700"
                  : status === "success"
                    ? "border-emerald-300 text-emerald-700"
                    : "border-border text-foreground",
            )}
          >
            <Icon className={cn(status === "running" ? "animate-spin" : "", "size-3.5 shrink-0")} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Tool
              </span>
              <span className="truncate font-mono text-[12px] font-medium text-foreground">{activity.toolName}</span>
              {stepLabel ? (
                <span className="rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {stepLabel}
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate text-[11px] text-muted-foreground">{summary}</span>
              <Badge variant={badgeVariant}>
                {status === "error"
                  ? "Error"
                  : status === "success"
                    ? "Success"
                    : status === "stopped"
                      ? "Stopped"
                      : "Running"}
              </Badge>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onRetry ? (
              <Button
                size="icon-sm"
                variant="ghost"
                type="button"
                onClick={() => void handleRetry()}
                disabled={isRetrying}
              >
                <RotateCcwIcon />
              </Button>
            ) : null}
            {hasDetails ? (
              <CollapsibleTrigger className="rounded-md border border-border/80 bg-background/70 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                {isOpen ? "Hide details" : "Details"}
              </CollapsibleTrigger>
            ) : null}
          </div>
        </div>
        {hasDetails ? (
          <CollapsibleContent>
            <div className="mt-3 flex flex-col gap-2.5 border-t pt-2.5">
              {activity.input ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-md bg-muted/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Input
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      className="h-6 px-2 text-[11px] normal-case tracking-normal"
                      onClick={() => void handleCopy(JSON.stringify(activity.input, null, 2), "Input")}
                    >
                      <CopyIcon />
                      Copy
                    </Button>
                  </div>
                  <pre className="max-h-64 overflow-x-auto rounded-lg border border-border/80 bg-background/90 p-2.5 text-[11px] leading-5 text-foreground">
                    {JSON.stringify(activity.input, null, 2)}
                  </pre>
                </div>
              ) : null}
              {hasOutput ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-md bg-muted/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Output
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      className="h-6 px-2 text-[11px] normal-case tracking-normal"
                      onClick={() => void handleCopy(activity.output ?? "", "Output")}
                    >
                      <CopyIcon />
                      Copy
                    </Button>
                  </div>
                  <pre className="max-h-64 overflow-x-auto rounded-lg border border-border/80 bg-background/90 p-2.5 text-[11px] leading-5 text-foreground">
                    {activity.output}
                  </pre>
                </div>
              ) : null}
              {activity.error ? (
                <div className="flex flex-col gap-1.5">
                  <div className="rounded-md bg-destructive/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-destructive">
                    Error
                  </div>
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-[11px] leading-5 text-destructive">
                    {activity.error}
                  </div>
                </div>
              ) : null}
              {activity.stopped && !activity.error ? (
                <div className="flex flex-col gap-1.5">
                  <div className="rounded-md bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800">
                    Status
                  </div>
                  <div className="rounded-lg border border-amber-300 bg-amber-100/70 p-2.5 text-[11px] leading-5 text-amber-900">
                    Stopped before a tool result was returned.
                  </div>
                </div>
              ) : null}
            </div>
          </CollapsibleContent>
        ) : null}
      </div>
    </Collapsible>
  )
}
