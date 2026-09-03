import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { EmptyCard, ErrorCard, LoadingCard } from "@/views/components/resource-state"
import PageHeader from "@/views/components/page-header"
import { SummaryCardGrid } from "@/views/components/summary-card-grid"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { createWorkflow, listWorkflows } from "@/data/repositories/workflow-repository"
import { WorkflowCard } from "@/views/workflows/components/workflow-card"

const WorkflowsPage = () => {
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => listWorkflows(), [])

  const handleCreate = async () => {
    const detail = await createWorkflow()
    navigate(`/workflows/${detail.workflow.id}`)
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title="Workflows"
        actions={<Button onClick={handleCreate}>New workflow</Button>}
      />

      <div className="flex-1 p-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading workflows..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data?.length
            ? <SummaryCardGrid emptyTitle="No workflows yet" emptyDescription="Create the first workflow to start building a reusable execution graph." items={data} renderItem={(workflow) => <WorkflowCard key={workflow.id} workflow={workflow} onOpen={(workflowId) => navigate(`/workflows/${workflowId}`)} />} />
            : null}
          {!isLoading && !error && data?.length === 0 ? <EmptyCard title="No workflows yet" description="Create the first workflow to start building a reusable execution graph." /> : null}
        </div>
      </div>
    </div>
  )
}

export default WorkflowsPage