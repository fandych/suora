import { useNavigate } from "react-router"

import { EmptyCard, ErrorCard, LoadingCard } from "@/views/components/resource-state"
import PageHeader from "@/views/components/page-header"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { listModelProviders } from "@/data/repositories/model-config-repository"
import { ProviderCard } from "@/views/models/components/provider-card"

const ModelsPage = () => {
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => listModelProviders(), [])
  const providers = data ?? []

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title="Models" />

      <div className="flex-1 overflow-x-hidden p-6">
        <div className="flex w-full min-w-0 flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading provider configs..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && providers.length === 0 ? <EmptyCard title="No providers available" description="Add a provider from the secondary sidebar to configure its models." /> : null}
          {!isLoading && !error && providers.length
            ? <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {providers.map((provider) => (
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