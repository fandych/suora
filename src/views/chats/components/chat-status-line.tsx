import { Loader2Icon, WrenchIcon } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"
import type { ChatAgentEvent } from "@/services/ai-service"

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
    return {
      icon: <Loader2Icon className="size-3.5 animate-spin" />,
      label: `Processing ${lastEvent.toolName} result...`,
    }
  }

  return {
    icon: <Loader2Icon className="size-3.5 animate-spin" />,
    label: "Recovering from an error...",
  }
}

export function ChatStatusLine({ isResponding, toolEvents }: ChatStatusLineProps) {
  if (!isResponding) {
    return null
  }

  const status = getStatusCopy(toolEvents)

  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
      {status.icon}
      <span>{status.label}</span>
    </div>
  )
}