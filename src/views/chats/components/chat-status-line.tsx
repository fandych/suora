import { AlertTriangleIcon, Clock3Icon, Loader2Icon, ShieldAlertIcon, WrenchIcon } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"
import { getChatErrorPresentation } from "@/data/domain/chat/chat-error-state"
import type { ChatAgentEvent } from "@/services/chat/types"

type ChatStatusLineProps = {
  isResponding: boolean
  toolEvents: ChatAgentEvent[]
}

function getStatusCopy(toolEvents: ChatAgentEvent[]) {
  const lastEvent = toolEvents[toolEvents.length - 1]

  if (!lastEvent) {
    return {
      icon: <Spinner className="size-3.5" />,
      label: "Thinking...",
    }
  }

  if (lastEvent.type === "tool-call") {
    return {
      icon: <WrenchIcon className="size-3.5" />,
      label: `Executing ${lastEvent.toolName}...`,
    }
  }

  if (lastEvent.type === "tool-result") {
    return lastEvent.toolName === "browser_navigate"
      ? {
          icon: <Spinner className="size-3.5" />,
          label: "浏览器操作已完成，正在继续分析...",
          tone: "neutral",
        }
      : {
          icon: <Loader2Icon className="size-3.5 animate-spin" />,
          label: `Processing ${lastEvent.toolName} result...`,
          tone: "neutral",
        }
  }

  if (lastEvent.type !== "error") {
    return {
      icon: <Spinner className="size-3.5" />,
      label: "Thinking...",
      tone: "neutral",
    }
  }

  const presentation = getChatErrorPresentation(lastEvent.error, lastEvent.errorKind)
  return {
    icon: lastEvent.errorKind === "timeout"
      ? <Clock3Icon className="size-3.5" />
      : lastEvent.errorKind === "permission"
        ? <ShieldAlertIcon className="size-3.5" />
        : <AlertTriangleIcon className="size-3.5" />,
    label: presentation.title,
    detail: presentation.label,
    tone: lastEvent.errorKind === "step-limit" ? "warning" : "error",
  }
}

export function ChatStatusLine({ isResponding, toolEvents }: ChatStatusLineProps) {
  if (!isResponding && toolEvents[toolEvents.length - 1]?.type !== "error") {
    return null
  }

  const status = getStatusCopy(toolEvents)

  return (
    <div className={status.tone === "error"
      ? "flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-2.5 py-2 text-xs text-destructive"
      : status.tone === "warning"
        ? "flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-100/70 px-2.5 py-2 text-xs text-amber-900"
        : "flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground"}>
      {status.icon}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span>{status.label}</span>
        </div>
        {status.detail ? <div className="mt-0.5 text-[11px] opacity-90">{status.detail}</div> : null}
      </div>
    </div>
  )
}