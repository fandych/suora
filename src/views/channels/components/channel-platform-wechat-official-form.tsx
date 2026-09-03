import type { ChannelConfigRecord } from "@/data/domain/models"
import { CompactInput, Field, Hint } from "@/views/channels/components/channel-form-fields"

type ChannelPlatformWeChatOfficialFormProps = {
  channel: ChannelConfigRecord
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
}

export function ChannelPlatformWeChatOfficialForm({ channel, onPatch }: ChannelPlatformWeChatOfficialFormProps) {
  return (
    <div className="space-y-3">
      <Hint>公众号通道保留旧版能力面，使用 AppID、AppSecret、Token 和可选消息加密参数。</Hint>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="App ID"><CompactInput value={channel.wechatOfficialAppId ?? ""} onChange={(event) => onPatch({ wechatOfficialAppId: event.target.value })} /></Field>
        <Field label="App secret"><CompactInput type="password" value={channel.wechatOfficialAppSecret ?? ""} onChange={(event) => onPatch({ wechatOfficialAppSecret: event.target.value })} /></Field>
        <Field label="Verification token"><CompactInput value={channel.wechatOfficialToken ?? channel.verificationToken ?? ""} onChange={(event) => onPatch({ wechatOfficialToken: event.target.value, verificationToken: event.target.value })} /></Field>
        <Field label="Encoding AES key"><CompactInput value={channel.encryptKey ?? ""} onChange={(event) => onPatch({ encryptKey: event.target.value })} /></Field>
      </div>
    </div>
  )
}