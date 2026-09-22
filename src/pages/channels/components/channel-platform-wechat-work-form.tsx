import type { ChannelConfigRecord } from "@/types/channel"
import { useAppIntl } from "@/lib/i18n"
import { CompactInput, Field, FormGroupSection } from "@/pages/channels/components/channel-form-fields"

type ChannelPlatformWeChatWorkFormProps = {
  channel: ChannelConfigRecord
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
}

export function ChannelPlatformWeChatWorkForm({ channel, onPatch }: ChannelPlatformWeChatWorkFormProps) {
  const { t } = useAppIntl()

  return (
    <div className="space-y-3">
      <FormGroupSection
        title={t("channels.wechatWork.title", "Enterprise WeChat verification")}
        description={t(
          "channels.wechatWork.description",
          "Enterprise WeChat uses the callback token and AES key from the event subscription setup to validate inbound webhook traffic.",
        )}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("channels.wechatWork.corpId", "Corp ID")}>
            <CompactInput
              value={channel.wechatCorpId ?? ""}
              onChange={(event) => onPatch({ wechatCorpId: event.target.value })}
              placeholder="ww..."
            />
          </Field>
          <Field label={t("channels.wechatWork.agentId", "Agent ID")}>
            <CompactInput
              value={channel.wechatAgentId ?? ""}
              onChange={(event) => onPatch({ wechatAgentId: event.target.value })}
              placeholder="1000002"
            />
          </Field>
          <Field label={t("channels.wechatWork.appSecret", "App secret")}>
            <CompactInput
              type="password"
              value={channel.appSecret ?? ""}
              onChange={(event) => onPatch({ appSecret: event.target.value })}
              placeholder={t("channels.wechatWork.appSecretPlaceholder", "Application secret")}
            />
          </Field>
          <Field label={t("channels.wechatWork.verificationToken", "Verification token")}>
            <CompactInput
              value={channel.wechatToken ?? channel.verificationToken ?? ""}
              onChange={(event) => onPatch({ wechatToken: event.target.value, verificationToken: event.target.value })}
              placeholder={t("channels.wechatWork.verificationTokenPlaceholder", "Callback token")}
            />
          </Field>
          <Field label={t("channels.wechatWork.encodingAesKey", "Encoding AES key")} className="md:col-span-2">
            <CompactInput
              value={channel.wechatEncodingAesKey ?? channel.encryptKey ?? ""}
              onChange={(event) =>
                onPatch({ wechatEncodingAesKey: event.target.value, encryptKey: event.target.value })
              }
              placeholder={t("channels.wechatWork.encodingAesKeyPlaceholder", "43-character AES key")}
            />
          </Field>
        </div>
      </FormGroupSection>
    </div>
  )
}
