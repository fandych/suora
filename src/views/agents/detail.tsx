import { useEffect, useState } from "react"
import { useParams } from "react-router"

import { useAsyncResource } from "@/hooks/use-async-resource"
import type { AgentDetail } from "@/data/domain/models"
import { getAgentDetail, saveAgentDraft } from "@/data/repositories/agent-repository"
import { listDocuments } from "@/data/repositories/document-repository"
import { listIntegrationSummaries } from "@/data/repositories/integration-repository"
import { listConfiguredModelProviders } from "@/data/repositories/model-config-repository"
import { listSkills } from "@/data/repositories/skill-repository"
import { listWorkflows } from "@/data/repositories/workflow-repository"
import { Badge } from "@/components/ui/badge"
import { AgentLogoBadge } from "@/views/agents/components/agent-logo-badge"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import VersionSelect from "@/views/components/version-select"
import { AgentBindingsForm } from "@/views/agents/components/agent-bindings-form"
import { AgentGeneralPanel } from "@/views/agents/components/agent-general-panel"

const AgentsDetailPage = () => {
  const { agentId } = useParams<{ agentId: string }>()
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>()
  const { data, error, isLoading, reload, setData } = useAsyncResource(() => getAgentDetail(agentId ?? "", selectedVersionId), [agentId, selectedVersionId])
  const { data: providersData } = useAsyncResource(() => listConfiguredModelProviders(), [])
  const { data: skillsData } = useAsyncResource(() => listSkills(), [])
  const { data: integrationsData } = useAsyncResource(() => listIntegrationSummaries(), [])
  const { data: documentsData } = useAsyncResource(() => listDocuments(), [])
  const { data: workflowsData } = useAsyncResource(() => listWorkflows(), [])
  const [draft, setDraft] = useState<AgentDetail | null>(null)
  const providers = providersData ?? []
  const skills = skillsData ?? []
  const integrations = integrationsData ?? []
  const documents = documentsData ?? []
  const workflows = workflowsData ?? []
  const isReadOnly = Boolean(draft?.selectedVersion.isRelease)

  useEffect(() => {
    if (!data) {
      return
    }

    setDraft({
      ...data,
      config: {
        ...data.config,
        workflowIds: data.config.workflowIds ?? [],
        documentIds: data.config.documentIds ?? [],
      },
    })
  }, [data])

  const syncDraft = (next: AgentDetail) => {
    setData(next)
    setDraft({
      ...next,
      config: {
        ...next.config,
        workflowIds: next.config.workflowIds ?? [],
        documentIds: next.config.documentIds ?? [],
      },
    })
    setSelectedVersionId(next.selectedVersion.id)
  }

  const handleSave = async () => {
    if (!draft || isReadOnly) {
      return
    }

    const next = await saveAgentDraft(draft, false)
    syncDraft(next)
  }

  const handleToggleBinding = async (section: "workflows" | "integrations" | "skills" | "documents", itemId: string, checked: boolean) => {
    if (!draft || isReadOnly) {
      return
    }

    const toggleIds = (items: string[]) => checked ? (items.includes(itemId) ? items : [...items, itemId]) : items.filter((item) => item !== itemId)
    const nextDraft: AgentDetail = {
      ...draft,
      config: {
        ...draft.config,
        workflowIds: section === "workflows" ? toggleIds(draft.config.workflowIds ?? []) : (draft.config.workflowIds ?? []),
        toolsetIds: section === "integrations" ? toggleIds(draft.config.toolsetIds) : draft.config.toolsetIds,
        skillIds: section === "skills" ? toggleIds(draft.config.skillIds) : draft.config.skillIds,
        documentIds: section === "documents" ? toggleIds(draft.config.documentIds ?? []) : (draft.config.documentIds ?? []),
      },
    }

    setDraft(nextDraft)
    const saved = await saveAgentDraft(nextDraft, false)
    syncDraft(saved)
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={draft?.agent.title ?? "Agent"}
        leading={draft ? <AgentLogoBadge agent={draft.agent} className="size-9" iconClassName="size-4.5" /> : null}
        actions={draft ? (
          <>
            <Badge variant="outline">{draft.agent.source === "system" ? "System" : draft.agent.kind}</Badge>
            {draft.agent.isDisabled ? <Badge variant="secondary">Disabled</Badge> : null}
            <VersionSelect versions={draft.versions} value={selectedVersionId ?? draft.selectedVersion.id} onChange={setSelectedVersionId} />
          </>
        ) : null}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden p-4">
        <div className="grid min-h-0 w-full min-w-0 flex-1 gap-3 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          {isLoading ? <LoadingCard title="Loading agent..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && draft ? (
            <>
              <AgentGeneralPanel draft={draft} isReadOnly={isReadOnly} models={providers} onChange={setDraft} onSave={() => void handleSave()} />
              <AgentBindingsForm documents={documents} draft={draft} integrations={integrations} isReadOnly={isReadOnly} onToggle={(section, itemId, checked) => { void handleToggleBinding(section, itemId, checked) }} skills={skills} workflows={workflows} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default AgentsDetailPage
