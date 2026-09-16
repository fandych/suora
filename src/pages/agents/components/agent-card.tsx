import type { AgentSummary } from "@/types/agent"
import { Badge } from "@/components/ui/badge"
import { AgentLogoBadge } from "@/pages/agents/components/agent-logo-badge"
import { BrandedResourceCard } from "@/pages/components/branded-resource-card"

type AgentCardProps = {
  agent: AgentSummary
  onOpen: (agentId: string) => void
}

export function AgentCard({ agent, onOpen }: AgentCardProps) {
  const kindLabel = agent.source === "system" ? "System" : agent.kind

  return (
    <BrandedResourceCard
      title={agent.title}
      description={agent.summary || "No description yet."}
      leading={<AgentLogoBadge agent={agent} />}
      badges={
        <>
          <Badge variant="outline">{kindLabel}</Badge>
          {agent.isDisabled ? <Badge variant="secondary">Disabled</Badge> : null}
        </>
      }
      actionLabel="Open agent"
      onOpen={() => onOpen(agent.id)}
      metrics={[
        { label: "Name", value: agent.title },
        { label: "Kind", value: kindLabel },
      ]}
    />
  )
}
