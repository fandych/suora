import type { ChannelConfigRecord } from "@/types/channel"
import { useAppIntl } from "@/lib/i18n"
import { CompactInput, Field, FormGroupSection } from "@/pages/channels/components/channel-form-fields"

type ChannelPlatformTelegramFormProps = {
  channel: ChannelConfigRecord
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
}

export function ChannelPlatformTelegramForm({ channel, onPatch }: ChannelPlatformTelegramFormProps) {
  const { t } = useAppIntl()

  return (
    <div className="space-y-3">
      <FormGroupSection
        title={t("channels.telegram.title", "Telegram bot access")}
        description={t(
          "channels.telegram.description",
          "Use the bot token issued by @BotFather to authenticate outbound replies and webhook callbacks.",
        )}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("channels.telegram.botToken", "Bot token")} className="md:col-span-2">
            <CompactInput
              type="password"
              value={channel.telegramBotToken ?? ""}
              onChange={(event) => onPatch({ telegramBotToken: event.target.value })}
              placeholder={t("channels.telegram.botTokenPlaceholder", "123456:ABC-DEF1234...")}
            />
          </Field>
        </div>
      </FormGroupSection>
    </div>
  )
}
