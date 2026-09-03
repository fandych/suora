import type { ChannelConfigRecord } from "@/data/domain/models"
import { CompactInput, Field, Hint } from "@/views/channels/components/channel-form-fields"

type ChannelPlatformDingTalkFormProps = {
  channel: ChannelConfigRecord
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
}

export function ChannelPlatformDingTalkForm({ channel, onPatch }: ChannelPlatformDingTalkFormProps) {
  const isStream = channel.connectionMode === "stream"

  return (
    <div className="space-y-3">
      <Hint>{isStream ? "钉钉 Stream 模式需要企业应用凭据和机器人代码。" : "钉钉 Webhook 模式需要机器人 Webhook 地址与签名密钥。"}</Hint>
      <div className="grid gap-3 md:grid-cols-2">
        {isStream ? (
          <>
            <Field label="Client ID"><CompactInput value={channel.dingtalkClientId ?? channel.appId ?? ""} onChange={(event) => onPatch({ dingtalkClientId: event.target.value, appId: event.target.value })} /></Field>
            <Field label="Client secret"><CompactInput type="password" value={channel.dingtalkClientSecret ?? channel.appSecret ?? ""} onChange={(event) => onPatch({ dingtalkClientSecret: event.target.value, appSecret: event.target.value })} /></Field>
            <Field label="Robot code" className="md:col-span-2"><CompactInput value={channel.dingtalkRobotCode ?? ""} onChange={(event) => onPatch({ dingtalkRobotCode: event.target.value })} placeholder="dingxxxxxxxx" /></Field>
          </>
        ) : (
          <>
            <Field label="Robot webhook URL" className="md:col-span-2"><CompactInput value={channel.dingtalkWebhookUrl ?? ""} onChange={(event) => onPatch({ dingtalkWebhookUrl: event.target.value })} placeholder="https://oapi.dingtalk.com/robot/send?..." /></Field>
            <Field label="Signing secret" className="md:col-span-2"><CompactInput type="password" value={channel.dingtalkSigningSecret ?? ""} onChange={(event) => onPatch({ dingtalkSigningSecret: event.target.value })} placeholder="SEC..." /></Field>
          </>
        )}
      </div>
    </div>
  )
}