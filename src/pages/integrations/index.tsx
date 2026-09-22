import { useEffect } from "react"
import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import PageHeader from "@/pages/components/page-header"
import { EmptyCard, LoadingCard } from "@/pages/components/resource-state"
import { SummaryCardGrid } from "@/pages/components/summary-card-grid"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { useAppIntl } from "@/lib/i18n"
import { IntegrationApi } from "@/services/integration-service"
import { subscribeToDataChanges } from "@/services/data-events"
import { showToast } from "@/services/toast-service"
import { IntegrationCard } from "@/pages/integrations/components/integration-card"

const IntegrationsPage = () => {
  const { t } = useAppIntl()
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => IntegrationApi.listAll(), [])

  useEffect(() => {
    if (!(error instanceof Error)) {
      return
    }

    showToast({
      title: t("integrations.toast.loadFailed", "Failed to load integration"),
      description: error.message,
      type: "error",
    })
  }, [error, t])

  useEffect(
    () =>
      subscribeToDataChanges((route) => {
        if (route === "/integrations") {
          reload()
        }
      }),
    [reload],
  )

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={t("integrations.page.title", "Integrations")}
        description={t("integrations.page.description", "Manage versioned HTTP, script, and MCP integrations.")}
      />

      <div className="flex-1 p-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          {isLoading || (!data && error) ? (
            <LoadingCard title={t("integrations.page.loading", "Loading integrations...")} />
          ) : null}
          {!isLoading && !data && error ? (
            <div className="flex justify-end">
              <Button variant="outline" onClick={reload}>
                {t("resource.error.retry", "Retry")}
              </Button>
            </div>
          ) : null}
          {!isLoading && data?.length ? (
            <SummaryCardGrid
              emptyTitle={t("integrations.page.empty.title", "No integrations yet")}
              emptyDescription={t(
                "integrations.page.empty.description",
                "Create an HTTP, script, or MCP integration and version it like the other runtime modules.",
              )}
              items={data}
              renderItem={(integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  onOpen={(integrationId) => navigate(`/integrations/${integrationId}`)}
                />
              )}
            />
          ) : null}
          {!isLoading && data?.length === 0 ? (
            <EmptyCard
              title={t("integrations.page.empty.title", "No integrations yet")}
              description={t(
                "integrations.page.empty.description",
                "Create an HTTP, script, or MCP integration and version it like the other runtime modules.",
              )}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default IntegrationsPage
