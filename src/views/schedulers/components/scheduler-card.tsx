import { CalendarClockIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { SchedulerDetail } from "@/data/domain/models"
import { BrandedResourceCard } from "@/views/components/branded-resource-card"

type SchedulerCardProps = {
  scheduler: SchedulerDetail
  onOpen: (schedulerId: string) => void
}

export function SchedulerCard({ scheduler, onOpen }: SchedulerCardProps) {
  return (
    <BrandedResourceCard
      title={scheduler.title}
      description={scheduler.description || "No description yet."}
      leading={<span className="flex size-10 items-center justify-center rounded-xl border border-border bg-background"><CalendarClockIcon className="size-5 shrink-0 text-violet-600" /></span>}
      badges={(
        <>
          <Badge variant="outline">{scheduler.targetType}</Badge>
          <Badge variant={scheduler.enabled ? "default" : "secondary"}>{scheduler.enabled ? "Enabled" : "Disabled"}</Badge>
        </>
      )}
      actionLabel="Open scheduler"
      onOpen={() => onOpen(scheduler.id)}
      metrics={[
        { label: "Target", value: scheduler.targetName || "No target selected" },
        { label: "Cron", value: scheduler.schedule, mono: true },
      ]}
    />
  )
}
