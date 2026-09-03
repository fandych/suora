import { CircleAlertIcon, CircleCheckIcon, Loader2Icon, WrenchIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { ChatToolEventItem, type ChatToolActivity } from "@/views/chats/components/chat-tool-event-item"

type ChatToolActivityGroupProps = {
  activities: ChatToolActivity[]
  messageId?: string | null
  onRetryTool?: (messageId: string | null, activity: ChatToolActivity) => Promise<void> | void
}

function buildGroupStorageKey(activities: ChatToolActivity[]) {
  const ids = activities.map((activity) => activity.id).join(":")
  return `suora:chat-tool-group:${ids}`
}

function getGroupState(activities: ChatToolActivity[]) {
  const hasRunning = activities.some((activity) => activity.output === undefined && !activity.error && !activity.stopped)
  const hasStopped = activities.some((activity) => activity.stopped)
  const hasError = activities.some((activity) => Boolean(activity.error))

  if (hasRunning) {
    return {
      badge: "Running",
      badgeVariant: "outline" as const,
      className: "border-border bg-background/70",
      icon: Loader2Icon,
      iconClassName: "animate-spin",
      label: `Executing ${activities.length} tool${activities.length === 1 ? "" : "s"}`,
    }
  }

  if (hasError) {
    return {
      badge: "Error",
      badgeVariant: "destructive" as const,
      className: "border-destructive/35 bg-destructive/8",
      icon: CircleAlertIcon,
      iconClassName: "",
      label: `Completed ${activities.length} tool${activities.length === 1 ? "" : "s"} with errors`,
    }
  }

  if (hasStopped) {
    return {
      badge: "Stopped",
      badgeVariant: "outline" as const,
      className: "border-amber-200 bg-amber-50/70",
      icon: CircleAlertIcon,
      iconClassName: "",
      label: `Stopped ${activities.length} tool${activities.length === 1 ? "" : "s"}`,
    }
  }

  return {
    badge: "Success",
    badgeVariant: "secondary" as const,
    className: "border-emerald-200 bg-emerald-50/60",
    icon: CircleCheckIcon,
    iconClassName: "",
    label: `Completed ${activities.length} tool${activities.length === 1 ? "" : "s"}`,
  }
}

export function ChatToolActivityGroup({ activities, messageId = null, onRetryTool }: ChatToolActivityGroupProps) {
  const storageKey = useMemo(() => buildGroupStorageKey(activities), [activities])
  const [isOpen, setIsOpen] = useState(false)
  const groupState = getGroupState(activities)
  const Icon = groupState.icon

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

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <div className={cn("rounded-xl border", groupState.className)}>
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background/85 text-foreground shadow-xs">
              <WrenchIcon className="size-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Icon className={cn("size-3.5 shrink-0", groupState.iconClassName)} />
                <span className="truncate text-xs font-medium text-foreground">{groupState.label}</span>
                <Badge variant={groupState.badgeVariant}>{groupState.badge}</Badge>
              </div>
            </div>
          </div>
          <CollapsibleTrigger className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            {isOpen ? "Hide tools" : "Show tools"}
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="flex flex-col gap-2 border-t px-3 py-3">
            {activities.map((activity, index) => (
              <ChatToolEventItem
                key={activity.id}
                activity={activity}
                onRetry={onRetryTool ? (nextActivity) => onRetryTool(messageId, nextActivity) : undefined}
                stepLabel={activities.length > 1 ? `${index + 1}/${activities.length}` : undefined}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}