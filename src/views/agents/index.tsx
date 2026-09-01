import { useNavigate } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyCard, ErrorCard, LoadingCard } from "@/views/components/resource-state"
import PageHeader from "@/views/components/page-header"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { createAgent, listAgents } from "@/data/repositories/agent-repository"

const AgentsPage = () => {
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => listAgents(), [])

  const handleCreate = async () => {
    const detail = await createAgent()
    navigate(`/agents/${detail.agent.id}`)
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title="Agents" description="Manage agent definitions through the module-specific IPC bridge." actions={<Button onClick={handleCreate}>New agent</Button>} />
      <div className="flex-1 p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading agents..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data?.length === 0 ? <EmptyCard title="No agents yet" description="Create the first agent to manage prompts, model bindings, and related skills." /> : null}
          {!isLoading && !error && data?.length ? data.map((agent) => (
            <Card key={agent.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>{agent.title}</CardTitle>
                  <Badge variant="outline">{agent.kind}</Badge>
                </div>
                <CardDescription>{agent.summary || "No summary yet."}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => navigate(`/agents/${agent.id}`)}>Open agent</Button>
              </CardContent>
            </Card>
          )) : null}
        </div>
      </div>
    </div>
  )
}

export default AgentsPage