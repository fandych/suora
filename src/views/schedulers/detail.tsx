import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router"

import { toast } from "@/components/ui/toast"
import type { SchedulerDetail } from "@/data/domain/models"
import { listAvailableAgents } from "@/data/repositories/agent-repository"
import { getScheduler, saveScheduler } from "@/data/repositories/scheduler-repository"
import { listWorkflows } from "@/data/repositories/workflow-repository"
import { useAsyncResource } from "@/hooks/use-async-resource"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { SchedulerBindingPanel } from "@/views/schedulers/components/scheduler-binding-panel"
import { SchedulerGeneralPanel } from "@/views/schedulers/components/scheduler-general-panel"

const SchedulerDetailPage = () => {
  const { schedulerId } = useParams<{ schedulerId: string }>()
  const { data, error, isLoading, reload, setData } = useAsyncResource(() => getScheduler(schedulerId ?? ""), [schedulerId])
  const { data: workflowsData } = useAsyncResource(() => listWorkflows(), [])
  const { data: agentsData } = useAsyncResource(() => listAvailableAgents(), [])
  const [draft, setDraft] = useState<SchedulerDetail | null>(null)
  const workflows = workflowsData ?? []
  const agents = agentsData ?? []

  useEffect(() => {
    if (data) {
      setDraft(data)
    }
  }, [data])

  const targetOptions = useMemo(() => {
    if (!draft) {
      return []
    }

    return draft.targetType === "agent" ? agents : workflows
  }, [agents, draft, workflows])

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

  const handleSave = async () => {
    if (!draft) {
      return
    }

    try {
      const next = await saveScheduler(draft)
      setData(next)
      setDraft(next)
      toast.add({ title: "Scheduler saved", type: "success" })
    } catch (error) {
      toast.add({ title: "Save failed", description: error instanceof Error ? error.message : String(error), type: "error" })
    }
  }

  const updateTargetType = (targetType: SchedulerDetail["targetType"]) => {
    if (!draft) {
      return
    }

    const nextTarget = targetType === "agent" ? agents[0] : workflows[0]

    setDraft({
      ...draft,
      targetType,
      targetId: nextTarget?.id ?? "",
      targetName: nextTarget?.title ?? "",
      inputPayloadJson: "{}",
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
      inputPayloadJson: "{}",
    })
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title={draft?.title ?? "Scheduler"} description={draft?.description || "Configure when and what this scheduler invokes."} />
      <div className="flex min-h-0 flex-1 overflow-hidden p-4">
        <div className="grid min-h-0 w-full min-w-0 flex-1 gap-3 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          {isLoading ? <LoadingCard title="Loading scheduler..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && draft ? (
            <>
              <SchedulerGeneralPanel draft={draft} onChange={setDraft} onSave={() => void handleSave()} />
              <SchedulerBindingPanel agents={agents} draft={draft} onChange={setDraft} onTargetIdChange={handleTargetIdChange} onTargetTypeChange={updateTargetType} workflows={workflows} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default SchedulerDetailPage