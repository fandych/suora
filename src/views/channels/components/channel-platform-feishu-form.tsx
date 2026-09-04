import type { ChannelConfigRecord } from "@/data/domain/models"
import { CompactInput, Field, FormGroupSection } from "@/views/channels/components/channel-form-fields"

type ChannelPlatformFeishuFormProps = {
  channel: ChannelConfigRecord
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
}

export function ChannelPlatformFeishuForm({ channel, onPatch }: ChannelPlatformFeishuFormProps) {
  return (
    <div className="space-y-3">
      <FormGroupSection title="Feishu verification" description="Use the verification token and encrypt key from the Feishu bot console so webhook traffic can be validated correctly.">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="App ID"><CompactInput value={channel.feishuAppId ?? channel.appId ?? ""} onChange={(event) => onPatch({ feishuAppId: event.target.value, appId: event.target.value })} /></Field>
          <Field label="App secret"><CompactInput type="password" value={channel.feishuAppSecret ?? channel.appSecret ?? ""} onChange={(event) => onPatch({ feishuAppSecret: event.target.value, appSecret: event.target.value })} /></Field>
          <Field label="Verification token"><CompactInput value={channel.feishuVerificationToken ?? channel.verificationToken ?? ""} onChange={(event) => onPatch({ feishuVerificationToken: event.target.value, verificationToken: event.target.value })} /></Field>
          <Field label="Encrypt key"><CompactInput value={channel.feishuEncryptKey ?? channel.encryptKey ?? ""} onChange={(event) => onPatch({ feishuEncryptKey: event.target.value, encryptKey: event.target.value })} placeholder="Optional" /></Field>
          <Field label="App webhook URL" className="md:col-span-2"><CompactInput value={channel.feishuWebhookUrl ?? ""} onChange={(event) => onPatch({ feishuWebhookUrl: event.target.value })} placeholder="Optional outgoing webhook" /></Field>
        </div>
      </FormGroupSection>
    </div>
  )
}