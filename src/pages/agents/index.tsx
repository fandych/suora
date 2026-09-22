import { useEffect, useMemo } from "react"
import { useNavigate } from "react-router"

import { EmptyCard, ErrorCard, LoadingCard } from "@/pages/components/resource-state"
import PageHeader from "@/pages/components/page-header"
import { SummaryCardGrid } from "@/pages/components/summary-card-grid"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { useAppIntl } from "@/lib/i18n"
import { AgentApi } from "@/services/agent-service"
import { subscribeToDataChanges } from "@/services/data-events"
import { AgentCard } from "@/pages/agents/components/agent-card"

const AgentsPage = () => {
  const { t } = useAppIntl()
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => AgentApi.listAll(), [])

  useEffect(
    () =>
      subscribeToDataChanges((route) => {
        if (route === "/agents") {
          reload()
        }
      }),
    [reload],
  )

  const orderedAgents = useMemo(() => {
    const agents = data ?? []
    const customAgents = agents.filter((agent) => agent.source === "custom")
    const systemAgents = agents.filter((agent) => agent.source !== "custom")
    return [...customAgents, ...systemAgents]
  }, [data])

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title={t("agents.page.title", "Agents")} />
      <div className="flex-1 overflow-x-hidden p-6">
        <div className="flex w-full min-w-0 flex-col gap-4">
          {isLoading ? <LoadingCard title={t("agents.page.loading", "Loading agents...")} /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && orderedAgents.length ? (
            <SummaryCardGrid
              emptyTitle={t("agents.page.empty.title", "No agents yet")}
              emptyDescription={t(
                "agents.page.empty.description",
                "Create the first agent to manage prompts, model bindings, and related skills.",
              )}
              items={orderedAgents}
              renderItem={(agent) => (
                <AgentCard key={agent.id} agent={agent} onOpen={(agentId) => navigate(`/agents/${agentId}`)} />
              )}
            />
          ) : null}
          {!isLoading && !error && orderedAgents.length === 0 ? (
            <EmptyCard
              title={t("agents.page.empty.title", "No agents yet")}
              description={t(
                "agents.page.empty.description",
                "Create the first agent to manage prompts, model bindings, and related skills.",
              )}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default AgentsPage
