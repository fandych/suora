import { useNavigate } from "react-router"

import { EmptyCard, ErrorCard, LoadingCard } from "@/views/components/resource-state"
import PageHeader from "@/views/components/page-header"
import { SummaryCardGrid } from "@/views/components/summary-card-grid"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { listAgents } from "@/data/repositories/agent-repository"
import { AgentCard } from "@/views/agents/components/agent-card"

const AgentsPage = () => {
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => listAgents(), [])

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title="Agents" description="Manage agent definitions through the module-specific IPC bridge." />
      <div className="flex-1 overflow-x-hidden p-6">
        <div className="flex w-full min-w-0 flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading agents..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data?.length ? <SummaryCardGrid emptyTitle="No agents yet" emptyDescription="Create the first agent to manage prompts, model bindings, and related skills." items={data} renderItem={(agent) => <AgentCard key={agent.id} agent={agent} onOpen={(agentId) => navigate(`/agents/${agentId}`)} />} /> : null}
          {!isLoading && !error && data?.length === 0 ? <EmptyCard title="No agents yet" description="Create the first agent to manage prompts, model bindings, and related skills." /> : null}
        </div>
      </div>
    </div>
  )
}

export default AgentsPage