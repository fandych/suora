import { useNavigate } from "react-router"

import { listSchedulers } from "@/data/repositories/scheduler-repository"
import { useAsyncResource } from "@/hooks/use-async-resource"
import PageHeader from "@/views/components/page-header"
import { EmptyCard, ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { SummaryCardGrid } from "@/views/components/summary-card-grid"
import { SchedulerCard } from "@/views/schedulers/components/scheduler-card"

const SchedulersPage = () => {
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => listSchedulers(), [])

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title="Schedulers" />
      <div className="flex-1 overflow-x-hidden p-6">
        <div className="flex w-full min-w-0 flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading schedulers..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data?.length ? <SummaryCardGrid emptyTitle="No schedulers yet" emptyDescription="Create the first scheduler configuration." items={data} renderItem={(scheduler) => <SchedulerCard key={scheduler.id} scheduler={scheduler} onOpen={(schedulerId) => navigate(`/schedulers/${schedulerId}`)} />} /> : null}
          {!isLoading && !error && data?.length === 0 ? <EmptyCard title="No schedulers yet" description="Create the first scheduler configuration." /> : null}
        </div>
      </div>
    </div>
  )
}

export default SchedulersPage