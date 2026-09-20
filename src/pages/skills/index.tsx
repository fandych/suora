import { useEffect } from "react"
import { useNavigate } from "react-router"

import { EmptyCard, ErrorCard, LoadingCard } from "@/pages/components/resource-state"
import PageHeader from "@/pages/components/page-header"
import { SummaryCardGrid } from "@/pages/components/summary-card-grid"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { subscribeToDataChanges } from "@/services/data-events"
import { SkillApi } from "@/services/skill-service"
import { SkillCard } from "@/pages/skills/components/skill-card"

const SkillsPage = () => {
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => SkillApi.list(), [])

  useEffect(
    () =>
      subscribeToDataChanges((route) => {
        if (route === "/skills") {
          reload()
        }
      }),
    [reload],
  )

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title="Skills" />

      <div className="flex-1 overflow-x-hidden p-6">
        <div className="flex w-full min-w-0 flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading skills..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data?.length ? (
            <SummaryCardGrid
              emptyTitle="No skills yet"
              emptyDescription="Create the first skill package to store prompt files."
              items={data}
              renderItem={(skill) => (
                <SkillCard key={skill.id} skill={skill} onOpen={(nextSkillId) => navigate(`/skills/${nextSkillId}`)} />
              )}
            />
          ) : null}
          {!isLoading && !error && data?.length === 0 ? (
            <EmptyCard
              title="No skills yet"
              description="Create the first skill package to store prompt files."
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default SkillsPage
