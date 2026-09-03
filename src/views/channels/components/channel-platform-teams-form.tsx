import type { ChannelConfigRecord } from "@/data/domain/models"
import { CompactInput, Field, Hint } from "@/views/channels/components/channel-form-fields"

type ChannelPlatformTeamsFormProps = {
  channel: ChannelConfigRecord
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
}

export function ChannelPlatformTeamsForm({ channel, onPatch }: ChannelPlatformTeamsFormProps) {
  return (
    <div className="space-y-3">
      <Hint>Teams channel binds to an Azure Bot registration. App ID and client secret are required before activation.</Hint>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="App ID"><CompactInput value={channel.teamsAppId ?? ""} onChange={(event) => onPatch({ teamsAppId: event.target.value })} /></Field>
        <Field label="App password"><CompactInput type="password" value={channel.teamsAppPassword ?? ""} onChange={(event) => onPatch({ teamsAppPassword: event.target.value })} /></Field>
        <Field label="Tenant ID"><CompactInput value={channel.teamsTenantId ?? ""} onChange={(event) => onPatch({ teamsTenantId: event.target.value })} placeholder="Optional" /></Field>
        <Field label="Bot endpoint"><CompactInput value={channel.teamsBotEndpoint ?? channel.callbackUrl ?? ""} onChange={(event) => onPatch({ teamsBotEndpoint: event.target.value })} placeholder="Auto-filled after binding" /></Field>
      </div>
    </div>
  )
}