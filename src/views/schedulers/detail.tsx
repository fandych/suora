import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAsyncResource } from "@/hooks/use-async-resource"
import type { SchedulerDetail } from "@/data/domain/models"
import { listAvailableAgents } from "@/data/repositories/agent-repository"
import { getScheduler, saveScheduler } from "@/data/repositories/scheduler-repository"
import { listWorkflows } from "@/data/repositories/workflow-repository"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"

const SchedulerDetailPage = () => {
  const { schedulerId } = useParams<{ schedulerId: string }>()
  const { data, error, isLoading, reload, setData } = useAsyncResource(() => getScheduler(schedulerId ?? ""), [schedulerId])
  const { data: workflowOptions } = useAsyncResource(() => listWorkflows(), [])
  const { data: agentOptions } = useAsyncResource(() => listAvailableAgents(), [])
  const [draft, setDraft] = useState<SchedulerDetail | null>(null)

  useEffect(() => {
    if (data) {
      setDraft(data)
    }
  }, [data])

  const targetOptions = useMemo(() => {
    if (!draft) {
      return []
    }

    return draft.targetType === "agent" ? (agentOptions ?? []) : (workflowOptions ?? [])
  }, [agentOptions, draft, workflowOptions])

  useEffect(() => {
    if (!draft || draft.targetId || targetOptions.length === 0) {
      return
    }

    const nextTarget = targetOptions[0]
    setDraft({
      ...draft,
      targetId: nextTarget.id,
      targetName: nextTarget.title,
    })
  }, [draft, targetOptions])

  const selectedTarget = targetOptions.find((item) => item.id === draft?.targetId)

  const handleSave = async () => {
    if (!draft) {
      return
    }

    const next = await saveScheduler(draft)
    setData(next)
    setDraft(next)
  }

  const updateTargetType = (targetType: SchedulerDetail["targetType"]) => {
    if (!draft) {
      return
    }

    const nextOptions = targetType === "agent" ? (agentOptions ?? []) : (workflowOptions ?? [])
    const nextTarget = nextOptions[0]

    setDraft({
      ...draft,
      targetType,
      targetId: nextTarget?.id ?? "",
      targetName: nextTarget?.title ?? "",
    })
  }

  const handleTargetIdChange = (targetId: string) => {
    if (!draft) {
      return
    }

    const nextTarget = targetOptions.find((item) => item.id === targetId)
    setDraft({
      ...draft,
      targetId,
      targetName: nextTarget?.title ?? "",
    })
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={draft?.title ?? "Scheduler"}
        actions={draft ? <Button onClick={handleSave}>Save scheduler</Button> : null}
      />
      <div className="flex-1 p-6">
        <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          {isLoading ? <LoadingCard title="Loading scheduler..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && draft ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>Scheduler config</CardTitle>
                    <Badge variant={draft.enabled ? "default" : "secondary"}>{draft.enabled ? "Enabled" : "Disabled"}</Badge>
                    <Badge variant="outline">{draft.targetType}</Badge>
                  </div>
                  <CardDescription>Edit the full scheduler shape, including target binding and retry policy.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Scheduler title" />
                    <Input value={draft.schedule} onChange={(event) => setDraft({ ...draft, schedule: event.target.value })} placeholder="Cron schedule" />
                  </div>
                  <Textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={4} placeholder="Scheduler description" />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input value={draft.timeZone} onChange={(event) => setDraft({ ...draft, timeZone: event.target.value })} placeholder="Time zone" />
                    <NativeSelect value={draft.missedRunPolicy} onChange={(event) => setDraft({ ...draft, missedRunPolicy: event.target.value as SchedulerDetail["missedRunPolicy"] })}>
                      <NativeSelectOption value="skip">Skip missed runs</NativeSelectOption>
                      <NativeSelectOption value="catch-up">Catch up missed runs</NativeSelectOption>
                    </NativeSelect>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <NativeSelect value={draft.targetType} onChange={(event) => updateTargetType(event.target.value as SchedulerDetail["targetType"])}>
                      <NativeSelectOption value="workflow">Workflow</NativeSelectOption>
                      <NativeSelectOption value="agent">Agent</NativeSelectOption>
                    </NativeSelect>
                    <NativeSelect value={draft.targetId} onChange={(event) => handleTargetIdChange(event.target.value)}>
                      <NativeSelectOption value="">Select a target</NativeSelectOption>
                      {targetOptions.map((item) => (
                        <NativeSelectOption key={item.id} value={item.id}>{item.title}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input type="number" value={String(draft.retryLimit)} onChange={(event) => setDraft({ ...draft, retryLimit: Number(event.target.value) || 0 })} placeholder="Retry limit" />
                    <Input type="number" value={String(draft.retryBackoffSeconds)} onChange={(event) => setDraft({ ...draft, retryBackoffSeconds: Number(event.target.value) || 0 })} placeholder="Retry backoff seconds" />
                  </div>
                  <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span>Enabled</span>
                    <Switch checked={draft.enabled} onCheckedChange={(checked) => setDraft({ ...draft, enabled: checked })} />
                  </label>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Input payload JSON</div>
                    <Textarea value={draft.inputPayloadJson} onChange={(event) => setDraft({ ...draft, inputPayloadJson: event.target.value })} rows={10} className="font-mono" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Runtime preview</CardTitle>
                  <CardDescription>Quick summary of how this scheduler will execute locally.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Target</div>
                    <div className="font-medium">{(selectedTarget?.title ?? draft.targetName) || "No target selected"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Target type</div>
                    <div className="font-medium">{draft.targetType}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Schedule</div>
                    <div className="font-medium break-all">{draft.schedule}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Time zone</div>
                    <div className="font-medium">{draft.timeZone}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Retry policy</div>
                    <div className="font-medium">{draft.missedRunPolicy} · {draft.retryLimit} retries · {draft.retryBackoffSeconds}s backoff</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Enabled</div>
                    <div className="font-medium">{draft.enabled ? "Yes" : "No"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Updated</div>
                    <div className="font-medium">{new Date(draft.updatedAt).toLocaleString()}</div>
                  </div>
                  <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                    This scheduler now persists its full configuration in SQLite instead of only title and cron text.
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

export default SchedulerDetailPage