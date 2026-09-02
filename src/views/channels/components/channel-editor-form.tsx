import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { AgentSummary, ChannelConfigRecord, EmailAction, EmailFilterRule } from "@/data/domain/models"
import { channelPlatformOptions, getChannelPlatformLabel } from "@/views/channels/components/channel-utils"

type ChannelEditorFormProps = {
  channel: ChannelConfigRecord
  agents: AgentSummary[]
  onChange: (channel: ChannelConfigRecord) => void
  onSave: () => void
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{children}</div>
}

function CompactInput(props: React.ComponentProps<typeof Input>) {
  return <Input className="h-8 text-xs" {...props} />
}

function CompactTextarea(props: React.ComponentProps<typeof Textarea>) {
  return <Textarea className="min-h-20 text-xs" {...props} />
}

export function ChannelEditorForm({ channel, agents, onChange, onSave }: ChannelEditorFormProps) {
  const update = (patch: Partial<ChannelConfigRecord>) => onChange({ ...channel, ...patch })
  const emailFilters = channel.emailFilters ?? []
  const emailActions = channel.emailActions ?? []

  const updateFilter = (filterId: string, patch: Partial<EmailFilterRule>) => {
    update({ emailFilters: emailFilters.map((item) => item.id === filterId ? { ...item, ...patch } : item) })
  }

  const updateAction = (actionId: string, patch: Partial<EmailAction>) => {
    update({ emailActions: emailActions.map((item) => item.id === actionId ? { ...item, ...patch } : item) })
  }

  return (
    <div className="space-y-3">
      <Section title="Channel setup" description="Restore the main-branch channel behavior surface inside the new shell.">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Title</Label>
            <CompactInput value={channel.title} onChange={(event) => update({ title: event.target.value })} placeholder="Channel name" />
          </div>
          <div className="space-y-2">
            <Label>Platform</Label>
            <NativeSelect size="sm" value={channel.platform} onChange={(event) => update({ platform: event.target.value as ChannelConfigRecord["platform"] })}>
              {channelPlatformOptions.map((item) => <NativeSelectOption key={item.value} value={item.value}>{item.label}</NativeSelectOption>)}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label>Connection mode</Label>
            <NativeSelect size="sm" value={channel.connectionMode} onChange={(event) => update({ connectionMode: event.target.value as ChannelConfigRecord["connectionMode"] })}>
              <NativeSelectOption value="webhook">Webhook</NativeSelectOption>
              <NativeSelectOption value="stream">Stream</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label>Reply agent</Label>
            <NativeSelect size="sm" value={channel.replyAgentId} onChange={(event) => update({ replyAgentId: event.target.value })}>
              <NativeSelectOption value="">No agent</NativeSelectOption>
              {agents.map((agent) => <NativeSelectOption key={agent.id} value={agent.id}>{agent.title}</NativeSelectOption>)}
            </NativeSelect>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Webhook path</Label>
            <CompactInput value={channel.webhookPath} onChange={(event) => update({ webhookPath: event.target.value })} placeholder="/channels/my-channel" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Webhook secret</Label>
            <CompactInput value={channel.webhookSecret} onChange={(event) => update({ webhookSecret: event.target.value })} placeholder="Optional verification secret" />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs">
            <span>Enabled</span>
            <Switch checked={channel.enabled} onCheckedChange={(checked) => update({ enabled: checked, status: checked ? "active" : "inactive" })} />
          </label>
          <label className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs">
            <span>Auto reply</span>
            <Switch checked={channel.autoReply} onCheckedChange={(checked) => update({ autoReply: checked })} />
          </label>
        </div>

        <Button size="sm" onClick={onSave}>Save channel</Button>
      </Section>

      <Section title="Platform details" description={`Compact fields for ${getChannelPlatformLabel(channel.platform)} configuration.`}>
        {(channel.platform === "web" || channel.platform === "wechat_official" || channel.platform === "slack" || channel.platform === "telegram" || channel.platform === "discord" || channel.platform === "teams") ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>App ID</Label>
              <CompactInput value={channel.appId ?? channel.teamsAppId ?? channel.discordApplicationId ?? ""} onChange={(event) => update(channel.platform === "teams" ? { teamsAppId: event.target.value } : channel.platform === "discord" ? { discordApplicationId: event.target.value } : { appId: event.target.value })} placeholder="Platform app id" />
            </div>
            <div className="space-y-2">
              <Label>Secret or token</Label>
              <CompactInput value={channel.appSecret ?? channel.slackBotToken ?? channel.telegramBotToken ?? channel.discordBotToken ?? channel.teamsAppPassword ?? ""} onChange={(event) => update(
                channel.platform === "slack"
                  ? { slackBotToken: event.target.value }
                  : channel.platform === "telegram"
                    ? { telegramBotToken: event.target.value }
                    : channel.platform === "discord"
                      ? { discordBotToken: event.target.value }
                      : channel.platform === "teams"
                        ? { teamsAppPassword: event.target.value }
                        : { appSecret: event.target.value }
              )} placeholder="Primary credential" />
            </div>
            {channel.platform === "slack" ? (
              <div className="space-y-2 md:col-span-2">
                <Label>Signing secret</Label>
                <CompactInput value={channel.slackSigningSecret ?? ""} onChange={(event) => update({ slackSigningSecret: event.target.value })} placeholder="Slack signing secret" />
              </div>
            ) : null}
            {channel.platform === "teams" ? (
              <div className="space-y-2 md:col-span-2">
                <Label>Tenant ID</Label>
                <CompactInput value={channel.teamsTenantId ?? ""} onChange={(event) => update({ teamsTenantId: event.target.value })} placeholder="Optional tenant id" />
              </div>
            ) : null}
            {channel.platform === "wechat_official" ? (
              <>
                <div className="space-y-2">
                  <Label>Verification token</Label>
                  <CompactInput value={channel.wechatOfficialToken ?? channel.verificationToken ?? ""} onChange={(event) => update({ wechatOfficialToken: event.target.value, verificationToken: event.target.value })} placeholder="Official account token" />
                </div>
                <div className="space-y-2">
                  <Label>Encrypt key</Label>
                  <CompactInput value={channel.encryptKey ?? ""} onChange={(event) => update({ encryptKey: event.target.value })} placeholder="Optional encrypt key" />
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {channel.platform === "custom" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Display name</Label>
              <CompactInput value={channel.customPlatformName ?? ""} onChange={(event) => update({ customPlatformName: event.target.value })} placeholder="My Bot" />
            </div>
            <div className="space-y-2">
              <Label>Display icon</Label>
              <CompactInput value={channel.customPlatformIcon ?? ""} onChange={(event) => update({ customPlatformIcon: event.target.value })} placeholder="UI initials or icon hint" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Outgoing webhook</Label>
              <CompactInput value={channel.customWebhookUrl ?? ""} onChange={(event) => update({ customWebhookUrl: event.target.value })} placeholder="https://example.com/webhook" />
            </div>
            <div className="space-y-2">
              <Label>Auth header</Label>
              <CompactInput value={channel.customAuthHeader ?? ""} onChange={(event) => update({ customAuthHeader: event.target.value })} placeholder="Authorization" />
            </div>
            <div className="space-y-2">
              <Label>Auth value</Label>
              <CompactInput value={channel.customAuthValue ?? ""} onChange={(event) => update({ customAuthValue: event.target.value })} placeholder="Bearer ..." />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Payload template</Label>
              <CompactTextarea value={channel.customPayloadTemplate ?? "{\n  \"message\": \"{{content}}\"\n}"} onChange={(event) => update({ customPayloadTemplate: event.target.value })} />
            </div>
          </div>
        ) : null}

        {channel.platform === "wechat_personal" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Bridge webhook URL</Label>
              <CompactInput value={channel.wechatPersonalWebhookUrl ?? ""} onChange={(event) => update({ wechatPersonalWebhookUrl: event.target.value })} placeholder="https://bridge.example.com/send" />
            </div>
            <div className="space-y-2">
              <Label>Auth token</Label>
              <CompactInput value={channel.wechatPersonalAuthToken ?? ""} onChange={(event) => update({ wechatPersonalAuthToken: event.target.value })} placeholder="Optional bearer token" />
            </div>
            <div className="space-y-2">
              <Label>Binding status</Label>
              <NativeSelect size="sm" value={channel.wechatPersonalBindingStatus ?? "unbound"} onChange={(event) => update({ wechatPersonalBindingStatus: event.target.value as ChannelConfigRecord["wechatPersonalBindingStatus"] })}>
                <NativeSelectOption value="unbound">Unbound</NativeSelectOption>
                <NativeSelectOption value="pending">Pending</NativeSelectOption>
                <NativeSelectOption value="bound">Bound</NativeSelectOption>
                <NativeSelectOption value="error">Error</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>QR code URL</Label>
              <CompactInput value={channel.wechatPersonalQrCodeUrl ?? ""} onChange={(event) => update({ wechatPersonalQrCodeUrl: event.target.value })} placeholder="https://.../qr.png" />
            </div>
            <div className="space-y-2">
              <Label>Bot token</Label>
              <CompactInput value={channel.wechatPersonalBotToken ?? ""} onChange={(event) => update({ wechatPersonalBotToken: event.target.value })} placeholder="Native bot token" />
            </div>
            <div className="space-y-2">
              <Label>Base URL</Label>
              <CompactInput value={channel.wechatPersonalBaseUrl ?? ""} onChange={(event) => update({ wechatPersonalBaseUrl: event.target.value })} placeholder="https://native-api.example.com" />
            </div>
            <div className="space-y-2">
              <Label>Account ID</Label>
              <CompactInput value={channel.wechatPersonalAccountId ?? ""} onChange={(event) => update({ wechatPersonalAccountId: event.target.value })} placeholder="Bound account id" />
            </div>
            <div className="space-y-2">
              <Label>User ID</Label>
              <CompactInput value={channel.wechatPersonalUserId ?? ""} onChange={(event) => update({ wechatPersonalUserId: event.target.value })} placeholder="Last bound user id" />
            </div>
          </div>
        ) : null}

        {channel.platform === "email" ? (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2"><Label>IMAP host</Label><CompactInput value={channel.emailImapHost ?? ""} onChange={(event) => update({ emailImapHost: event.target.value })} /></div>
              <div className="space-y-2"><Label>IMAP port</Label><CompactInput type="number" value={String(channel.emailImapPort ?? 993)} onChange={(event) => update({ emailImapPort: Number(event.target.value) || 993 })} /></div>
              <div className="space-y-2"><Label>IMAP user</Label><CompactInput value={channel.emailImapUser ?? ""} onChange={(event) => update({ emailImapUser: event.target.value })} /></div>
              <div className="space-y-2"><Label>IMAP password</Label><CompactInput type="password" value={channel.emailImapPassword ?? ""} onChange={(event) => update({ emailImapPassword: event.target.value })} /></div>
              <div className="space-y-2"><Label>SMTP host</Label><CompactInput value={channel.emailSmtpHost ?? ""} onChange={(event) => update({ emailSmtpHost: event.target.value })} /></div>
              <div className="space-y-2"><Label>SMTP port</Label><CompactInput type="number" value={String(channel.emailSmtpPort ?? 465)} onChange={(event) => update({ emailSmtpPort: Number(event.target.value) || 465 })} /></div>
              <div className="space-y-2"><Label>From name</Label><CompactInput value={channel.emailFromName ?? ""} onChange={(event) => update({ emailFromName: event.target.value })} /></div>
              <div className="space-y-2"><Label>From address</Label><CompactInput value={channel.emailFromAddress ?? ""} onChange={(event) => update({ emailFromAddress: event.target.value })} /></div>
            </div>
            <label className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs">
              <span>Mark matched emails as read</span>
              <Switch checked={channel.emailMarkAsRead ?? true} onCheckedChange={(checked) => update({ emailMarkAsRead: checked })} />
            </label>
            <div className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <Label>Email filters</Label>
                <Button size="sm" variant="outline" onClick={() => update({ emailFilters: [...emailFilters, { id: crypto.randomUUID(), field: "subject", operator: "contains", value: "", enabled: true }] })}>Add filter</Button>
              </div>
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
                  <Button size="sm" variant="outline" onClick={() => update({ emailFilters: emailFilters.filter((item) => item.id !== filter.id) })}>Remove</Button>
                </div>
              ))}
            </div>
            <div className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <Label>Email actions</Label>
                <Button size="sm" variant="outline" onClick={() => update({ emailActions: [...emailActions, { id: crypto.randomUUID(), type: "auto_reply", value: "", enabled: true, useAgent: true }] })}>Add action</Button>
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
                  <Button size="sm" variant="outline" onClick={() => update({ emailActions: emailActions.filter((item) => item.id !== action.id) })}>Remove</Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Section>
    </div>
  )
}