import { useEffect } from "react"
import { useNavigate } from "react-router"

import PageHeader from "@/views/components/page-header"
import { EmptyCard, ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { SummaryCardGrid } from "@/views/components/summary-card-grid"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { listIntegrationSummaries } from "@/data/repositories/integration-repository"
import { subscribeToDataChanges } from "@/data/repositories/data-events"
import { IntegrationCard } from "@/views/integrations/components/integration-card"

const IntegrationsPage = () => {
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => listIntegrationSummaries(), [])

  useEffect(() => subscribeToDataChanges((route) => {
    if (route === "/integrations") {
      reload()
    }
  }), [reload])

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title="Integrations"
        description="Manage versioned HTTP, script, and MCP integrations."
      />

      <div className="flex-1 p-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading integrations..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data?.length
            ? <SummaryCardGrid emptyTitle="No integrations yet" emptyDescription="Create an HTTP, script, or MCP integration and version it like the other runtime modules." items={data} renderItem={(integration) => <IntegrationCard key={integration.id} integration={integration} onOpen={(integrationId) => navigate(`/integrations/${integrationId}`)} />} />
            : null}
          {!isLoading && !error && data?.length === 0 ? <EmptyCard title="No integrations yet" description="Create an HTTP, script, or MCP integration and version it like the other runtime modules." /> : null}
        </div>
      </div>
    </div>
  )
}

export default IntegrationsPage