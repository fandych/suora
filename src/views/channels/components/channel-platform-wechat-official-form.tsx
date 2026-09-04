import type { ChannelConfigRecord } from "@/data/domain/models"
import { CompactInput, Field, FormGroupSection } from "@/views/channels/components/channel-form-fields"

type ChannelPlatformWeChatOfficialFormProps = {
  channel: ChannelConfigRecord
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
}

export function ChannelPlatformWeChatOfficialForm({ channel, onPatch }: ChannelPlatformWeChatOfficialFormProps) {
  return (
    <div className="space-y-3">
      <FormGroupSection title="Official account verification" description="WeChat Official Accounts validate each request with the token configured in the management portal.">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="App ID"><CompactInput value={channel.wechatOfficialAppId ?? ""} onChange={(event) => onPatch({ wechatOfficialAppId: event.target.value })} /></Field>
          <Field label="App secret"><CompactInput type="password" value={channel.wechatOfficialAppSecret ?? ""} onChange={(event) => onPatch({ wechatOfficialAppSecret: event.target.value })} /></Field>
          <Field label="Verification token"><CompactInput value={channel.wechatOfficialToken ?? channel.verificationToken ?? ""} onChange={(event) => onPatch({ wechatOfficialToken: event.target.value, verificationToken: event.target.value })} /></Field>
          <Field label="Encoding AES key"><CompactInput value={channel.encryptKey ?? ""} onChange={(event) => onPatch({ encryptKey: event.target.value })} /></Field>
        </div>
      </FormGroupSection>
    </div>
  )
}