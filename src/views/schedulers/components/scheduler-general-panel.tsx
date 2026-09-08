import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { SchedulerDetail } from "@/data/domain/models"

type SchedulerGeneralPanelProps = {
  draft: SchedulerDetail
  onChange: (next: SchedulerDetail) => void
  onSave: () => void
}

export function SchedulerGeneralPanel({ draft, onChange, onSave }: SchedulerGeneralPanelProps) {
  return (
    <Card className="h-full min-h-0">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>General</CardTitle>
          <Badge variant={draft.enabled ? "default" : "secondary"}>{draft.enabled ? "Enabled" : "Disabled"}</Badge>
        </div>
        <CardDescription>Set when this scheduler runs and how missed runs are handled.</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-5">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="scheduler-name">Name</FieldLabel>
            <Input id="scheduler-name" value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} placeholder="Scheduler name" />
          </Field>
          <Field>
            <FieldLabel htmlFor="scheduler-description">Description</FieldLabel>
            <Textarea id="scheduler-description" value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} rows={4} placeholder="Describe this scheduled task." />
          </Field>
          <div className="grid gap-5 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="scheduler-cron">Cron expression</FieldLabel>
              <Input id="scheduler-cron" value={draft.schedule} onChange={(event) => onChange({ ...draft, schedule: event.target.value })} placeholder="0 9 * * *" />
              <FieldDescription>Use a standard five-part cron expression.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="scheduler-time-zone">Time zone</FieldLabel>
              <Input id="scheduler-time-zone" value={draft.timeZone} onChange={(event) => onChange({ ...draft, timeZone: event.target.value })} placeholder="Asia/Shanghai" />
            </Field>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="scheduler-missed-policy">Missed runs</FieldLabel>
              <NativeSelect id="scheduler-missed-policy" value={draft.missedRunPolicy} onChange={(event) => onChange({ ...draft, missedRunPolicy: event.target.value as SchedulerDetail["missedRunPolicy"] })}>
                <NativeSelectOption value="skip">Skip missed runs</NativeSelectOption>
                <NativeSelectOption value="catch-up">Catch up missed runs</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field orientation="horizontal" className="self-end rounded-lg border px-3 py-2.5">
              <FieldLabel htmlFor="scheduler-enabled">Enabled</FieldLabel>
              <Switch id="scheduler-enabled" checked={draft.enabled} onCheckedChange={(enabled) => onChange({ ...draft, enabled })} />
            </Field>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="scheduler-retry-limit">Retry limit</FieldLabel>
              <Input id="scheduler-retry-limit" type="number" min="0" value={String(draft.retryLimit)} onChange={(event) => onChange({ ...draft, retryLimit: Math.max(0, Number(event.target.value) || 0) })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="scheduler-retry-backoff">Retry backoff (seconds)</FieldLabel>
              <Input id="scheduler-retry-backoff" type="number" min="0" value={String(draft.retryBackoffSeconds)} onChange={(event) => onChange({ ...draft, retryBackoffSeconds: Math.max(0, Number(event.target.value) || 0) })} />
            </Field>
          </div>
        </FieldGroup>
        <div className="mt-auto flex justify-end pt-1">
          <Button onClick={onSave}>Save scheduler</Button>
        </div>
      </CardContent>
    </Card>
  )
}
