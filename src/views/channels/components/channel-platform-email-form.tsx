import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import type { ChannelConfigRecord, EmailAction, EmailFilterRule } from "@/data/domain/models"
import { CompactInput, Field, Hint, Label } from "@/views/channels/components/channel-form-fields"

type ChannelPlatformEmailFormProps = {
  channel: ChannelConfigRecord
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
}

export function ChannelPlatformEmailForm({ channel, onPatch }: ChannelPlatformEmailFormProps) {
  const emailFilters = channel.emailFilters ?? []
  const emailActions = channel.emailActions ?? []

  const updateFilter = (filterId: string, patch: Partial<EmailFilterRule>) => {
    onPatch({ emailFilters: emailFilters.map((item) => item.id === filterId ? { ...item, ...patch } : item) })
  }

  const updateAction = (actionId: string, patch: Partial<EmailAction>) => {
    onPatch({ emailActions: emailActions.map((item) => item.id === actionId ? { ...item, ...patch } : item) })
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="IMAP host"><CompactInput value={channel.emailImapHost ?? ""} onChange={(event) => onPatch({ emailImapHost: event.target.value })} /></Field>
        <Field label="IMAP port"><CompactInput type="number" value={String(channel.emailImapPort ?? 993)} onChange={(event) => onPatch({ emailImapPort: Number(event.target.value) || 993 })} /></Field>
        <Field label="IMAP user"><CompactInput value={channel.emailImapUser ?? ""} onChange={(event) => onPatch({ emailImapUser: event.target.value })} /></Field>
        <Field label="IMAP password"><CompactInput type="password" value={channel.emailImapPassword ?? ""} onChange={(event) => onPatch({ emailImapPassword: event.target.value })} /></Field>
        <Field label="SMTP host"><CompactInput value={channel.emailSmtpHost ?? ""} onChange={(event) => onPatch({ emailSmtpHost: event.target.value })} /></Field>
        <Field label="SMTP port"><CompactInput type="number" value={String(channel.emailSmtpPort ?? 465)} onChange={(event) => onPatch({ emailSmtpPort: Number(event.target.value) || 465 })} /></Field>
        <Field label="SMTP user"><CompactInput value={channel.emailSmtpUser ?? ""} onChange={(event) => onPatch({ emailSmtpUser: event.target.value })} /></Field>
        <Field label="SMTP password"><CompactInput type="password" value={channel.emailSmtpPassword ?? ""} onChange={(event) => onPatch({ emailSmtpPassword: event.target.value })} /></Field>
        <Field label="From name"><CompactInput value={channel.emailFromName ?? ""} onChange={(event) => onPatch({ emailFromName: event.target.value })} /></Field>
        <Field label="From address"><CompactInput value={channel.emailFromAddress ?? ""} onChange={(event) => onPatch({ emailFromAddress: event.target.value })} /></Field>
      </div>

      <label className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs">
        <span>Mark matched emails as read</span>
        <Switch checked={channel.emailMarkAsRead ?? true} onCheckedChange={(checked) => onPatch({ emailMarkAsRead: checked })} />
      </label>

      <label className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs">
        <span>Use global mail service for SMTP sending</span>
        <Switch checked={channel.emailUseGlobalMailService ?? false} onCheckedChange={(checked) => onPatch({ emailUseGlobalMailService: checked })} />
      </label>

      <div className="space-y-2 rounded-xl border p-3">
        <div className="flex items-center justify-between">
          <Label>Email filters</Label>
          <Button size="sm" variant="outline" onClick={() => onPatch({ emailFilters: [...emailFilters, { id: crypto.randomUUID(), field: "subject", operator: "contains", value: "", enabled: true }] })}>Add filter</Button>
        </div>
        <Hint>Use IMAP polling with focused filters before auto-reply or handoff actions.</Hint>
        {emailFilters.map((filter) => (
          <div key={filter.id} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
            <NativeSelect size="sm" value={filter.field} onChange={(event) => updateFilter(filter.id, { field: event.target.value as EmailFilterRule["field"] })}>
              <NativeSelectOption value="subject">Subject</NativeSelectOption>
              <NativeSelectOption value="from">From</NativeSelectOption>
              <NativeSelectOption value="to">To</NativeSelectOption>
              <NativeSelectOption value="body">Body</NativeSelectOption>
              <NativeSelectOption value="has_attachment">Has attachment</NativeSelectOption>
            </NativeSelect>
            <NativeSelect size="sm" value={filter.operator} onChange={(event) => updateFilter(filter.id, { operator: event.target.value as EmailFilterRule["operator"] })}>
              <NativeSelectOption value="contains">Contains</NativeSelectOption>
              <NativeSelectOption value="equals">Equals</NativeSelectOption>
              <NativeSelectOption value="regex">Regex</NativeSelectOption>
              <NativeSelectOption value="is_true">Is true</NativeSelectOption>
            </NativeSelect>
            <CompactInput value={filter.value} onChange={(event) => updateFilter(filter.id, { value: event.target.value })} placeholder="Value" />
            <label className="flex items-center justify-center rounded-lg border px-2 text-xs"><Switch checked={filter.enabled} onCheckedChange={(checked) => updateFilter(filter.id, { enabled: checked })} /></label>
            <Button size="sm" variant="outline" onClick={() => onPatch({ emailFilters: emailFilters.filter((item) => item.id !== filter.id) })}>Remove</Button>
          </div>
        ))}
      </div>

      <div className="space-y-2 rounded-xl border p-3">
        <div className="flex items-center justify-between">
          <Label>Email actions</Label>
          <Button size="sm" variant="outline" onClick={() => onPatch({ emailActions: [...emailActions, { id: crypto.randomUUID(), type: "auto_reply", value: "", enabled: true, useAgent: true }] })}>Add action</Button>
        </div>
        {emailActions.map((action) => (
          <div key={action.id} className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
            <NativeSelect size="sm" value={action.type} onChange={(event) => updateAction(action.id, { type: event.target.value as EmailAction["type"] })}>
              <NativeSelectOption value="auto_reply">Auto reply</NativeSelectOption>
              <NativeSelectOption value="forward">Forward</NativeSelectOption>
              <NativeSelectOption value="label">Label</NativeSelectOption>
              <NativeSelectOption value="agent_process">Agent process</NativeSelectOption>
              <NativeSelectOption value="webhook">Webhook</NativeSelectOption>
            </NativeSelect>
            <CompactInput value={action.value ?? ""} onChange={(event) => updateAction(action.id, { value: event.target.value })} placeholder="Target or label" />
            <label className="flex items-center justify-center rounded-lg border px-2 text-xs"><Switch checked={action.enabled} onCheckedChange={(checked) => updateAction(action.id, { enabled: checked })} /></label>
            <Button size="sm" variant="outline" onClick={() => onPatch({ emailActions: emailActions.filter((item) => item.id !== action.id) })}>Remove</Button>
          </div>
        ))}
      </div>
    </div>
  )
}