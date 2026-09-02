import { useEffect, useState } from "react"
import { useParams } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAsyncResource } from "@/hooks/use-async-resource"
import type { AgentDetail } from "@/data/domain/models"
import { getAgentDetail, saveAgentDraft } from "@/data/repositories/agent-repository"
import { listDocuments } from "@/data/repositories/document-repository"
import { listIntegrationSummaries } from "@/data/repositories/integration-repository"
import { listModelProviders } from "@/data/repositories/model-config-repository"
import { listSkills } from "@/data/repositories/skill-repository"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import VersionSelect from "@/views/components/version-select"
import { AgentBindingsForm } from "@/views/agents/components/agent-bindings-form"

const AgentsDetailPage = () => {
  const { agentId } = useParams<{ agentId: string }>()
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>()
  const { data, error, isLoading, reload, setData } = useAsyncResource(() => getAgentDetail(agentId ?? "", selectedVersionId), [agentId, selectedVersionId])
  const { data: providersData } = useAsyncResource(() => listModelProviders(), [])
  const { data: skillsData } = useAsyncResource(() => listSkills(), [])
  const { data: integrationsData } = useAsyncResource(() => listIntegrationSummaries(), [])
  const { data: documentsData } = useAsyncResource(() => listDocuments(), [])
  const [draft, setDraft] = useState<AgentDetail | null>(null)
  const providers = providersData ?? []
  const skills = skillsData ?? []
  const integrations = integrationsData ?? []
  const documents = documentsData ?? []
  const selectedProvider = providers.find((provider) => provider.id === draft?.config.providerId) ?? null
  const selectedModel = selectedProvider?.models.find((model) => model.id === draft?.config.modelId) ?? null
  const isReadOnly = Boolean(draft?.selectedVersion.isRelease)

  const getTitles = (ids: string[], items: Array<{ id: string; title: string }>) => ids.map((id) => items.find((item) => item.id === id)?.title ?? id)

  useEffect(() => {
    if (!data) {
      return
    }

    setDraft({
      ...data,
      config: {
        ...data.config,
        documentIds: data.config.documentIds ?? [],
      },
    })
  }, [data])

  const handleSave = async (publish = false) => {
    if (!draft) {
      return
    }

    const next = await saveAgentDraft(draft, publish)
    setData(next)
    setDraft({
      ...next,
      config: {
        ...next.config,
        documentIds: next.config.documentIds ?? [],
      },
    })
    setSelectedVersionId(next.selectedVersion.id)
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={draft?.agent.title ?? "Agent"}
        description={isReadOnly ? "Release versions are locked. Switch to a draft version to change bindings and instructions." : "Bind a default model plus the skills, integrations, and documents this agent can rely on."}
        actions={draft ? <VersionSelect versions={draft.versions} value={selectedVersionId ?? draft.selectedVersion.id} onChange={setSelectedVersionId} /> : null}
      />
      <div className="flex-1 overflow-x-hidden p-4">
        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          {isLoading ? <LoadingCard title="Loading agent..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && draft ? (
            <>
              <AgentBindingsForm documents={documents} draft={draft} integrations={integrations} isReadOnly={isReadOnly} models={providers} onChange={setDraft} skills={skills} />
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle>Binding summary</CardTitle>
                    <Badge variant="outline">{draft.agent.kind}</Badge>
                    <Badge variant={isReadOnly ? "outline" : "secondary"}>{isReadOnly ? "Release" : "Draft"}</Badge>
                  </div>
                  <CardDescription>Review the currently selected runtime dependencies for this agent.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Selected version</div>
                    <div className="font-medium">{draft.selectedVersion.label}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Default provider / model</div>
                    <div className="font-medium">{selectedProvider?.title || "None"} / {selectedModel?.name || "None"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Bound skills</div>
                    <div className="font-medium">{draft.config.skillIds.length ? getTitles(draft.config.skillIds, skills).join(", ") : "None"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Bound integrations</div>
                    <div className="font-medium">{draft.config.toolsetIds.length ? getTitles(draft.config.toolsetIds, integrations).join(", ") : "None"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Bound documents</div>
                    <div className="font-medium">{draft.config.documentIds?.length ? getTitles(draft.config.documentIds, documents).join(", ") : "None"}</div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button disabled={isReadOnly} onClick={() => void handleSave(false)}>Save draft</Button>
                    <Button variant="outline" onClick={() => void handleSave(true)}>Publish</Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default AgentsDetailPage
