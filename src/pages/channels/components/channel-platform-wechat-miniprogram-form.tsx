import type { ChannelConfigRecord } from "@/types/channel"
import { useAppIntl } from "@/lib/i18n"
import { CompactInput, Field, FormGroupSection } from "@/pages/channels/components/channel-form-fields"

type ChannelPlatformWeChatMiniProgramFormProps = {
  channel: ChannelConfigRecord
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
}

export function ChannelPlatformWeChatMiniProgramForm({ channel, onPatch }: ChannelPlatformWeChatMiniProgramFormProps) {
  const { t } = useAppIntl()

  return (
    <div className="space-y-3">
      <FormGroupSection
        title={t("channels.wechatMiniProgram.title", "Mini Program credentials")}
        description={t(
          "channels.wechatMiniProgram.description",
          "Mini Program callbacks and custom-service messaging use a dedicated App ID, app secret, verification token, and optional AES key. Keep it separate from Enterprise WeChat and Official Account credentials.",
        )}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("channels.wechatMiniProgram.appId", "App ID")}>
            <CompactInput
              value={channel.wechatMiniProgramAppId ?? ""}
              onChange={(event) => onPatch({ wechatMiniProgramAppId: event.target.value })}
            />
          </Field>
          <Field label={t("channels.wechatMiniProgram.appSecret", "App secret")}>
            <CompactInput
              type="password"
              value={channel.wechatMiniProgramAppSecret ?? ""}
              onChange={(event) => onPatch({ wechatMiniProgramAppSecret: event.target.value })}
            />
          </Field>
          <Field label={t("channels.wechatMiniProgram.verificationToken", "Verification token")}>
            <CompactInput
              value={channel.wechatMiniProgramToken ?? channel.verificationToken ?? ""}
              onChange={(event) =>
                onPatch({ wechatMiniProgramToken: event.target.value, verificationToken: event.target.value })
              }
            />
          </Field>
          <Field label={t("channels.wechatMiniProgram.encodingAesKey", "Encoding AES key")}>
            <CompactInput
              value={channel.wechatMiniProgramEncodingAesKey ?? channel.encryptKey ?? ""}
              onChange={(event) =>
                onPatch({ wechatMiniProgramEncodingAesKey: event.target.value, encryptKey: event.target.value })
              }
            />
          </Field>
        </div>
      </FormGroupSection>
    </div>
  )
}
