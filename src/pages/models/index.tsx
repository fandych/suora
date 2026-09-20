import { useEffect } from "react"
import { useNavigate } from "react-router"

import { EmptyCard, ErrorCard, LoadingCard } from "@/pages/components/resource-state"
import PageHeader from "@/pages/components/page-header"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { ModelApi } from "@/services/model-service"
import { subscribeToDataChanges } from "@/services/data-events"
import { ProviderCard } from "@/pages/models/components/provider-card"

const ModelsPage = () => {
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => ModelApi.listConfigured(), [])
  const providers = data ?? []

  useEffect(
    () =>
      subscribeToDataChanges((route) => {
        if (route === "/models") {
          reload()
        }
      }),
    [reload],
  )

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title="Models" />

      <div className="flex-1 overflow-x-hidden p-6">
        <div className="flex w-full min-w-0 flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading provider configs..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && providers.length === 0 ? (
            <EmptyCard
              title="No configured providers"
              description="Configure and enable a provider with at least one model to see it here."
            />
          ) : null}
          {!isLoading && !error && providers.length ? (
            <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {providers.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  onOpen={(providerId) => navigate(`/models/${providerId}`)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ModelsPage
