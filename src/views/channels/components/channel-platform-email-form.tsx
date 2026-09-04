import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import type { ChannelConfigRecord, EmailAction, EmailFilterRule } from "@/data/domain/models"
import { CompactInput, Field, Hint, Label } from "@/views/channels/components/channel-form-fields"

type ChannelPlatformEmailFormProps = {
  channel: ChannelConfigRecord
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
}

function GroupSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="space-y-1">
        <Label>{title}</Label>
        <Hint>{description}</Hint>
      </div>
      {children}
    </div>
  )
}

function getActionValueLabel(action: EmailAction) {
  switch (action.type) {
    case "forward":
      return "Forward to"
    case "label":
      return "Label"
    case "webhook":
      return "Webhook URL"
    case "auto_reply":
      return action.useAgent === false ? "Reply template" : "Reply target"
    default:
      return "Value"
  }
}

function getActionValuePlaceholder(action: EmailAction) {
  switch (action.type) {
    case "forward":
      return "recipient@example.com"
    case "label":
      return "e.g. processed, support"
    case "webhook":
      return "https://your-api.example.com/email-hook"
    case "auto_reply":
      return action.useAgent === false ? "Use {{subject}}, {{from}}, {{body}} as placeholders" : "Leave empty to use the channel reply agent"
    case "agent_process":
      return "Use the selected reply agent to process matched emails"
    default:
      return "Target or value"
  }
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
      <GroupSection title="IMAP" description="Configure the IMAP server to monitor incoming emails. The channel will periodically poll the mailbox for new messages matching your filter rules.">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="IMAP host"><CompactInput value={channel.emailImapHost ?? ""} onChange={(event) => onPatch({ emailImapHost: event.target.value })} placeholder="e.g. imap.gmail.com" /></Field>
          <Field label="IMAP port"><CompactInput type="number" value={String(channel.emailImapPort ?? 993)} onChange={(event) => onPatch({ emailImapPort: Number(event.target.value) || 993 })} /></Field>
          <Field label="Username / email"><CompactInput value={channel.emailImapUser ?? ""} onChange={(event) => onPatch({ emailImapUser: event.target.value })} placeholder="your@email.com" /></Field>
          <Field label="Password"><CompactInput type="password" value={channel.emailImapPassword ?? ""} onChange={(event) => onPatch({ emailImapPassword: event.target.value })} placeholder="App password or IMAP password" /></Field>
          <Field label="Mailbox"><CompactInput value={channel.emailImapMailbox ?? "INBOX"} onChange={(event) => onPatch({ emailImapMailbox: event.target.value })} /></Field>
          <Field label="Poll interval (seconds)"><CompactInput type="number" value={String(channel.emailPollInterval ?? 60)} onChange={(event) => onPatch({ emailPollInterval: Math.max(10, Number(event.target.value) || 60) })} /></Field>
        </div>

        <label className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs">
          <span>Use TLS / SSL</span>
          <Switch checked={channel.emailImapTls !== false} onCheckedChange={(checked) => onPatch({ emailImapTls: checked })} />
        </label>
      </GroupSection>

      <GroupSection title="SMTP" description="Configure SMTP for sending reply emails. If not set, replies will use the IMAP credentials with common SMTP defaults.">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="SMTP host"><CompactInput value={channel.emailSmtpHost ?? ""} onChange={(event) => onPatch({ emailSmtpHost: event.target.value })} placeholder="e.g. smtp.gmail.com" /></Field>
          <Field label="SMTP port"><CompactInput type="number" value={String(channel.emailSmtpPort ?? 465)} onChange={(event) => onPatch({ emailSmtpPort: Number(event.target.value) || 465 })} /></Field>
          <Field label="SMTP username"><CompactInput value={channel.emailSmtpUser ?? ""} onChange={(event) => onPatch({ emailSmtpUser: event.target.value })} placeholder="Leave blank to use IMAP username" /></Field>
          <Field label="SMTP password"><CompactInput type="password" value={channel.emailSmtpPassword ?? ""} onChange={(event) => onPatch({ emailSmtpPassword: event.target.value })} placeholder="Leave blank to use IMAP password" /></Field>
          <Field label="From name"><CompactInput value={channel.emailFromName ?? ""} onChange={(event) => onPatch({ emailFromName: event.target.value })} placeholder="e.g. Support Bot" /></Field>
          <Field label="From address"><CompactInput value={channel.emailFromAddress ?? ""} onChange={(event) => onPatch({ emailFromAddress: event.target.value })} placeholder="Leave blank to use IMAP email" /></Field>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs">
            <span>Use TLS / SSL for SMTP</span>
            <Switch checked={channel.emailSmtpTls !== false} onCheckedChange={(checked) => onPatch({ emailSmtpTls: checked })} />
          </label>
          <label className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs">
            <span>Mark processed emails as read</span>
            <Switch checked={channel.emailMarkAsRead ?? true} onCheckedChange={(checked) => onPatch({ emailMarkAsRead: checked })} />
          </label>
        </div>

        <label className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs">
          <span>Use global mail service for SMTP sending</span>
          <Switch checked={channel.emailUseGlobalMailService ?? false} onCheckedChange={(checked) => onPatch({ emailUseGlobalMailService: checked })} />
        </label>
      </GroupSection>

      <GroupSection title="Filters" description="Define rules to filter incoming emails. Only emails matching all enabled rules will be processed. Leave empty to process all incoming emails.">
        <div className="flex items-center justify-between">
          <Label>Email filters</Label>
          <Button size="sm" variant="outline" onClick={() => onPatch({ emailFilters: [...emailFilters, { id: crypto.randomUUID(), field: "subject", operator: "contains", value: "", enabled: true }] })}>Add filter</Button>
        </div>
        {emailFilters.map((filter) => (
          <div key={filter.id} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
            <NativeSelect size="sm" value={filter.field} onChange={(event) => updateFilter(filter.id, { field: event.target.value as EmailFilterRule["field"] })}>
              <NativeSelectOption value="subject">Subject</NativeSelectOption>
              <NativeSelectOption value="from">From</NativeSelectOption>
              <NativeSelectOption value="to">To</NativeSelectOption>
              <NativeSelectOption value="cc">CC</NativeSelectOption>
              <NativeSelectOption value="body">Body</NativeSelectOption>
              <NativeSelectOption value="has_attachment">Has attachment</NativeSelectOption>
            </NativeSelect>
            <NativeSelect size="sm" value={filter.operator} onChange={(event) => updateFilter(filter.id, { operator: event.target.value as EmailFilterRule["operator"] })}>
              <NativeSelectOption value="contains">Contains</NativeSelectOption>
              <NativeSelectOption value="not_contains">Not contains</NativeSelectOption>
              <NativeSelectOption value="equals">Equals</NativeSelectOption>
              <NativeSelectOption value="starts_with">Starts with</NativeSelectOption>
              <NativeSelectOption value="ends_with">Ends with</NativeSelectOption>
              <NativeSelectOption value="regex">Regex</NativeSelectOption>
              <NativeSelectOption value="is_true">Is true</NativeSelectOption>
            </NativeSelect>
            <CompactInput value={filter.value} onChange={(event) => updateFilter(filter.id, { value: event.target.value })} placeholder="Keyword or pattern..." disabled={filter.field === "has_attachment" && filter.operator === "is_true"} />
            <label className="flex items-center justify-center rounded-lg border px-2 text-xs"><Switch checked={filter.enabled} onCheckedChange={(checked) => updateFilter(filter.id, { enabled: checked })} /></label>
            <Button size="sm" variant="outline" onClick={() => onPatch({ emailFilters: emailFilters.filter((item) => item.id !== filter.id) })}>Remove</Button>
          </div>
        ))}
      </GroupSection>

      <GroupSection title="Actions" description="Configure what happens when an email matches the filter rules. Multiple actions can be executed for each matched email.">
        <div className="flex items-center justify-between">
          <Label>Email actions</Label>
          <Button size="sm" variant="outline" onClick={() => onPatch({ emailActions: [...emailActions, { id: crypto.randomUUID(), type: "auto_reply", value: "", enabled: true, useAgent: true }] })}>Add action</Button>
        </div>
        {emailActions.map((action) => (
          <div key={action.id} className="space-y-3 rounded-xl border p-3">
            <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
              <NativeSelect size="sm" value={action.type} onChange={(event) => updateAction(action.id, { type: event.target.value as EmailAction["type"] })}>
                <NativeSelectOption value="auto_reply">Auto reply</NativeSelectOption>
                <NativeSelectOption value="forward">Forward</NativeSelectOption>
                <NativeSelectOption value="label">Label</NativeSelectOption>
                <NativeSelectOption value="agent_process">Agent process</NativeSelectOption>
                <NativeSelectOption value="webhook">Webhook</NativeSelectOption>
              </NativeSelect>
              <label className="flex items-center justify-center rounded-lg border px-2 text-xs"><Switch checked={action.enabled} onCheckedChange={(checked) => updateAction(action.id, { enabled: checked })} /></label>
              <Button size="sm" variant="outline" onClick={() => onPatch({ emailActions: emailActions.filter((item) => item.id !== action.id) })}>Remove</Button>
            </div>

            {action.type === "auto_reply" || action.type === "agent_process" ? (
              <label className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs">
                <span>Use channel reply agent to generate response</span>
                <Switch checked={action.useAgent !== false} onCheckedChange={(checked) => updateAction(action.id, { useAgent: checked })} />
              </label>
            ) : null}

            {action.type !== "agent_process" || action.useAgent === false ? (
              <Field label={getActionValueLabel(action)}>
                <CompactInput value={action.value ?? ""} onChange={(event) => updateAction(action.id, { value: event.target.value })} placeholder={getActionValuePlaceholder(action)} />
              </Field>
            ) : null}

            {action.type === "agent_process" && action.useAgent !== false ? (
              <Hint>Matched emails will be handed to the selected channel reply agent.</Hint>
            ) : null}
          </div>
        ))}
      </GroupSection>
    </div>
  )
}