import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyCard, ErrorCard, LoadingCard } from "@/views/components/resource-state"
import PageHeader from "@/views/components/page-header"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { createWorkflow, listWorkflows } from "@/data/repositories/workflow-repository"

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
        description="Model multi-step operational flows and publish release versions."
        actions={<Button onClick={handleCreate}>New workflow</Button>}
      />

      <div className="flex-1 p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading workflows..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data?.length === 0 ? (
            <EmptyCard title="No workflows yet" description="Create the first workflow to start building a reusable execution graph." />
          ) : null}
          {!isLoading && !error && data?.length
            ? data.map((workflow) => (
                <Card key={workflow.id}>
                  <CardHeader>
                    <CardTitle>{workflow.title}</CardTitle>
                    <CardDescription>{workflow.summary || "No summary yet."}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" onClick={() => navigate(`/workflows/${workflow.id}`)}>
                      Open workflow
                    </Button>
                  </CardContent>
                </Card>
              ))
            : null}
        </div>
      </div>
    </div>
  )
}

export default WorkflowsPage