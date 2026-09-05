import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldTitle } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import type { PreferenceSettings } from "@/data/repositories/preference-repository"
import type { SystemInfoSnapshot, UpdateCheckResult, UpdaterStateSnapshot } from "@/data/repositories/system-status-repository"

import PreferenceSectionCard from "@/views/preference/components/preference-section-card"

type PreferenceAboutPanelProps = {
  draft: PreferenceSettings
  systemInfo: SystemInfoSnapshot | null
  updaterState: UpdaterStateSnapshot | null
  updateResult: UpdateCheckResult | null
  isCheckingUpdates: boolean
  onChange: (patch: Partial<PreferenceSettings>) => void
  onCheckUpdates: () => void
}

function formatUpdateResult(result: UpdateCheckResult | null) {
  if (!result) {
    return null
  }

  if (typeof result === "string") {
    return result
  }

  if (typeof result === "object") {
    const record = result as Record<string, unknown>
    if (record.skipped) {
      return `Update check skipped: ${typeof record.reason === "string" ? record.reason : "unknown"}.`
    }

    const updateInfo = record.updateInfo
    if (updateInfo && typeof updateInfo === "object" && typeof (updateInfo as Record<string, unknown>).version === "string") {
      return `Latest available version: ${(updateInfo as Record<string, unknown>).version as string}.`
    }

    return "Update check completed."
  }

  return String(result)
}

const PreferenceAboutPanel = ({ draft, systemInfo, updaterState, updateResult, isCheckingUpdates, onChange, onCheckUpdates }: PreferenceAboutPanelProps) => {
  const updateSummary = formatUpdateResult(updateResult)

  return (
    <PreferenceSectionCard id="about" title="About" description="Version and update status." actions={<Button size="sm" variant="outline" onClick={onCheckUpdates} disabled={isCheckingUpdates}>{isCheckingUpdates ? "Checking..." : "Check for updates"}</Button>}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border px-4 py-3"><div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Product</div><div className="mt-2 text-base font-medium text-foreground">{systemInfo?.productName ?? "SUORA"}</div></div>
        <div className="rounded-lg border px-4 py-3"><div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Version</div><div className="mt-2 text-base font-medium text-foreground">{systemInfo?.version ?? "-"}</div></div>
        <div className="rounded-lg border px-4 py-3"><div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Platform</div><div className="mt-2 text-base font-medium text-foreground">{systemInfo?.platform ?? "-"}</div></div>
        <div className="rounded-lg border px-4 py-3"><div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Mode</div><div className="mt-2 flex items-center gap-2 text-base font-medium text-foreground">{systemInfo?.isDev ? "Development" : "Packaged"}{systemInfo ? <Badge variant="outline">PID runtime</Badge> : null}</div></div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border px-4 py-3"><div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Node.js</div><div className="mt-2 text-sm font-medium text-foreground">{systemInfo?.nodeVersion ?? "-"}</div></div>
        <div className="rounded-lg border px-4 py-3"><div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Electron</div><div className="mt-2 text-sm font-medium text-foreground">{systemInfo?.electronVersion ?? "-"}</div></div>
        <div className="rounded-lg border px-4 py-3"><div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Chrome</div><div className="mt-2 text-sm font-medium text-foreground">{systemInfo?.chromeVersion ?? "-"}</div></div>
      </div>
      <Field className="rounded-lg border px-4 py-3" orientation="horizontal">
        <FieldContent>
          <FieldTitle>Auto-check for updates</FieldTitle>
        </FieldContent>
        <Switch checked={draft.autoCheckUpdates} onCheckedChange={(checked) => onChange({ autoCheckUpdates: checked })} />
      </Field>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Badge variant={updaterState?.enabled ? "secondary" : "outline"}>{updaterState?.enabled ? "Updater enabled" : "Updater unavailable"}</Badge>
        <span>Release channel: {updaterState?.channel ?? "latest"}</span>
      </div>
      {updateSummary ? <div className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">{updateSummary}</div> : null}
      <div className="text-xs text-muted-foreground">Copyright © 2026 SUORA. All runtime preference data is stored locally in the desktop workspace.</div>
    </PreferenceSectionCard>
  )
}

export default PreferenceAboutPanel