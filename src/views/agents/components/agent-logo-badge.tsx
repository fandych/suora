import { BotIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { AgentSummary } from "@/data/domain/models"

type AgentLogoBadgeProps = {
  agent: Pick<AgentSummary, "source" | "isDisabled">
  className?: string
  iconClassName?: string
}

function getAgentBrandClassName(agent: Pick<AgentSummary, "source" | "isDisabled">) {
  if (agent.isDisabled) {
    return "text-muted-foreground"
  }

  return agent.source === "system" ? "text-sky-600" : "text-amber-600"
}

export function AgentLogoBadge({ agent, className, iconClassName }: AgentLogoBadgeProps) {
  return (
    <span className={cn("flex size-10 items-center justify-center rounded-xl border border-border bg-background", className)}>
      <BotIcon className={cn("size-5 shrink-0", getAgentBrandClassName(agent), iconClassName)} />
    </span>
  )
}