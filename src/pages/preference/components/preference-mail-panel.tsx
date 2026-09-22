import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useAppIntl } from "@/lib/i18n"
import { PreferenceApi, type PreferenceSettings } from "@/services/preference-service"

import PreferenceSectionCard from "@/pages/preference/components/preference-section-card"

type PreferenceMailPanelProps = {
  draft: PreferenceSettings
  onChange: (patch: Partial<PreferenceSettings>) => void
  testRecipient: string
  onTestRecipientChange: (value: string) => void
  onSendTestMail: () => void
  isSendingTestMail: boolean
}

const PreferenceMailPanel = ({
  draft,
  onChange,
  testRecipient,
  onTestRecipientChange,
  onSendTestMail,
  isSendingTestMail,
}: PreferenceMailPanelProps) => {
  const { t } = useAppIntl()
  const mailIssues = PreferenceApi.validateMail(draft)

  return (
    <PreferenceSectionCard
      id="mail-service"
      title={t("preference.mail.title", "Mail Service")}
      description={t("preference.mail.description", "Global SMTP settings.")}
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={onSendTestMail}
          disabled={isSendingTestMail || !draft.mailServiceEnabled}
        >
          {isSendingTestMail ? t("preference.mail.sending", "Sending...") : t("preference.mail.sendTest", "Send test mail")}
        </Button>
      }
    >
      <Field className="rounded-lg border p-4" orientation="horizontal">
        <FieldContent>
          <FieldTitle>{t("preference.mail.enable", "Enable mail service")}</FieldTitle>
        </FieldContent>
        <Switch
          checked={draft.mailServiceEnabled}
          onCheckedChange={(checked) => onChange({ mailServiceEnabled: checked })}
        />
      </Field>
      {draft.mailServiceEnabled && mailIssues.length > 0 ? (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          {t("preference.mail.validation", "Complete these fields before live mail can be used: {issues}.", {
            issues: mailIssues.join(", "),
          })}
        </div>
      ) : null}
      <fieldset disabled={!draft.mailServiceEnabled}>
        <FieldGroup className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="preference-mail-host">{t("preference.mail.host", "SMTP host")}</FieldLabel>
            <Input
              id="preference-mail-host"
              value={draft.mailServerHost}
              onChange={(event) => onChange({ mailServerHost: event.target.value })}
              placeholder="smtp.example.com"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="preference-mail-port">{t("preference.mail.port", "SMTP port")}</FieldLabel>
            <Input
              id="preference-mail-port"
              type="number"
              min="1"
              step="1"
              value={String(draft.mailServerPort)}
              onChange={(event) => onChange({ mailServerPort: Math.max(1, Number(event.target.value) || 1) })}
              placeholder="587"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="preference-mail-username">{t("preference.mail.username", "Username")}</FieldLabel>
            <Input
              id="preference-mail-username"
              value={draft.mailServerUsername}
              onChange={(event) => onChange({ mailServerUsername: event.target.value })}
              placeholder="noreply@example.com"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="preference-mail-password">{t("preference.mail.password", "Password")}</FieldLabel>
            <Input
              id="preference-mail-password"
              type="password"
              value={draft.mailServerPassword}
              onChange={(event) => onChange({ mailServerPassword: event.target.value })}
              placeholder="Application password"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="preference-mail-from">{t("preference.mail.fromAddress", "From address")}</FieldLabel>
            <Input
              id="preference-mail-from"
              value={draft.mailServerFrom}
              onChange={(event) => onChange({ mailServerFrom: event.target.value })}
              placeholder="suora@example.com"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="preference-mail-test-recipient">{t("preference.mail.testRecipient", "Test recipient")}</FieldLabel>
            <Input
              id="preference-mail-test-recipient"
              value={testRecipient}
              onChange={(event) => onTestRecipientChange(event.target.value)}
              placeholder="operator@example.com"
            />
          </Field>
          <Field className="md:col-span-2 rounded-lg border px-4 py-3" orientation="horizontal">
            <FieldContent>
              <FieldTitle>{t("preference.mail.useTls", "Use TLS")}</FieldTitle>
            </FieldContent>
            <Switch checked={draft.mailServerTls} onCheckedChange={(checked) => onChange({ mailServerTls: checked })} />
          </Field>
        </FieldGroup>
      </fieldset>
    </PreferenceSectionCard>
  )
}

export default PreferenceMailPanel
