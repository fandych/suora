import type { ChannelConfigRecord } from "@/data/domain/models"
import { CompactInput, CompactTextarea, Field, Hint } from "@/views/channels/components/channel-form-fields"

type ChannelPlatformCustomFormProps = {
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
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{title}</div>
        <Hint>{description}</Hint>
      </div>
      {children}
    </div>
  )
}

export function ChannelPlatformCustomForm({ channel, onPatch }: ChannelPlatformCustomFormProps) {
  const isStream = channel.connectionMode === "stream"

  return (
    <div className="space-y-3">
      <GroupSection title="Identity" description="Name the custom platform and define any branding that should appear in the workbench.">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Display name"><CompactInput value={channel.customPlatformName ?? ""} onChange={(event) => onPatch({ customPlatformName: event.target.value })} placeholder="e.g. LINE, WhatsApp, My Bot" /></Field>
          <Field label="Display icon"><CompactInput value={channel.customPlatformIcon ?? ""} onChange={(event) => onPatch({ customPlatformIcon: event.target.value })} placeholder="e.g. mdi:chat, lucide:bot" /></Field>
        </div>
      </GroupSection>

      <GroupSection title="Custom delivery" description={isStream ? "Define the persistent WebSocket endpoint that will receive and send messages for this custom integration." : "Define how outgoing replies leave the workspace when you are integrating a platform that is not built in."}>
        {isStream ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="WebSocket URL" className="md:col-span-2"><CompactInput value={channel.customWebsocketUrl ?? ""} onChange={(event) => onPatch({ customWebsocketUrl: event.target.value })} placeholder="wss://example.com/socket" /></Field>
            <Field label="Subprotocol"><CompactInput value={channel.customWebsocketProtocol ?? ""} onChange={(event) => onPatch({ customWebsocketProtocol: event.target.value })} placeholder="Optional protocol name" /></Field>
          </div>
        ) : (
          <Field label="Outgoing webhook URL"><CompactInput value={channel.customWebhookUrl ?? ""} onChange={(event) => onPatch({ customWebhookUrl: event.target.value })} placeholder="https://your-api.example.com/send" /></Field>
        )}
      </GroupSection>

      <GroupSection title="Authentication" description="Add optional headers when the remote endpoint requires credentials or a shared secret.">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Auth header name"><CompactInput value={channel.customAuthHeader ?? ""} onChange={(event) => onPatch({ customAuthHeader: event.target.value })} placeholder="e.g. Authorization, X-API-Key" /></Field>
          <Field label="Auth header value"><CompactInput value={channel.customAuthValue ?? ""} onChange={(event) => onPatch({ customAuthValue: event.target.value })} placeholder="e.g. Bearer your-token" /></Field>
        </div>
      </GroupSection>

      <GroupSection title="Payload template" description="Use {{content}} and {{chatId}} as placeholders inside the outgoing payload.">
        <Field label="Payload template" className="md:col-span-2">
          <CompactTextarea value={channel.customPayloadTemplate ?? "{\n  \"chat_id\": \"{{chatId}}\",\n  \"text\": \"{{content}}\"\n}"} onChange={(event) => onPatch({ customPayloadTemplate: event.target.value })} />
        </Field>
      </GroupSection>
    </div>
  )
}