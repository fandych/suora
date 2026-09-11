import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { EllipsisIcon, HistoryIcon, PauseIcon, PlayIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/toast"
import type { SchedulerDetail } from "@/data/domain/models"
import { emitDataChanged } from "@/data/repositories/data-events"
import { ConfirmDeleteDialog } from "@/views/components/confirm-delete-dialog"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { SchedulerBindingPanel } from "@/views/schedulers/components/scheduler-binding-panel"
import { SchedulerGeneralPanel } from "@/views/schedulers/components/scheduler-general-panel"
import { SchedulerRunHistory } from "@/views/schedulers/components/scheduler-run-history"
import { useSchedulerDetailStore } from "@/view-models/schedulers/scheduler-detail-store"

const SchedulerDetailPage = () => {
  const { schedulerId } = useParams<{ schedulerId: string }>()
  const navigate = useNavigate()
  const { draft, runs, workflows, agents, error, isLoading, isDeleting, load, updateDraft, save, toggleEnabled, remove, reload } = useSchedulerDetailStore()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const isLoadingRuns = false
  const reloadRuns = reload

  useEffect(() => {
    if (schedulerId) void load(schedulerId)
  }, [load, schedulerId])

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
    updateDraft({
      ...draft,
      targetId: nextTarget.id,
      targetName: nextTarget.title,
    })
  }, [draft, targetOptions, updateDraft])

  const handleSave = async () => {
    if (!draft) {
      return
    }

    try {
      const next = await save()
      if (!next) return
      toast.add({ title: "Scheduler saved", type: "success" })
    } catch (error) {
      toast.add({ title: "Save failed", description: error instanceof Error ? error.message : String(error), type: "error" })
    }
  }

  const handleToggleEnabled = async () => {
    if (!draft) return

    try {
      const next = await toggleEnabled()
      if (!next) return
      emitDataChanged("/schedulers")
      toast.add({ title: next.enabled ? "Scheduler enabled" : "Scheduler disabled", type: "success" })
    } catch (error) {
      toast.add({ title: "Update failed", description: error instanceof Error ? error.message : String(error), type: "error" })
    }
  }

  const handleDelete = async () => {
    if (!draft) return

    try {
      await remove()
      emitDataChanged("/schedulers")
      navigate("/schedulers")
      toast.add({ title: "Scheduler deleted", type: "success" })
    } catch (error) {
      toast.add({ title: "Delete failed", description: error instanceof Error ? error.message : String(error), type: "error" })
    } finally {
      setIsDeleteDialogOpen(false)
    }
  }

  const updateTargetType = (targetType: SchedulerDetail["targetType"]) => {
    if (!draft) {
      return
    }

    const nextTarget = targetType === "agent" ? agents[0] : workflows[0]

    updateDraft({
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
    updateDraft({
      ...draft,
      targetId,
      targetName: nextTarget?.title ?? "",
      inputPayloadJson: "{}",
    })
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={draft?.title ?? "Scheduler"}
        description={draft?.description || "Configure when and what this scheduler invokes."}
        actions={draft ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Scheduler actions" title="Scheduler actions" />}>
              <EllipsisIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 min-w-48">
              <DropdownMenuItem onClick={() => { setIsHistoryDialogOpen(true); void reloadRuns() }}><HistoryIcon />Run history</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleToggleEnabled()}>{draft.enabled ? <PauseIcon /> : <PlayIcon />}{draft.enabled ? "Disable" : "Enable"}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}><Trash2Icon />Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden p-4">
        <div className="grid min-h-0 w-full min-w-0 flex-1 gap-3 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          {isLoading ? <LoadingCard title="Loading scheduler..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && draft ? (
            <>
              <SchedulerGeneralPanel draft={draft} onChange={updateDraft} onSave={() => void handleSave()} />
              <SchedulerBindingPanel agents={agents} draft={draft} onChange={updateDraft} onTargetIdChange={handleTargetIdChange} onTargetTypeChange={updateTargetType} workflows={workflows} />
            </>
          ) : null}
        </div>
      </div>

      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Run history</DialogTitle>
            <DialogDescription>Review scheduler runs recorded by the runtime.</DialogDescription>
          </DialogHeader>
          {isLoadingRuns ? <p className="py-8 text-center text-sm text-muted-foreground">Loading run history…</p> : <SchedulerRunHistory runs={runs ?? []} />}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        description="This permanently deletes the scheduler and its run history. This action cannot be undone."
        onConfirm={() => void handleDelete()}
        onOpenChange={(open) => { if (!isDeleting) setIsDeleteDialogOpen(open) }}
        open={isDeleteDialogOpen}
        title="Delete scheduler"
      />
    </div>
  )
}

export default SchedulerDetailPage