import type { ChannelConfigRecord } from "@/data/domain/models"
import { CompactInput, Field, Hint } from "@/views/channels/components/channel-form-fields"

type ChannelPlatformWeChatWorkFormProps = {
  channel: ChannelConfigRecord
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
}

export function ChannelPlatformWeChatWorkForm({ channel, onPatch }: ChannelPlatformWeChatWorkFormProps) {
  return (
    <div className="space-y-3">
      <Hint>企业微信使用事件回调 URL 接收入站消息，并使用企业应用凭据完成回发。</Hint>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Corp ID"><CompactInput value={channel.wechatCorpId ?? ""} onChange={(event) => onPatch({ wechatCorpId: event.target.value })} placeholder="ww..." /></Field>
        <Field label="Agent ID"><CompactInput value={channel.wechatAgentId ?? ""} onChange={(event) => onPatch({ wechatAgentId: event.target.value })} placeholder="1000002" /></Field>
        <Field label="App secret"><CompactInput type="password" value={channel.appSecret ?? ""} onChange={(event) => onPatch({ appSecret: event.target.value })} placeholder="Application secret" /></Field>
        <Field label="Verification token"><CompactInput value={channel.wechatToken ?? channel.verificationToken ?? ""} onChange={(event) => onPatch({ wechatToken: event.target.value, verificationToken: event.target.value })} placeholder="Callback token" /></Field>
        <Field label="Encoding AES key" className="md:col-span-2"><CompactInput value={channel.wechatEncodingAesKey ?? channel.encryptKey ?? ""} onChange={(event) => onPatch({ wechatEncodingAesKey: event.target.value, encryptKey: event.target.value })} placeholder="43-character AES key" /></Field>
      </div>
    </div>
  )
}