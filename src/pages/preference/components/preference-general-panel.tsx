import { Field, FieldContent, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAppIntl } from "@/lib/i18n"
import type { PreferenceSettings } from "@/services/preference-service"

import PreferenceSectionCard from "@/pages/preference/components/preference-section-card"

type PreferenceGeneralPanelProps = {
  draft: PreferenceSettings
  onChange: (patch: Partial<PreferenceSettings>) => void
}

const PreferenceGeneralPanel = ({ draft, onChange }: PreferenceGeneralPanelProps) => {
  const { language, t } = useAppIntl()

  return (
    <PreferenceSectionCard
      id="general"
      title={t("preference.general.title", "General")}
      description={t("preference.general.description", "Appearance and workspace defaults.")}
    >
      <FieldGroup className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="preference-theme-mode">{t("preference.general.themeMode.label", "Theme mode")}</FieldLabel>
          <NativeSelect
            id="preference-theme-mode"
            className="w-full"
            value={draft.themeMode}
            onChange={(event) => onChange({ themeMode: event.target.value as PreferenceSettings["themeMode"] })}
          >
            <NativeSelectOption value="system">{t("preference.general.themeMode.system", "System")}</NativeSelectOption>
            <NativeSelectOption value="light">{t("preference.general.themeMode.light", "Light")}</NativeSelectOption>
            <NativeSelectOption value="dark">{t("preference.general.themeMode.dark", "Dark")}</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="preference-theme-accent">{t("preference.general.themeAccent.label", "Theme accent")}</FieldLabel>
          <NativeSelect
            id="preference-theme-accent"
            className="w-full"
            value={draft.themeAccent}
            onChange={(event) => onChange({ themeAccent: event.target.value as PreferenceSettings["themeAccent"] })}
          >
            <NativeSelectOption value="ocean">{t("preference.general.themeAccent.ocean", "Ocean")}</NativeSelectOption>
            <NativeSelectOption value="forest">{t("preference.general.themeAccent.forest", "Forest")}</NativeSelectOption>
            <NativeSelectOption value="amber">{t("preference.general.themeAccent.amber", "Amber")}</NativeSelectOption>
            <NativeSelectOption value="rose">{t("preference.general.themeAccent.rose", "Rose")}</NativeSelectOption>
            <NativeSelectOption value="slate">{t("preference.general.themeAccent.slate", "Slate")}</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="preference-font-scale">{t("preference.general.fontScale.label", "Font size")}</FieldLabel>
          <NativeSelect
            id="preference-font-scale"
            className="w-full"
            value={draft.fontScale}
            onChange={(event) => onChange({ fontScale: event.target.value as PreferenceSettings["fontScale"] })}
          >
            <NativeSelectOption value="sm">{t("preference.general.fontScale.sm", "Compact")}</NativeSelectOption>
            <NativeSelectOption value="md">{t("preference.general.fontScale.md", "Default")}</NativeSelectOption>
            <NativeSelectOption value="lg">{t("preference.general.fontScale.lg", "Large")}</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="preference-language">{t("preference.general.language.label", "Language")}</FieldLabel>
          <NativeSelect
            id="preference-language"
            className="w-full"
            value={draft.language}
            onChange={(event) => onChange({ language: event.target.value as PreferenceSettings["language"] })}
          >
            <NativeSelectOption value="zh">
              {language === "zh" ? t("preference.general.language.zh", "中文") : "Chinese"}
            </NativeSelectOption>
            <NativeSelectOption value="en">
              {language === "zh" ? t("preference.general.language.en", "English") : "English"}
            </NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="preference-workspace-name">
            {t("preference.general.workspaceName.label", "Workspace name")}
          </FieldLabel>
          <Input
            id="preference-workspace-name"
            value={draft.workspaceName}
            onChange={(event) => onChange({ workspaceName: event.target.value })}
            placeholder={t("preference.general.workspaceName.placeholder", "SUORA")}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="preference-workspace-path">
            {t("preference.general.workspacePath.label", "Workspace path")}
          </FieldLabel>
          <Input
            id="preference-workspace-path"
            value={draft.workspacePath}
            onChange={(event) => onChange({ workspacePath: event.target.value })}
            placeholder="C:/Users/.../workspace"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="preference-default-provider">
            {t("preference.general.defaultProvider.label", "Default model provider")}
          </FieldLabel>
          <Input
            id="preference-default-provider"
            value={draft.defaultModelProviderId}
            onChange={(event) => onChange({ defaultModelProviderId: event.target.value })}
            placeholder="provider-openai"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="preference-chat-timeout">
            {t("preference.general.chatTimeout.label", "Chat request timeout")}
          </FieldLabel>
          <Input
            id="preference-chat-timeout"
            type="number"
            min="0"
            step="1000"
            value={String(draft.chatRequestTimeoutMs)}
            onChange={(event) => onChange({ chatRequestTimeoutMs: Math.max(0, Number(event.target.value) || 0) })}
            placeholder="0"
          />
        </Field>
        <Field className="md:col-span-2" orientation="horizontal">
          <FieldContent>
            <FieldTitle>{t("preference.general.autoSave", "Auto-save conversations")}</FieldTitle>
          </FieldContent>
          <Switch
            checked={draft.autoSaveConversations}
            onCheckedChange={(checked) => onChange({ autoSaveConversations: checked })}
          />
        </Field>
        <Field className="md:col-span-2" orientation="horizontal">
          <FieldContent>
            <FieldTitle>{t("preference.general.launchOnStartup", "Launch on startup")}</FieldTitle>
          </FieldContent>
          <Switch
            checked={draft.autoStartEnabled}
            onCheckedChange={(checked) => onChange({ autoStartEnabled: checked })}
          />
        </Field>
        <Field className="md:col-span-2">
          <FieldLabel htmlFor="preference-notes">{t("preference.general.notes.label", "Operator notes")}</FieldLabel>
          <Textarea
            id="preference-notes"
            rows={6}
            value={draft.notes}
            onChange={(event) => onChange({ notes: event.target.value })}
            placeholder={t("preference.general.notes.placeholder", "Add internal notes for this desktop workspace.")}
          />
        </Field>
      </FieldGroup>
    </PreferenceSectionCard>
  )
}

export default PreferenceGeneralPanel
