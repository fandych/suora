import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { WorkflowNotificationSettings } from "@/data/domain/models"

type WorkflowPreferenceDialogProps = {
  open: boolean
  title: string
  summary: string
  dryRunInput: string
  readOnly: boolean
  notifications: WorkflowNotificationSettings
  resourceBindings: { providerId: string; skillId: string; documentId: string; integrationId: string }
  onOpenChange: (open: boolean) => void
  onDryRunInputChange: (value: string) => void
  onNotificationsChange: (value: WorkflowNotificationSettings) => void
  onResourceBindingsChange: (value: { providerId: string; skillId: string; documentId: string; integrationId: string }) => void
  onTitleChange: (value: string) => void
  onSummaryChange: (value: string) => void
}

export function WorkflowPreferenceDialog({
  open,
  title,
  summary,
  dryRunInput,
  readOnly,
  notifications,
  resourceBindings,
  onOpenChange,
  onDryRunInputChange,
  onNotificationsChange,
  onResourceBindingsChange,
  onTitleChange,
  onSummaryChange,
}: WorkflowPreferenceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Workflow preference</DialogTitle>
          <DialogDescription>Edit the basic workflow information shown in lists and version history.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <fieldset disabled={readOnly} className="space-y-3">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Workflow name</div>
              <Input value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="Workflow name" />
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Summary</div>
              <Textarea value={summary} onChange={(event) => onSummaryChange(event.target.value)} rows={5} placeholder="Workflow summary" />
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Default try input</div>
              <Textarea value={dryRunInput} onChange={(event) => onDryRunInputChange(event.target.value)} rows={5} className="font-mono text-xs" placeholder='{"leadId":"LD-1001"}' />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Provider ID</div>
                <Input value={resourceBindings.providerId} onChange={(event) => onResourceBindingsChange({ ...resourceBindings, providerId: event.target.value })} placeholder="Provider ID" />
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Skill ID</div>
                <Input value={resourceBindings.skillId} onChange={(event) => onResourceBindingsChange({ ...resourceBindings, skillId: event.target.value })} placeholder="Skill ID" />
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Document ID</div>
                <Input value={resourceBindings.documentId} onChange={(event) => onResourceBindingsChange({ ...resourceBindings, documentId: event.target.value })} placeholder="Document ID" />
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Integration ID</div>
                <Input value={resourceBindings.integrationId} onChange={(event) => onResourceBindingsChange({ ...resourceBindings, integrationId: event.target.value })} placeholder="Integration ID" />
              </div>
            </div>
            <div className="space-y-3 rounded-xl border p-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                Send workflow email notifications
                <Switch checked={notifications.enabled} onCheckedChange={(checked) => onNotificationsChange({ ...notifications, enabled: checked })} />
              </label>
              <Input value={notifications.to} onChange={(event) => onNotificationsChange({ ...notifications, to: event.target.value })} placeholder="recipient@example.com" />
              <Input value={notifications.subjectTemplate} onChange={(event) => onNotificationsChange({ ...notifications, subjectTemplate: event.target.value })} placeholder="Workflow {{workflowTitle}} {{status}}" />
              <NativeSelect value={notifications.triggerOn} onChange={(event) => onNotificationsChange({ ...notifications, triggerOn: event.target.value as WorkflowNotificationSettings["triggerOn"] })}>
                <NativeSelectOption value="both">Dry run and manual run</NativeSelectOption>
                <NativeSelectOption value="manual">Manual run only</NativeSelectOption>
                <NativeSelectOption value="dry-run">Dry run only</NativeSelectOption>
              </NativeSelect>
              <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                Include summary
                <Switch checked={notifications.includeSummary} onCheckedChange={(checked) => onNotificationsChange({ ...notifications, includeSummary: checked })} />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                Include trace
                <Switch checked={notifications.includeTrace} onCheckedChange={(checked) => onNotificationsChange({ ...notifications, includeTrace: checked })} />
              </label>
            </div>
          </fieldset>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}