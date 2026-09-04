import { useState } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader } from "@/components/ui/message"
import { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport } from "@/components/ui/message-scroller"
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import type { AgentSummary, ChannelConfigRecord, ChannelMessageRecord, ProviderConfigRecord } from "@/data/domain/models"
import { getChannelCredentialIssues } from "@/lib/channel-config"
import { CompactInput, CompactTextarea, Field, Hint } from "@/views/channels/components/channel-form-fields"
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

const groupedChannelPlatformOptions: Array<{ label: string; values: ChannelConfigRecord["platform"][] }> = [
  { label: "Chinese platforms", values: ["feishu", "dingtalk", "wechat", "wechat_personal", "wechat_official"] },
  { label: "International platforms", values: ["telegram", "teams", "email"] },
  { label: "Other", values: ["web", "custom"] },
]

type ChannelEditorFormProps = {
  channel: ChannelConfigRecord
  agents: AgentSummary[]
  providers: ProviderConfigRecord[]
  messageRecords: ChannelMessageRecord[]
  showWechatVerification: boolean
  onChange: (channel: ChannelConfigRecord) => void
  onSave: () => void
  onBind: () => void
  onConfirmWeChatBinding: () => void
  wechatVerificationCode: string
  onWechatVerificationCodeChange: (value: string) => void
  isBinding?: boolean
}

function ChannelHistoryMessageItem({ message }: { message: ChannelMessageRecord }) {
  const role = message.direction === "outgoing" ? "assistant" : message.direction === "incoming" ? "user" : "system"
  const align = role === "assistant" ? "end" : "start"
  const label = role === "assistant" ? (message.senderName || "Reply agent") : role === "user" ? (message.senderName || "Contact") : "System"
  const bubbleVariant = role === "system" ? "muted" : "outline"

  return (
    <Message align={align}>
      <MessageAvatar className="self-start bg-transparent">
        <Avatar size="sm" className="bg-background">
          <AvatarFallback>{role === "assistant" ? "A" : role === "user" ? "U" : "S"}</AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>{label}</MessageHeader>
        <div className={cn("flex w-full min-w-0 flex-col gap-1", role === "assistant" ? "self-end items-end" : "self-start items-start")}>
          <Bubble variant={bubbleVariant} align={align} className="max-w-full">
            <BubbleContent>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{message.content}</div>
            </BubbleContent>
          </Bubble>
          <MessageFooter>{new Date(message.createdAt).toLocaleString()} · {message.direction} · {message.status}</MessageFooter>
        </div>
      </MessageContent>
    </Message>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  )
}

function MessageRecordSection({ messages }: { messages: ChannelMessageRecord[] }) {
  const orderedMessages = [...messages].sort((left, right) => left.createdAt - right.createdAt)
  const [open, setOpen] = useState(false)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Message record</CardTitle>
        <CardDescription className="text-xs">Recent inbound and outbound channel traffic. Open the transcript in a separate layer.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <div className="flex items-center gap-2 text-sm">
            <span>History messages</span>
            <Badge variant="secondary">{orderedMessages.length}</Badge>
          </div>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={orderedMessages.length === 0}>Open transcript</Button>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="flex h-[min(88vh,64rem)] max-w-[min(96vw,88rem)] flex-col overflow-hidden p-0" showCloseButton>
            <DialogHeader className="border-b px-4 py-3">
              <DialogTitle>History messages</DialogTitle>
              <DialogDescription>Channel transcript rendered with the shared chat message layout.</DialogDescription>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <MessageScrollerProvider autoScroll defaultScrollPosition="end" scrollPreviousItemPeek={12}>
                <MessageScroller className="flex-1 min-h-0">
                  <MessageScrollerViewport aria-label="Channel transcript" className="bg-muted/20">
                    <MessageScrollerContent className="min-h-0 gap-3 px-4 py-4">
                      {orderedMessages.map((message) => (
                        <MessageScrollerItem key={message.id} messageId={message.id}>
                          <ChannelHistoryMessageItem message={message} />
                        </MessageScrollerItem>
                      ))}
                      <MessageScrollerItem messageId="channel-history-end" scrollAnchor className="h-px" />
                    </MessageScrollerContent>
                  </MessageScrollerViewport>
                  <MessageScrollerButton />
                </MessageScroller>
              </MessageScrollerProvider>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

function supportsMethodSelection(channel: ChannelConfigRecord) {
  return channel.platform === "dingtalk" || channel.platform === "custom"
}

function showsWebhookPathField(channel: ChannelConfigRecord) {
  if (channel.platform === "wechat_personal") {
    return false
  }

  if (channel.platform === "custom") {
    return false
  }

  if (channel.connectionMode === "stream") {
    return false
  }

  return channel.platform !== "email"
}

function getWebhookSecretLabel(channel: ChannelConfigRecord) {
  switch (channel.platform) {
    case "telegram":
      return "Webhook secret"
    case "custom":
      return channel.connectionMode === "webhook" ? "Webhook secret" : null
    case "email":
      return channel.connectionMode === "webhook" ? "Webhook secret" : null
    default:
      return null
  }
}

function renderPlatformForm(
  channel: ChannelConfigRecord,
  patch: (next: Partial<ChannelConfigRecord>) => void,
  wechatVerificationCode: string,
  showWechatVerification: boolean,
  onBind: () => void,
  onWechatVerificationCodeChange: (value: string) => void,
  onConfirmWeChatBinding: () => void,
  isBinding: boolean,
) {
  switch (channel.platform) {
    case "email":
      return <ChannelPlatformEmailForm channel={channel} onPatch={patch} />
    case "wechat_personal":
      return <ChannelPlatformWeChatPersonalForm channel={channel} verificationCode={wechatVerificationCode} showVerification={showWechatVerification} onBind={onBind} onVerificationCodeChange={onWechatVerificationCodeChange} onConfirmBinding={onConfirmWeChatBinding} isBinding={isBinding} />
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

function BasicChannelForm({
  channel,
  agents,
  providers,
  onChange,
  onSave,
  onBind,
  isBinding,
  credentialIssues,
}: {
  channel: ChannelConfigRecord
  agents: AgentSummary[]
  providers: ProviderConfigRecord[]
  onChange: (channel: ChannelConfigRecord) => void
  onSave: () => void
  onBind: () => void
  isBinding: boolean
  credentialIssues: string[]
}) {
  const update = (patch: Partial<ChannelConfigRecord>) => onChange({ ...channel, ...patch })
  const needsBindingAction = channel.platform !== "web" && channel.platform !== "wechat_personal"
  const modelValue = channel.providerId && channel.modelId ? `${channel.providerId}::${channel.modelId}` : ""
  const selectableProviders = providers.filter((provider) => provider.models.length > 0)

  return (
    <Section title="General">
      <div className="space-y-3">
        <Field label="Name">
          <CompactInput value={channel.title} onChange={(event) => update({ title: event.target.value })} placeholder="Channel name" />
        </Field>
        <Field label="Description">
          <CompactTextarea value={channel.description ?? ""} onChange={(event) => update({ description: event.target.value })} placeholder="Describe what this channel is for." />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Agent">
            <NativeSelect className="w-full" size="sm" value={channel.replyAgentId} onChange={(event) => update({ replyAgentId: event.target.value })}>
              <NativeSelectOption value="">No agent</NativeSelectOption>
              {agents.map((agent) => <NativeSelectOption key={agent.id} value={agent.id}>{agent.title}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <Field label="Model">
            <NativeSelect className="w-full" size="sm" value={modelValue} onChange={(event) => {
              const [providerId, modelId] = event.target.value.split("::")
              update({ providerId: providerId ?? "", modelId: modelId ?? "" })
            }}>
              <NativeSelectOption value="">No model</NativeSelectOption>
              {selectableProviders.map((provider) => (
                <NativeSelectOptGroup key={provider.id} label={provider.title}>
                  {provider.models.map((model) => <NativeSelectOption key={`${provider.id}-${model.id}`} value={`${provider.id}::${model.id}`}>{model.name}</NativeSelectOption>)}
                </NativeSelectOptGroup>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
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
          {needsBindingAction ? <Button size="sm" variant="outline" onClick={onBind} disabled={isBinding}>{isBinding ? "Binding..." : "Bind channel"}</Button> : null}
        </div>
      </div>
    </Section>
  )
}

export function ChannelEditorForm({
  channel,
  agents,
  providers,
  messageRecords,
  showWechatVerification,
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
  const showMethodField = supportsMethodSelection(channel)
  const showWebhookPath = showsWebhookPathField(channel)
  const webhookSecretLabel = getWebhookSecretLabel(channel)

  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.35fr)]">
        <BasicChannelForm channel={channel} agents={agents} providers={providers} onChange={onChange} onSave={onSave} onBind={onBind} isBinding={isBinding} credentialIssues={credentialIssues} />

        <Section title="Channel Configuration">
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Provider" className={channel.platform === "wechat_personal" ? "md:col-span-2" : undefined}>
                <NativeSelect className="w-full" size="sm" value={channel.platform} onChange={(event) => {
                  const nextPlatform = event.target.value as ChannelConfigRecord["platform"]
                  update({
                    platform: nextPlatform,
                    connectionMode: nextPlatform === "wechat_personal" ? "stream" : channel.connectionMode,
                  })
                }}>
                  {groupedChannelPlatformOptions.map((group) => (
                    <NativeSelectOptGroup key={group.label} label={group.label}>
                      {group.values.map((value) => {
                        const item = channelPlatformOptions.find((candidate) => candidate.value === value)
                        if (!item) {
                          return null
                        }

                        return <NativeSelectOption key={item.value} value={item.value}>{item.label}</NativeSelectOption>
                      })}
                    </NativeSelectOptGroup>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            {showMethodField || showWebhookPath || webhookSecretLabel ? (
              <div className="grid gap-3 md:grid-cols-2">
                {showMethodField ? (
                  <Field label="Method">
                    <NativeSelect className="w-full" size="sm" value={channel.connectionMode} onChange={(event) => update({ connectionMode: event.target.value as ChannelConfigRecord["connectionMode"] })}>
                      <NativeSelectOption value="webhook">Webhook</NativeSelectOption>
                      <NativeSelectOption value="stream">Stream</NativeSelectOption>
                    </NativeSelect>
                  </Field>
                ) : null}
                {showWebhookPath ? (
                  <Field label="Webhook path">
                    <CompactInput value={channel.webhookPath} onChange={(event) => update({ webhookPath: event.target.value })} placeholder="/channels/my-channel" />
                  </Field>
                ) : null}
                {webhookSecretLabel ? (
                  <Field label={webhookSecretLabel} className={showMethodField || showWebhookPath ? "md:col-span-2" : undefined}>
                    <CompactInput value={channel.webhookSecret} onChange={(event) => update({ webhookSecret: event.target.value })} placeholder="Optional verification secret" />
                  </Field>
                ) : null}
              </div>
            ) : null}
            {renderPlatformForm(channel, update, wechatVerificationCode, showWechatVerification, onBind, onWechatVerificationCodeChange, onConfirmWeChatBinding, isBinding)}
            {channel.platform !== "wechat_personal" ? (
              <div className="flex justify-end">
                <Button size="sm" onClick={onSave}>Save channel</Button>
              </div>
            ) : null}
          </div>
        </Section>
      </div>

      <MessageRecordSection messages={messageRecords} />
    </div>
  )
}
