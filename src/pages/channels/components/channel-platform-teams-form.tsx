import type { ChannelConfigRecord } from "@/types/channel"
import { useAppIntl } from "@/lib/i18n"
import { CompactInput, Field, FormGroupSection } from "@/pages/channels/components/channel-form-fields"

type ChannelPlatformTeamsFormProps = {
  channel: ChannelConfigRecord
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
}

export function ChannelPlatformTeamsForm({ channel, onPatch }: ChannelPlatformTeamsFormProps) {
  const { t } = useAppIntl()

  return (
    <div className="space-y-3">
      <FormGroupSection
        title={t("channels.teams.title", "Teams configuration")}
        description={t(
          "channels.teams.description",
          "Add the bot registration identifiers from Azure so Teams can authenticate and route bot traffic correctly.",
        )}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("channels.teams.appId", "App ID")}>
            <CompactInput
              value={channel.teamsAppId ?? ""}
              onChange={(event) => onPatch({ teamsAppId: event.target.value })}
            />
          </Field>
          <Field label={t("channels.teams.appPassword", "App password")}>
            <CompactInput
              type="password"
              value={channel.teamsAppPassword ?? ""}
              onChange={(event) => onPatch({ teamsAppPassword: event.target.value })}
            />
          </Field>
          <Field label={t("channels.teams.tenantId", "Tenant ID")}>
            <CompactInput
              value={channel.teamsTenantId ?? ""}
              onChange={(event) => onPatch({ teamsTenantId: event.target.value })}
              placeholder={t("channels.teams.tenantIdPlaceholder", "Use a tenant ID for single-tenant apps")}
            />
          </Field>
          <Field label={t("channels.teams.botEndpoint", "Bot endpoint")}>
            <CompactInput
              value={channel.teamsBotEndpoint ?? channel.callbackUrl ?? ""}
              onChange={(event) => onPatch({ teamsBotEndpoint: event.target.value })}
              placeholder={t("channels.teams.botEndpointPlaceholder", "Auto-filled after binding")}
            />
          </Field>
        </div>
      </FormGroupSection>
    </div>
  )
}
