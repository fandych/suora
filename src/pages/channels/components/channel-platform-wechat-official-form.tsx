import type { ChannelConfigRecord } from "@/types/channel"
import { useAppIntl } from "@/lib/i18n"
import { CompactInput, Field, FormGroupSection } from "@/pages/channels/components/channel-form-fields"

type ChannelPlatformWeChatOfficialFormProps = {
  channel: ChannelConfigRecord
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
}

export function ChannelPlatformWeChatOfficialForm({ channel, onPatch }: ChannelPlatformWeChatOfficialFormProps) {
  const { t } = useAppIntl()

  return (
    <div className="space-y-3">
      <FormGroupSection
        title={t("channels.wechatOfficial.title", "Official account verification")}
        description={t(
          "channels.wechatOfficial.description",
          "WeChat Official Accounts validate each request with the token configured in the management portal.",
        )}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("channels.wechatOfficial.appId", "App ID")}>
            <CompactInput
              value={channel.wechatOfficialAppId ?? ""}
              onChange={(event) => onPatch({ wechatOfficialAppId: event.target.value })}
            />
          </Field>
          <Field label={t("channels.wechatOfficial.appSecret", "App secret")}>
            <CompactInput
              type="password"
              value={channel.wechatOfficialAppSecret ?? ""}
              onChange={(event) => onPatch({ wechatOfficialAppSecret: event.target.value })}
            />
          </Field>
          <Field label={t("channels.wechatOfficial.verificationToken", "Verification token")}>
            <CompactInput
              value={channel.wechatOfficialToken ?? channel.verificationToken ?? ""}
              onChange={(event) =>
                onPatch({ wechatOfficialToken: event.target.value, verificationToken: event.target.value })
              }
            />
          </Field>
          <Field label={t("channels.wechatOfficial.encodingAesKey", "Encoding AES key")}>
            <CompactInput
              value={channel.encryptKey ?? ""}
              onChange={(event) => onPatch({ encryptKey: event.target.value })}
            />
          </Field>
        </div>
      </FormGroupSection>
    </div>
  )
}
