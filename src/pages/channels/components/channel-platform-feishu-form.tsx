import type { ChannelConfigRecord } from "@/types/channel"
import { useAppIntl } from "@/lib/i18n"
import { CompactInput, Field, FormGroupSection } from "@/pages/channels/components/channel-form-fields"

type ChannelPlatformFeishuFormProps = {
  channel: ChannelConfigRecord
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
}

export function ChannelPlatformFeishuForm({ channel, onPatch }: ChannelPlatformFeishuFormProps) {
  const { t } = useAppIntl()

  return (
    <div className="space-y-3">
      <FormGroupSection
        title={t("channels.feishu.title", "Feishu verification")}
        description={t(
          "channels.feishu.description",
          "Use the verification token and encrypt key from the Feishu bot console so webhook traffic can be validated correctly.",
        )}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("channels.feishu.appId", "App ID")}>
            <CompactInput
              value={channel.feishuAppId ?? channel.appId ?? ""}
              onChange={(event) => onPatch({ feishuAppId: event.target.value, appId: event.target.value })}
            />
          </Field>
          <Field label={t("channels.feishu.appSecret", "App secret")}>
            <CompactInput
              type="password"
              value={channel.feishuAppSecret ?? channel.appSecret ?? ""}
              onChange={(event) => onPatch({ feishuAppSecret: event.target.value, appSecret: event.target.value })}
            />
          </Field>
          <Field label={t("channels.feishu.verificationToken", "Verification token")}>
            <CompactInput
              value={channel.feishuVerificationToken ?? channel.verificationToken ?? ""}
              onChange={(event) =>
                onPatch({ feishuVerificationToken: event.target.value, verificationToken: event.target.value })
              }
            />
          </Field>
          <Field label={t("channels.feishu.encryptKey", "Encrypt key")}>
            <CompactInput
              value={channel.feishuEncryptKey ?? channel.encryptKey ?? ""}
              onChange={(event) => onPatch({ feishuEncryptKey: event.target.value, encryptKey: event.target.value })}
              placeholder={t("channels.feishu.optional", "Optional")}
            />
          </Field>
          <Field label={t("channels.feishu.appWebhookUrl", "App webhook URL")} className="md:col-span-2">
            <CompactInput
              value={channel.feishuWebhookUrl ?? ""}
              onChange={(event) => onPatch({ feishuWebhookUrl: event.target.value })}
              placeholder={t("channels.feishu.outgoingWebhookPlaceholder", "Optional outgoing webhook")}
            />
          </Field>
        </div>
      </FormGroupSection>
    </div>
  )
}
