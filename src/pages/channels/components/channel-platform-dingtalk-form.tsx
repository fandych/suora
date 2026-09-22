import type { ChannelConfigRecord } from "@/types/channel"
import { useAppIntl } from "@/lib/i18n"
import { CompactInput, Field, FormGroupSection, Hint } from "@/pages/channels/components/channel-form-fields"

type ChannelPlatformDingTalkFormProps = {
  channel: ChannelConfigRecord
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
}

export function ChannelPlatformDingTalkForm({ channel, onPatch }: ChannelPlatformDingTalkFormProps) {
  const { t } = useAppIntl()
  const isStream = channel.connectionMode === "stream"

  return (
    <div className="space-y-3">
      <FormGroupSection
        title={t("channels.dingtalk.transport", "Transport")}
        description={
          isStream
            ? t(
                "channels.dingtalk.streamDescription",
                "Stream mode keeps the desktop app connected over WebSocket, so you do not need a public callback URL.",
              )
            : t(
                "channels.dingtalk.webhookDescription",
                "Webhook mode expects DingTalk to POST events into the workspace through the configured robot endpoint.",
              )
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          {isStream ? (
            <>
              <Field label={t("channels.dingtalk.clientId", "Client ID")}>
                <CompactInput
                  value={channel.dingtalkClientId ?? channel.appId ?? ""}
                  onChange={(event) => onPatch({ dingtalkClientId: event.target.value, appId: event.target.value })}
                />
              </Field>
              <Field label={t("channels.dingtalk.clientSecret", "Client secret")}>
                <CompactInput
                  type="password"
                  value={channel.dingtalkClientSecret ?? channel.appSecret ?? ""}
                  onChange={(event) =>
                    onPatch({ dingtalkClientSecret: event.target.value, appSecret: event.target.value })
                  }
                />
              </Field>
            </>
          ) : (
            <>
              <Field label={t("channels.dingtalk.robotWebhookUrl", "Robot webhook URL")} className="md:col-span-2">
                <CompactInput
                  value={channel.dingtalkWebhookUrl ?? ""}
                  onChange={(event) => onPatch({ dingtalkWebhookUrl: event.target.value })}
                  placeholder="https://oapi.dingtalk.com/robot/send?..."
                />
              </Field>
              <Field label={t("channels.dingtalk.signingSecret", "Signing secret")} className="md:col-span-2">
                <CompactInput
                  type="password"
                  value={channel.dingtalkSigningSecret ?? ""}
                  onChange={(event) => onPatch({ dingtalkSigningSecret: event.target.value })}
                  placeholder={t("channels.dingtalk.signingSecretPlaceholder", "SEC...")}
                />
              </Field>
            </>
          )}
        </div>
      </FormGroupSection>
      <Hint>
        {isStream
          ? t("channels.dingtalk.streamHint", "DingTalk Stream mode requires enterprise app credentials.")
          : t("channels.dingtalk.webhookHint", "DingTalk Webhook mode requires the robot webhook URL and signing secret.")}
      </Hint>
    </div>
  )
}
