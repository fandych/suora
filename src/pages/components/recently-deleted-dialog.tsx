import { useEffect, useState } from "react"
import { RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SystemApi } from "@/services/system-service"
import { showToast } from "@/services/toast-service"
import type { RecentlyDeletedResourceEntry, RecentlyDeletedResourceKind, RecentlyDeletedRestoreResult } from "@/types/system"

type RecentlyDeletedDialogProps = {
  kind: RecentlyDeletedResourceKind
  onOpenChange: (open: boolean) => void
  onRestored?: (result: RecentlyDeletedRestoreResult) => void | Promise<void>
  open: boolean
  title?: string
}

function formatDeletedAt(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function RecentlyDeletedDialog({
  kind,
  onOpenChange,
  onRestored,
  open,
  title = "Recently deleted",
}: RecentlyDeletedDialogProps) {
  const [entries, setEntries] = useState<RecentlyDeletedResourceEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [restoringEntryId, setRestoringEntryId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setIsLoading(true)
    SystemApi.listRecentlyDeleted(kind)
      .then((nextEntries) => {
        if (!cancelled) setEntries(nextEntries)
      })
      .catch((error) => {
        if (!cancelled) {
          showToast({
            title: "Failed to load recently deleted items",
            description: error instanceof Error ? error.message : String(error),
            type: "error",
          })
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [kind, open])

  const handleRestore = async (entryId: string) => {
    try {
      setRestoringEntryId(entryId)
      const result = await SystemApi.restoreRecentlyDeleted(entryId)
      setEntries((current) => current.filter((entry) => entry.entryId !== entryId))
      showToast({ title: "Resource restored", description: "The deleted snapshot has been restored.", type: "success" })
      await onRestored?.(result)
      onOpenChange(false)
    } catch (error) {
      showToast({
        title: "Restore failed",
        description: error instanceof Error ? error.message : String(error),
        type: "error",
      })
    } finally {
      setRestoringEntryId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Restore a recently deleted {kind} snapshot back into the workspace.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-96 rounded-lg border">
          <div className="flex flex-col divide-y">
            {isLoading ? <div className="px-4 py-6 text-sm text-muted-foreground">Loading recently deleted items…</div> : null}
            {!isLoading && entries.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">No recently deleted {kind} snapshots are available.</div>
            ) : null}
            {!isLoading
              ? entries.map((entry) => (
                  <div key={entry.entryId} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{entry.title}</p>
                      <p className="text-xs text-muted-foreground">Deleted {formatDeletedAt(entry.deletedAt)}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={restoringEntryId === entry.entryId}
                      onClick={() => void handleRestore(entry.entryId)}
                    >
                      <RotateCcwIcon className="size-4" />
                      Restore
                    </Button>
                  </div>
                ))
              : null}
          </div>
        </ScrollArea>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}