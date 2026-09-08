import { Clock3Icon, HistoryIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { SchedulerRunRecord } from "@/data/domain/models"

const statusVariants = {
  queued: "secondary",
  running: "default",
  success: "default",
  error: "destructive",
  skipped: "secondary",
} as const

export function SchedulerRunHistory({ runs }: { runs: SchedulerRunRecord[] }) {
  return (
    <ScrollArea className="max-h-[52vh]">
      <div className="flex flex-col gap-2 pr-3">
        {runs.map((run) => (
          <div key={run.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium"><Clock3Icon className="size-4" />{new Date(run.startedAt).toLocaleString()}</div>
              <Badge variant={statusVariants[run.status]}>{run.status}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{run.finishedAt ? `Finished ${new Date(run.finishedAt).toLocaleString()}` : "Awaiting completion"}</p>
          </div>
        ))}
        {runs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
            <HistoryIcon className="size-5" />
            <p>No scheduler runs recorded.</p>
          </div>
        ) : null}
      </div>
    </ScrollArea>
  )
}
