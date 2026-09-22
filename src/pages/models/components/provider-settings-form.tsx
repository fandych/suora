import { ExternalLinkIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { useAppIntl } from "@/lib/i18n"
import { Switch } from "@/components/ui/switch"
import type { ProviderConfigRecord, ProviderPreset } from "@/types/agent"
import { ProviderLogoBadge } from "@/pages/models/components/provider-logo-badge"

type ProviderSettingsFormProps = {
  draft: ProviderConfigRecord
  docsUrl?: string
  canConfigureModels: boolean
  onChange: (nextProvider: ProviderConfigRecord) => void
  onOpenDocs?: (url: string) => void
  onProviderTypeChange: (providerType: string) => void
  onSave: () => void
  presets: ProviderPreset[]
}

export function ProviderSettingsForm({
  draft,
  docsUrl,
  canConfigureModels,
  onChange,
  onOpenDocs,
  onProviderTypeChange,
  onSave,
  presets,
}: ProviderSettingsFormProps) {
  const { t } = useAppIntl()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <ProviderLogoBadge providerType={draft.providerType} className="size-12" iconClassName="size-6" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <CardTitle className="wrap-break-word">{draft.title}</CardTitle>
            <CardDescription>{draft.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">{t("models.providerForm.name", "Name")}</div>
            <Input
              value={draft.title}
              onChange={(event) => onChange({ ...draft, title: event.target.value })}
              placeholder={t("models.providerForm.namePlaceholder", "Provider title")}
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">{t("models.providerForm.description", "Description")}</div>
            <Textarea
              value={draft.description}
              onChange={(event) => onChange({ ...draft, description: event.target.value })}
              placeholder={t("models.providerForm.descriptionPlaceholder", "Describe this provider")}
              rows={3}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">{t("models.providerForm.type", "Provider type")}</div>
          <NativeSelect value={draft.providerType} onChange={(event) => onProviderTypeChange(event.target.value)}>
            {presets.map((preset) => (
              <NativeSelectOption key={preset.providerType} value={preset.providerType}>
                {preset.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">{t("models.providerForm.baseUrl", "Base URL")}</div>
          <Input
            value={draft.baseUrl}
            onChange={(event) => onChange({ ...draft, baseUrl: event.target.value })}
            placeholder={t("models.providerForm.baseUrlPlaceholder", "https://api.example.com/v1")}
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">{t("models.providerForm.apiKey", "API key")}</div>
          <Input
            type="password"
            value={draft.apiKey}
            onChange={(event) =>
              onChange({
                ...draft,
                apiKey: event.target.value,
                apiKeyConfigured: event.target.value ? true : false,
              })
            }
            placeholder={
              draft.apiKeyConfigured
                ? t("models.providerForm.apiKeyConfiguredPlaceholder", "Configured. Enter a new key to replace it.")
                : t("models.providerForm.apiKeyPlaceholder", "API key")
            }
          />
          {draft.apiKeyConfigured && !draft.apiKey ? (
            <div className="text-xs text-muted-foreground">
              {t("models.providerForm.storedKey", "Stored key: {value}. Leave this blank to keep it.", {
                value: draft.apiKeyPreview || t("models.providerForm.configured", "Configured"),
              })}
            </div>
          ) : null}
        </div>

        {!canConfigureModels ? (
          <div className="rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t(
              "models.providerForm.disabledHint",
              "Provider and model toggles remain disabled until an API key is configured.",
            )}
          </div>
        ) : null}

        <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
          <span>{t("models.providerForm.enabled", "Provider enabled")}</span>
          <Switch
            checked={draft.enabled}
            disabled={!canConfigureModels}
            onCheckedChange={(checked) => onChange({ ...draft, enabled: checked })}
          />
        </label>

        {docsUrl ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">{t("models.providerForm.docs", "Official docs")}</div>
              <div className="truncate text-xs text-muted-foreground">{docsUrl}</div>
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label={t("models.providerForm.openDocs", "Open provider docs")}
              title={t("models.providerForm.openDocs", "Open provider docs")}
              onClick={() => onOpenDocs?.(docsUrl)}
            >
              <ExternalLinkIcon className="size-4" />
            </Button>
          </div>
        ) : null}

        <div className="flex justify-end border-t pt-3">
          <Button type="button" onClick={onSave}>
            {t("models.providerForm.save", "Save provider")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
