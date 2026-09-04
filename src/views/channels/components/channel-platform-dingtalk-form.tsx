import type { ChannelConfigRecord } from "@/data/domain/models"
import { CompactInput, Field, FormGroupSection, Hint } from "@/views/channels/components/channel-form-fields"

type ChannelPlatformDingTalkFormProps = {
  channel: ChannelConfigRecord
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
}

export function ChannelPlatformDingTalkForm({ channel, onPatch }: ChannelPlatformDingTalkFormProps) {
  const isStream = channel.connectionMode === "stream"

  return (
    <div className="space-y-3">
      <FormGroupSection
        title="Transport"
        description={isStream ? "Stream mode keeps the desktop app connected over WebSocket, so you do not need a public callback URL." : "Webhook mode expects DingTalk to POST events into the workspace through the configured robot endpoint."}
      >
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
      </FormGroupSection>
      <Hint>{isStream ? "DingTalk Stream mode requires enterprise app credentials and a robot code." : "DingTalk Webhook mode requires the robot webhook URL and signing secret."}</Hint>
    </div>
  )
}