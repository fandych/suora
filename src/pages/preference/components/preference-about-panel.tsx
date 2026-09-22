import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldTitle } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { useAppIntl } from "@/lib/i18n"
import type {
  PreferenceSettings,
  SystemInfoSnapshot,
  UpdateCheckResult,
  UpdaterStateSnapshot,
} from "@/services/preference-service"

import PreferenceSectionCard from "@/pages/preference/components/preference-section-card"

type PreferenceAboutPanelProps = {
  draft: PreferenceSettings
  systemInfo: SystemInfoSnapshot | null
  updaterState: UpdaterStateSnapshot | null
  updateResult: UpdateCheckResult | null
  isCheckingUpdates: boolean
  onChange: (patch: Partial<PreferenceSettings>) => void
  onCheckUpdates: () => void
}

function formatUpdateResult(result: UpdateCheckResult | null, t: ReturnType<typeof useAppIntl>["t"]) {
  if (!result) {
    return null
  }

  if (typeof result === "string") {
    return result
  }

  if (typeof result === "object") {
    const record = result as Record<string, unknown>
    if (record.skipped) {
      return t("preference.about.updateSkipped", "Update check skipped: {reason}.", {
        reason: typeof record.reason === "string" ? record.reason : t("preference.about.unknown", "unknown"),
      })
    }

    const updateInfo = record.updateInfo
    if (
      updateInfo &&
      typeof updateInfo === "object" &&
      typeof (updateInfo as Record<string, unknown>).version === "string"
    ) {
      return t("preference.about.latestVersion", "Latest available version: {version}.", {
        version: (updateInfo as Record<string, unknown>).version as string,
      })
    }

    return t("preference.about.updateCompleted", "Update check completed.")
  }

  return String(result)
}

const PreferenceAboutPanel = ({
  draft,
  systemInfo,
  updaterState,
  updateResult,
  isCheckingUpdates,
  onChange,
  onCheckUpdates,
}: PreferenceAboutPanelProps) => {
  const { t } = useAppIntl()
  const updateSummary = formatUpdateResult(updateResult, t)

  return (
    <PreferenceSectionCard
      id="about"
      title={t("preference.about.title", "About")}
      description={t("preference.about.description", "Version and update status.")}
      actions={
        <Button size="sm" variant="outline" onClick={onCheckUpdates} disabled={isCheckingUpdates}>
          {isCheckingUpdates ? t("preference.about.checking", "Checking...") : t("preference.about.check", "Check for updates")}
        </Button>
      }
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border px-4 py-3">
          <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t("preference.about.product", "Product")}</div>
          <div className="mt-2 text-base font-medium text-foreground">{systemInfo?.productName ?? "SUORA"}</div>
        </div>
        <div className="rounded-lg border px-4 py-3">
          <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t("preference.about.version", "Version")}</div>
          <div className="mt-2 text-base font-medium text-foreground">{systemInfo?.version ?? "-"}</div>
        </div>
        <div className="rounded-lg border px-4 py-3">
          <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t("preference.about.platform", "Platform")}</div>
          <div className="mt-2 text-base font-medium text-foreground">{systemInfo?.platform ?? "-"}</div>
        </div>
        <div className="rounded-lg border px-4 py-3">
          <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t("preference.about.mode", "Mode")}</div>
          <div className="mt-2 flex items-center gap-2 text-base font-medium text-foreground">
            {systemInfo?.isDev ? t("preference.about.modeDevelopment", "Development") : t("preference.about.modePackaged", "Packaged")}
            {systemInfo ? <Badge variant="outline">{t("preference.about.pidRuntime", "PID runtime")}</Badge> : null}
          </div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border px-4 py-3">
          <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t("preference.about.nodejs", "Node.js")}</div>
          <div className="mt-2 text-sm font-medium text-foreground">{systemInfo?.nodeVersion ?? "-"}</div>
        </div>
        <div className="rounded-lg border px-4 py-3">
          <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t("preference.about.electron", "Electron")}</div>
          <div className="mt-2 text-sm font-medium text-foreground">{systemInfo?.electronVersion ?? "-"}</div>
        </div>
        <div className="rounded-lg border px-4 py-3">
          <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t("preference.about.chrome", "Chrome")}</div>
          <div className="mt-2 text-sm font-medium text-foreground">{systemInfo?.chromeVersion ?? "-"}</div>
        </div>
      </div>
      <Field className="rounded-lg border px-4 py-3" orientation="horizontal">
        <FieldContent>
          <FieldTitle>{t("preference.about.autoCheck", "Auto-check for updates")}</FieldTitle>
        </FieldContent>
        <Switch
          checked={draft.autoCheckUpdates}
          onCheckedChange={(checked) => onChange({ autoCheckUpdates: checked })}
        />
      </Field>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Badge variant={updaterState?.enabled ? "secondary" : "outline"}>
          {updaterState?.enabled ? t("preference.about.updaterEnabled", "Updater enabled") : t("preference.about.updaterUnavailable", "Updater unavailable")}
        </Badge>
        <span>
          {t("preference.about.releaseChannel", "Release channel: {value}", {
            value: updaterState?.channel ?? "latest",
          })}
        </span>
      </div>
      {updateSummary ? (
        <div className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">{updateSummary}</div>
      ) : null}
      <div className="text-xs text-muted-foreground">
        {t(
          "preference.about.copyright",
          "Copyright © 2026 SUORA. All runtime preference data is stored locally in the desktop workspace.",
        )}
      </div>
    </PreferenceSectionCard>
  )
}

export default PreferenceAboutPanel
