import type { ChannelConfigRecord } from "@/data/domain/models"
import { CompactInput, Field, FormGroupSection } from "@/views/channels/components/channel-form-fields"

type ChannelPlatformTelegramFormProps = {
  channel: ChannelConfigRecord
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
}

export function ChannelPlatformTelegramForm({ channel, onPatch }: ChannelPlatformTelegramFormProps) {
  return (
    <div className="space-y-3">
      <FormGroupSection title="Telegram bot access" description="Use the bot token issued by @BotFather to authenticate outbound replies and webhook callbacks.">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Bot token" className="md:col-span-2"><CompactInput type="password" value={channel.telegramBotToken ?? ""} onChange={(event) => onPatch({ telegramBotToken: event.target.value })} placeholder="123456:ABC-DEF1234..." /></Field>
        </div>
      </FormGroupSection>
    </div>
  )
}