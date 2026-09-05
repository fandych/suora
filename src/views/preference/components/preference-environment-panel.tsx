import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import type { SystemDiagnosticsSnapshot } from "@/data/repositories/system-status-repository"

import PreferenceSectionCard from "@/views/preference/components/preference-section-card"

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
  return [hours > 0 ? `${hours}h` : null, minutes > 0 ? `${minutes}m` : null, `${remainingSeconds}s`].filter(Boolean).join(" ")
}

const PreferenceEnvironmentPanel = ({ diagnostics, isLoading, error, onRefresh }: PreferenceEnvironmentPanelProps) => {
  const runtime = diagnostics?.runtime
  const usedMemoryGb = runtime ? Math.max(0, runtime.totalMemoryGb - runtime.freeMemoryGb) : 0
  const memoryUsage = runtime && runtime.totalMemoryGb > 0 ? Math.min(100, Math.round((usedMemoryGb / runtime.totalMemoryGb) * 100)) : 0

  return (
    <PreferenceSectionCard id="environment-monitor" title="Environment Monitor" description="Runtime and tool status." actions={<Button size="sm" variant="outline" onClick={onRefresh}>{isLoading ? "Refreshing..." : "Refresh"}</Button>}>
      {error && !diagnostics ? <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error.message}</div> : null}
      {diagnostics ? (
        <>
          <div className="flex flex-col gap-3">
            {diagnostics.environment.map((tool) => (
              <div key={tool.id} className="flex flex-col gap-2 rounded-lg border px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium text-foreground">{tool.label}</div>
                  <Badge variant={tool.installed ? "secondary" : "outline"}>{tool.installed ? "Installed" : "Missing"}</Badge>
                  {tool.version ? <span className="text-xs text-muted-foreground">{tool.version}</span> : null}
                </div>
                <div className="text-xs text-muted-foreground">Command: {tool.command}</div>
                {tool.path ? <div className="truncate text-xs text-muted-foreground">Path: {tool.path}</div> : null}
                {tool.error ? <div className="text-xs text-muted-foreground">{tool.error}</div> : null}
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border px-4 py-3">
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Process RSS</div>
              <div className="mt-2 text-lg font-medium text-foreground">{runtime?.processMemoryMb ?? 0} MB</div>
            </div>
            <div className="rounded-lg border px-4 py-3">
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Heap Used</div>
              <div className="mt-2 text-lg font-medium text-foreground">{runtime?.heapUsedMb ?? 0} MB</div>
            </div>
            <div className="rounded-lg border px-4 py-3">
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Uptime</div>
              <div className="mt-2 text-lg font-medium text-foreground">{formatUptime(runtime?.uptimeSeconds ?? 0)}</div>
            </div>
            <div className="rounded-lg border px-4 py-3">
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">CPU Cores</div>
              <div className="mt-2 text-lg font-medium text-foreground">{runtime?.cpuCount ?? 0}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border px-4 py-3">
            <Progress value={memoryUsage}>
              <ProgressLabel>Host memory usage</ProgressLabel>
              <ProgressValue>{(formattedValue) => formattedValue ?? `${memoryUsage}%`}</ProgressValue>
            </Progress>
            <div className="text-sm text-muted-foreground">{usedMemoryGb.toFixed(2)} GB used of {runtime?.totalMemoryGb.toFixed(2) ?? "0.00"} GB total, {runtime?.freeMemoryGb.toFixed(2) ?? "0.00"} GB free.</div>
            <div className="text-xs text-muted-foreground">PID {runtime?.pid ?? 0} · load average {runtime?.loadAverage.map((value) => value.toFixed(2)).join(" / ")} · refreshed {runtime ? new Date(runtime.timestamp).toLocaleTimeString() : "-"}</div>
          </div>
        </>
      ) : null}
    </PreferenceSectionCard>
  )
}

export default PreferenceEnvironmentPanel