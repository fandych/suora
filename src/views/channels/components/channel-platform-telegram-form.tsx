import type { ChannelConfigRecord } from "@/data/domain/models"
import { CompactInput, Field, Hint } from "@/views/channels/components/channel-form-fields"

type ChannelPlatformTelegramFormProps = {
  channel: ChannelConfigRecord
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
}

export function ChannelPlatformTelegramForm({ channel, onPatch }: ChannelPlatformTelegramFormProps) {
  return (
    <div className="space-y-3">
      <Hint>使用 @BotFather 签发的 Bot Token 作为 Telegram channel 的接入凭据。</Hint>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Bot token" className="md:col-span-2"><CompactInput type="password" value={channel.telegramBotToken ?? ""} onChange={(event) => onPatch({ telegramBotToken: event.target.value })} placeholder="123456:ABC-DEF1234..." /></Field>
      </div>
    </div>
  )
}