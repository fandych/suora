import type { ChannelConfigRecord } from "@/data/domain/models"
import { CompactInput, Field, FormGroupSection } from "@/views/channels/components/channel-form-fields"

type ChannelPlatformWeChatMiniProgramFormProps = {
  channel: ChannelConfigRecord
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
}

export function ChannelPlatformWeChatMiniProgramForm({ channel, onPatch }: ChannelPlatformWeChatMiniProgramFormProps) {
  return (
    <div className="space-y-3">
      <FormGroupSection title="Mini Program credentials" description="Mini Program callbacks and custom-service messaging use a dedicated App ID, app secret, verification token, and optional AES key. Keep it separate from Enterprise WeChat and Official Account credentials.">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="App ID"><CompactInput value={channel.wechatMiniProgramAppId ?? ""} onChange={(event) => onPatch({ wechatMiniProgramAppId: event.target.value })} /></Field>
          <Field label="App secret"><CompactInput type="password" value={channel.wechatMiniProgramAppSecret ?? ""} onChange={(event) => onPatch({ wechatMiniProgramAppSecret: event.target.value })} /></Field>
          <Field label="Verification token"><CompactInput value={channel.wechatMiniProgramToken ?? channel.verificationToken ?? ""} onChange={(event) => onPatch({ wechatMiniProgramToken: event.target.value, verificationToken: event.target.value })} /></Field>
          <Field label="Encoding AES key"><CompactInput value={channel.wechatMiniProgramEncodingAesKey ?? channel.encryptKey ?? ""} onChange={(event) => onPatch({ wechatMiniProgramEncodingAesKey: event.target.value, encryptKey: event.target.value })} /></Field>
        </div>
      </FormGroupSection>
    </div>
  )
}