import { useEffect, useState } from "react"
import { useParams } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import PageHeader from "@/views/components/page-header"
import VersionSelect from "@/views/components/version-select"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { useAsyncResource } from "@/hooks/use-async-resource"
import type { AgentDetail } from "@/data/domain/models"
import { getAgentDetail, saveAgentDraft } from "@/data/repositories/agent-repository"

const AgentsDetailPage = () => {
  const { agentId } = useParams<{ agentId: string }>()
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>()
  const { data, error, isLoading, reload, setData } = useAsyncResource(() => getAgentDetail(agentId ?? ""), [agentId])
  const [draft, setDraft] = useState<AgentDetail | null>(null)

  useEffect(() => {
    if (data) {
      setDraft(data)
      setSelectedVersionId(data.selectedVersion.id)
    }
  }, [data])

  const handleSave = async (publish = false) => {
    if (!draft) {
      return
    }
    const next = await saveAgentDraft(draft, publish)
    setData(next)
    setDraft(next)
    setSelectedVersionId(next.selectedVersion.id)
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={draft?.agent.title ?? "Agent"}
        description="Agent config with versioned instructions, model binding, and attached skills/toolsets."
        actions={draft ? <VersionSelect versions={draft.versions} value={selectedVersionId ?? draft.selectedVersion.id} onChange={setSelectedVersionId} /> : null}
      />
      <div className="flex-1 p-6">
        <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          {isLoading ? <LoadingCard title="Loading agent..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && draft ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle>Agent config</CardTitle>
                    <Badge variant="outline">{draft.agent.kind}</Badge>
                  </div>
                  <CardDescription>Module-level bridge version after models and skills.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input value={draft.agent.title} onChange={(event) => setDraft({ ...draft, agent: { ...draft.agent, title: event.target.value } })} placeholder="Agent title" />
                    <NativeSelect value={draft.agent.kind} onChange={(event) => setDraft({ ...draft, agent: { ...draft.agent, kind: event.target.value } })}>
                      <NativeSelectOption value="builtin">Builtin</NativeSelectOption>
                      <NativeSelectOption value="custom">Custom</NativeSelectOption>
                    </NativeSelect>
                  </div>
                  <Input value={draft.agent.summary} onChange={(event) => setDraft({ ...draft, agent: { ...draft.agent, summary: event.target.value } })} placeholder="Agent summary" />
                  <Textarea value={draft.config.instructions} onChange={(event) => setDraft({ ...draft, config: { ...draft.config, instructions: event.target.value } })} rows={8} className="font-mono" />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input value={draft.config.providerId} onChange={(event) => setDraft({ ...draft, config: { ...draft.config, providerId: event.target.value } })} placeholder="Provider ID" />
                    <Input value={draft.config.modelId} onChange={(event) => setDraft({ ...draft, config: { ...draft.config, modelId: event.target.value } })} placeholder="Model ID" />
                  </div>
                  <Input value={draft.config.skillIds.join(", ")} onChange={(event) => setDraft({ ...draft, config: { ...draft.config, skillIds: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) } })} placeholder="Skill IDs" />
                  <Input value={draft.config.toolsetIds.join(", ")} onChange={(event) => setDraft({ ...draft, config: { ...draft.config, toolsetIds: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) } })} placeholder="Toolset IDs" />
                  <div className="flex gap-2">
                    <Button onClick={() => handleSave(false)}>Save draft</Button>
                    <Button variant="outline" onClick={() => handleSave(true)}>Publish</Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Version meta</CardTitle>
                  <CardDescription>Agent versions follow the same release/draft chain model.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Selected version</div>
                    <div className="font-medium">{draft.selectedVersion.label}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Latest visible</div>
                    <div className="font-medium">{draft.latestVersion.label}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Skills</div>
                    <div className="font-medium">{draft.config.skillIds.join(", ") || "None"}</div>
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