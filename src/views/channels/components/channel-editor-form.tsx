import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import type { AgentSummary, ChannelConfigRecord } from "@/data/domain/models"
import { getChannelCredentialIssues } from "@/lib/channel-config"
import { Field, CompactInput, Hint } from "@/views/channels/components/channel-form-fields"
import { ChannelPlatformCustomForm } from "@/views/channels/components/channel-platform-custom-form"
import { ChannelPlatformDingTalkForm } from "@/views/channels/components/channel-platform-dingtalk-form"
import { ChannelPlatformEmailForm } from "@/views/channels/components/channel-platform-email-form"
import { ChannelPlatformFeishuForm } from "@/views/channels/components/channel-platform-feishu-form"
import { ChannelPlatformTeamsForm } from "@/views/channels/components/channel-platform-teams-form"
import { ChannelPlatformTelegramForm } from "@/views/channels/components/channel-platform-telegram-form"
import { ChannelPlatformWeChatOfficialForm } from "@/views/channels/components/channel-platform-wechat-official-form"
import { ChannelPlatformWeChatPersonalForm } from "@/views/channels/components/channel-platform-wechat-personal-form"
import { ChannelPlatformWeChatWorkForm } from "@/views/channels/components/channel-platform-wechat-work-form"
import {
  channelPlatformOptions,
  getChannelBindingLabel,
  getChannelBindingVariant,
  getChannelCatalogLabel,
  getChannelPlatformLabel,
} from "@/views/channels/components/channel-utils"

type ChannelEditorFormProps = {
  channel: ChannelConfigRecord
  agents: AgentSummary[]
  onChange: (channel: ChannelConfigRecord) => void
  onSave: () => void
  onBind: () => void
  onConfirmWeChatBinding: () => void
  wechatVerificationCode: string
  onWechatVerificationCodeChange: (value: string) => void
  isBinding?: boolean
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

function renderPlatformForm(
  channel: ChannelConfigRecord,
  patch: (next: Partial<ChannelConfigRecord>) => void,
  wechatVerificationCode: string,
  onWechatVerificationCodeChange: (value: string) => void,
  onConfirmWeChatBinding: () => void,
  isBinding: boolean,
) {
  switch (channel.platform) {
    case "email":
      return <ChannelPlatformEmailForm channel={channel} onPatch={patch} />
    case "wechat_personal":
      return <ChannelPlatformWeChatPersonalForm channel={channel} verificationCode={wechatVerificationCode} onPatch={patch} onVerificationCodeChange={onWechatVerificationCodeChange} onConfirmBinding={onConfirmWeChatBinding} isBinding={isBinding} />
    case "wechat":
      return <ChannelPlatformWeChatWorkForm channel={channel} onPatch={patch} />
    case "wechat_official":
      return <ChannelPlatformWeChatOfficialForm channel={channel} onPatch={patch} />
    case "feishu":
      return <ChannelPlatformFeishuForm channel={channel} onPatch={patch} />
    case "dingtalk":
      return <ChannelPlatformDingTalkForm channel={channel} onPatch={patch} />
    case "telegram":
      return <ChannelPlatformTelegramForm channel={channel} onPatch={patch} />
    case "teams":
      return <ChannelPlatformTeamsForm channel={channel} onPatch={patch} />
    case "custom":
      return <ChannelPlatformCustomForm channel={channel} onPatch={patch} />
    case "web":
    default:
      return <Hint>Web channel uses the shared webhook path and reply-agent routing only.</Hint>
  }
}

export function ChannelEditorForm({
  channel,
  agents,
  onChange,
  onSave,
  onBind,
  onConfirmWeChatBinding,
  wechatVerificationCode,
  onWechatVerificationCodeChange,
  isBinding = false,
}: ChannelEditorFormProps) {
  const update = (patch: Partial<ChannelConfigRecord>) => onChange({ ...channel, ...patch })
  const credentialIssues = getChannelCredentialIssues(channel)
  const needsBindingAction = channel.platform !== "web"
  const bindButtonLabel = channel.platform === "wechat_personal"
    ? channel.wechatPersonalBindingStatus === "bound"
      ? "Rebind"
      : "Start QR binding"
    : "Bind channel"

  return (
    <div className="space-y-3">
      <Section title="Channel setup" description="Restore the main-branch channel behavior surface inside the new shell.">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Title">
            <CompactInput value={channel.title} onChange={(event) => update({ title: event.target.value })} placeholder="Channel name" />
          </Field>
          <Field label="Platform">
            <NativeSelect size="sm" value={channel.platform} onChange={(event) => update({ platform: event.target.value as ChannelConfigRecord["platform"] })}>
              {channelPlatformOptions.map((item) => <NativeSelectOption key={item.value} value={item.value}>{item.label}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <Field label="Connection mode">
            <NativeSelect size="sm" value={channel.connectionMode} onChange={(event) => update({ connectionMode: event.target.value as ChannelConfigRecord["connectionMode"] })}>
              <NativeSelectOption value="webhook">Webhook</NativeSelectOption>
              <NativeSelectOption value="stream">Stream</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field label="Reply agent">
            <NativeSelect size="sm" value={channel.replyAgentId} onChange={(event) => update({ replyAgentId: event.target.value })}>
              <NativeSelectOption value="">No agent</NativeSelectOption>
              {agents.map((agent) => <NativeSelectOption key={agent.id} value={agent.id}>{agent.title}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <Field label="Webhook path" className="md:col-span-2">
            <CompactInput value={channel.webhookPath} onChange={(event) => update({ webhookPath: event.target.value })} placeholder="/channels/my-channel" />
          </Field>
          <Field label="Webhook secret" className="md:col-span-2">
            <CompactInput value={channel.webhookSecret} onChange={(event) => update({ webhookSecret: event.target.value })} placeholder="Optional verification secret" />
          </Field>
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

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={getChannelBindingVariant(channel.bindingState)}>{getChannelBindingLabel(channel.bindingState)}</Badge>
          <div className="text-xs text-muted-foreground">{getChannelCatalogLabel(channel)} · {getChannelPlatformLabel(channel.platform)}</div>
        </div>
        {credentialIssues.length ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">Missing fields: {credentialIssues.join(", ")}.</div> : null}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onSave}>Save channel</Button>
          {needsBindingAction ? <Button size="sm" variant="outline" onClick={onBind} disabled={isBinding}>{isBinding ? "Binding..." : bindButtonLabel}</Button> : null}
        </div>
      </Section>

      <Section title="Platform details" description={`Compact fields for ${getChannelPlatformLabel(channel.platform)} configuration.`}>
        {renderPlatformForm(channel, update, wechatVerificationCode, onWechatVerificationCodeChange, onConfirmWeChatBinding, isBinding)}
      </Section>
    </div>
  )
}