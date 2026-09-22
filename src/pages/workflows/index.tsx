import { useEffect } from "react"
import { useNavigate } from "react-router"

import { EmptyCard, ErrorCard, LoadingCard } from "@/pages/components/resource-state"
import PageHeader from "@/pages/components/page-header"
import { SummaryCardGrid } from "@/pages/components/summary-card-grid"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { useAppIntl } from "@/lib/i18n"
import { subscribeToDataChanges } from "@/services/data-events"
import { WorkflowApi } from "@/services/workflow-service"
import { WorkflowCard } from "@/pages/workflows/components/workflow-card"

const WorkflowsPage = () => {
  const { t } = useAppIntl()
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => WorkflowApi.listAll(), [])

  useEffect(
    () =>
      subscribeToDataChanges((route) => {
        if (route === "/workflows") {
          reload()
        }
      }),
    [reload],
  )

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title={t("workflows.page.title", "Workflows")} />

      <div className="flex-1 p-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          {isLoading ? <LoadingCard title={t("workflows.page.loading", "Loading workflows...")} /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data?.length ? (
            <SummaryCardGrid
              emptyTitle={t("workflows.page.empty.title", "No workflows yet")}
              emptyDescription={t(
                "workflows.page.empty.description",
                "Create the first workflow to start building a reusable execution graph.",
              )}
              items={data}
              renderItem={(workflow) => (
                <WorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                  onOpen={(workflowId) => navigate(`/workflows/${workflowId}`)}
                />
              )}
            />
          ) : null}
          {!isLoading && !error && data?.length === 0 ? (
            <EmptyCard
              title={t("workflows.page.empty.title", "No workflows yet")}
              description={t(
                "workflows.page.empty.description",
                "Create the first workflow to start building a reusable execution graph.",
              )}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default WorkflowsPage
