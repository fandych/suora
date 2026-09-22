import type { AgentSummary } from "@/types/agent"
import { Badge } from "@/components/ui/badge"
import { getLocalizedAgentSummary, getLocalizedAgentTitle } from "@/lib/agent-localization"
import { useAppIntl } from "@/lib/i18n"
import { AgentLogoBadge } from "@/pages/agents/components/agent-logo-badge"
import { BrandedResourceCard } from "@/pages/components/branded-resource-card"

type AgentCardProps = {
  agent: AgentSummary
  onOpen: (agentId: string) => void
}

export function AgentCard({ agent, onOpen }: AgentCardProps) {
  const { t } = useAppIntl()
  const title = getLocalizedAgentTitle(agent, t)
  const summary = getLocalizedAgentSummary(agent, t) || t("agents.card.noDescription", "No description yet.")
  const kindLabel = agent.source === "system" ? t("agents.card.system", "System") : agent.kind

  return (
    <BrandedResourceCard
      title={title}
      description={summary}
      leading={<AgentLogoBadge agent={agent} />}
      badges={
        <>
          <Badge variant="outline">{kindLabel}</Badge>
          {agent.isDisabled ? <Badge variant="secondary">{t("agents.card.disabled", "Disabled")}</Badge> : null}
        </>
      }
      actionLabel={t("agents.card.open", "Open agent")}
      onOpen={() => onOpen(agent.id)}
      metrics={[
        { label: t("agents.card.metric.name", "Name"), value: title },
        { label: t("agents.card.metric.kind", "Kind"), value: kindLabel },
      ]}
    />
  )
}
