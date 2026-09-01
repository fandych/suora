import { useNavigate } from "react-router"

import { EmptyCard, ErrorCard, LoadingCard } from "@/views/components/resource-state"
import PageHeader from "@/views/components/page-header"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { listModelProviders } from "@/data/repositories/model-config-repository"
import { ModelsOverview } from "@/views/models/components/models-overview"
import { ProviderCard } from "@/views/models/components/provider-card"

const ModelsPage = () => {
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => listModelProviders(), [])
  const configuredProviders = data?.filter((provider) => provider.apiKey.trim().length > 0) ?? []

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title="Models"
        description="Manage provider endpoints, API credentials, and the model catalog exposed to the rest of the workspace."
      />

      <div className="flex-1 overflow-x-hidden p-6">
        <div className="flex w-full min-w-0 flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading provider configs..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && configuredProviders.length ? <ModelsOverview providers={configuredProviders} /> : null}
          {!isLoading && !error && configuredProviders.length === 0 ? <EmptyCard title="No configured providers yet" description="Add a provider from the secondary sidebar and configure its API key to surface it here." /> : null}
          {!isLoading && !error && configuredProviders.length
            ? <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {configuredProviders.map((provider) => (
                <ProviderCard key={provider.id} provider={provider} onOpen={(providerId) => navigate(`/models/${providerId}`)} />
              ))}
            </div>
            : null}
        </div>
      </div>
    </div>
  )
}

export default ModelsPage