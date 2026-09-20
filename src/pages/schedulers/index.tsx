import { useEffect } from "react"
import { useNavigate } from "react-router"

import { SchedulerApi } from "@/services/scheduler-service"
import { useAsyncResource } from "@/hooks/use-async-resource"
import PageHeader from "@/pages/components/page-header"
import { EmptyCard, ErrorCard, LoadingCard } from "@/pages/components/resource-state"
import { SummaryCardGrid } from "@/pages/components/summary-card-grid"
import { subscribeToDataChanges } from "@/services/data-events"
import { SchedulerCard } from "@/pages/schedulers/components/scheduler-card"

const SchedulersPage = () => {
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => SchedulerApi.listAll(), [])

  useEffect(
    () =>
      subscribeToDataChanges((route) => {
        if (route === "/schedulers") {
          reload()
        }
      }),
    [reload],
  )

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title="Schedulers" />
      <div className="flex-1 overflow-x-hidden p-6">
        <div className="flex w-full min-w-0 flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading schedulers..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data?.length ? (
            <SummaryCardGrid
              emptyTitle="No schedulers yet"
              emptyDescription="Create the first scheduler configuration."
              items={data}
              renderItem={(scheduler) => (
                <SchedulerCard
                  key={scheduler.id}
                  scheduler={scheduler}
                  onOpen={(schedulerId) => navigate(`/schedulers/${schedulerId}`)}
                />
              )}
            />
          ) : null}
          {!isLoading && !error && data?.length === 0 ? (
            <EmptyCard title="No schedulers yet" description="Create the first scheduler configuration." />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default SchedulersPage
