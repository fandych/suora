import type { ChannelConfigRecord } from "@/data/domain/models"
import { CompactInput, CompactTextarea, Field, Hint } from "@/views/channels/components/channel-form-fields"

type ChannelPlatformCustomFormProps = {
  channel: ChannelConfigRecord
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
}

export function ChannelPlatformCustomForm({ channel, onPatch }: ChannelPlatformCustomFormProps) {
  const isStream = channel.connectionMode === "stream"

  return (
    <div className="space-y-3">
      <Hint>{isStream ? "自定义 WebSocket channel 会通过长连接接收与发送消息。" : "自定义 Webhook channel 使用 HTTP endpoint 接收消息并使用可选模板回发。"}</Hint>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Display name"><CompactInput value={channel.customPlatformName ?? ""} onChange={(event) => onPatch({ customPlatformName: event.target.value })} placeholder="My Bot" /></Field>
        <Field label="Display icon"><CompactInput value={channel.customPlatformIcon ?? ""} onChange={(event) => onPatch({ customPlatformIcon: event.target.value })} placeholder="UI initials or icon hint" /></Field>
        {isStream ? (
          <>
            <Field label="WebSocket URL" className="md:col-span-2"><CompactInput value={channel.customWebsocketUrl ?? ""} onChange={(event) => onPatch({ customWebsocketUrl: event.target.value })} placeholder="wss://example.com/socket" /></Field>
            <Field label="Subprotocol"><CompactInput value={channel.customWebsocketProtocol ?? ""} onChange={(event) => onPatch({ customWebsocketProtocol: event.target.value })} placeholder="Optional protocol name" /></Field>
          </>
        ) : (
          <Field label="Outgoing webhook" className="md:col-span-2"><CompactInput value={channel.customWebhookUrl ?? ""} onChange={(event) => onPatch({ customWebhookUrl: event.target.value })} placeholder="https://example.com/webhook" /></Field>
        )}
        <Field label="Auth header"><CompactInput value={channel.customAuthHeader ?? ""} onChange={(event) => onPatch({ customAuthHeader: event.target.value })} placeholder="Authorization" /></Field>
        <Field label="Auth value"><CompactInput value={channel.customAuthValue ?? ""} onChange={(event) => onPatch({ customAuthValue: event.target.value })} placeholder="Bearer ..." /></Field>
        <Field label="Payload template" className="md:col-span-2">
          <CompactTextarea value={channel.customPayloadTemplate ?? "{\n  \"message\": \"{{content}}\"\n}"} onChange={(event) => onPatch({ customPayloadTemplate: event.target.value })} />
        </Field>
      </div>
    </div>
  )
}