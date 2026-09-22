import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { useAppIntl } from "@/lib/i18n"
import type { SystemDiagnosticsSnapshot } from "@/services/preference-service"

import PreferenceSectionCard from "@/pages/preference/components/preference-section-card"

type PreferenceEnvironmentPanelProps = {
  diagnostics: SystemDiagnosticsSnapshot | null
  isLoading: boolean
  error: Error | null
  onRefresh: () => void
}

function formatUptime(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  return [hours > 0 ? `${hours}h` : null, minutes > 0 ? `${minutes}m` : null, `${remainingSeconds}s`]
    .filter(Boolean)
    .join(" ")
}

const PreferenceEnvironmentPanel = ({ diagnostics, isLoading, error, onRefresh }: PreferenceEnvironmentPanelProps) => {
  const { t } = useAppIntl()
  const runtime = diagnostics?.runtime
  const usedMemoryGb = runtime ? Math.max(0, runtime.totalMemoryGb - runtime.freeMemoryGb) : 0
  const memoryUsage =
    runtime && runtime.totalMemoryGb > 0 ? Math.min(100, Math.round((usedMemoryGb / runtime.totalMemoryGb) * 100)) : 0

  return (
    <PreferenceSectionCard
      id="environment-monitor"
      title={t("preference.environment.title", "Environment Monitor")}
      description={t("preference.environment.description", "Runtime and tool status.")}
      actions={
        <Button size="sm" variant="outline" onClick={onRefresh}>
          {isLoading ? t("preference.environment.refreshing", "Refreshing...") : t("preference.environment.refresh", "Refresh")}
        </Button>
      }
    >
      {error && !diagnostics ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error.message}
        </div>
      ) : null}
      {diagnostics ? (
        <>
          <div className="flex flex-col gap-3">
            {diagnostics.environment.map((tool) => (
              <div key={tool.id} className="flex flex-col gap-2 rounded-lg border px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium text-foreground">{tool.label}</div>
                  <Badge variant={tool.installed ? "secondary" : "outline"}>
                    {tool.installed ? t("preference.environment.installed", "Installed") : t("preference.environment.missing", "Missing")}
                  </Badge>
                  {tool.version ? <span className="text-xs text-muted-foreground">{tool.version}</span> : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("preference.environment.command", "Command: {value}", { value: tool.command })}
                </div>
                {tool.path ? (
                  <div className="truncate text-xs text-muted-foreground">
                    {t("preference.environment.path", "Path: {value}", { value: tool.path })}
                  </div>
                ) : null}
                {tool.error ? <div className="text-xs text-muted-foreground">{tool.error}</div> : null}
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border px-4 py-3">
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t("preference.environment.processRss", "Process RSS")}</div>
              <div className="mt-2 text-lg font-medium text-foreground">{runtime?.processMemoryMb ?? 0} MB</div>
            </div>
            <div className="rounded-lg border px-4 py-3">
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t("preference.environment.heapUsed", "Heap Used")}</div>
              <div className="mt-2 text-lg font-medium text-foreground">{runtime?.heapUsedMb ?? 0} MB</div>
            </div>
            <div className="rounded-lg border px-4 py-3">
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t("preference.environment.uptime", "Uptime")}</div>
              <div className="mt-2 text-lg font-medium text-foreground">
                {formatUptime(runtime?.uptimeSeconds ?? 0)}
              </div>
            </div>
            <div className="rounded-lg border px-4 py-3">
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t("preference.environment.cpuCores", "CPU Cores")}</div>
              <div className="mt-2 text-lg font-medium text-foreground">{runtime?.cpuCount ?? 0}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border px-4 py-3">
            <Progress value={memoryUsage}>
              <ProgressLabel>{t("preference.environment.hostMemoryUsage", "Host memory usage")}</ProgressLabel>
              <ProgressValue>{(formattedValue) => formattedValue ?? `${memoryUsage}%`}</ProgressValue>
            </Progress>
            <div className="text-sm text-muted-foreground">
              {t("preference.environment.memorySummary", "{used} GB used of {total} GB total, {free} GB free.", {
                used: usedMemoryGb.toFixed(2),
                total: runtime?.totalMemoryGb.toFixed(2) ?? "0.00",
                free: runtime?.freeMemoryGb.toFixed(2) ?? "0.00",
              })}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("preference.environment.runtimeSummary", "PID {pid} · load average {load} · refreshed {time}", {
                pid: runtime?.pid ?? 0,
                load: runtime?.loadAverage.map((value) => value.toFixed(2)).join(" / "),
                time: runtime ? new Date(runtime.timestamp).toLocaleTimeString() : "-",
              })}
            </div>
          </div>
        </>
      ) : null}
    </PreferenceSectionCard>
  )
}

export default PreferenceEnvironmentPanel
