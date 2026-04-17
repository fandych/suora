import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { getElectron } from './shared'

interface PerfMetrics {
  memory: { heapUsed: number; heapTotal: number; rss: number; external: number }
  cpu: { user: number; system: number }
  uptime: number
  versions: Record<string, string>
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-border/50">
      <IconifyIcon name={icon} size={16} color="currentColor" />
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
    </div>
  )
}

export function SystemSettings() {
  const { t } = useI18n()
  const [metrics, setMetrics] = useState<PerfMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [crashLogs, setCrashLogs] = useState<Array<{ file: string; timestamp: string; error: string }>>([])

  const electron = getElectron()

  const fetchMetrics = useCallback(async () => {
    if (!electron) return
    setLoading(true)
    try {
      const result = await electron.invoke('perf:getMetrics') as PerfMetrics
      setMetrics(result)
    } catch { /* ignore */ }
    setLoading(false)
  }, [electron])

  const fetchCrashLogs = useCallback(async () => {
    if (!electron) return
    try {
      const result = await electron.invoke('crash:getLogs') as Array<{ file: string; timestamp: string; error: string }>
      setCrashLogs(result || [])
    } catch { /* ignore */ }
  }, [electron])

  useEffect(() => {
    fetchMetrics()
    fetchCrashLogs()
  }, [fetchMetrics, fetchCrashLogs])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchMetrics, 3000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchMetrics])

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  return (
    <div className="space-y-8">
      {/* ─── About ─── */}
      <section className="space-y-3">
        <SectionHeader icon="settings-about" title={t('settings.about', 'About')} />
        <div className="rounded-xl border border-border p-4 bg-surface-0/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
            <IconifyIcon name="ui-sparkles" size={24} color="var(--t-accent)" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Suora <span className="text-text-muted font-normal">v0.1.0</span></p>
            <p className="text-xs text-text-muted mt-0.5">Electron + React + Vite + AI SDK</p>
            <p className="text-xs text-text-muted">{t('settings.aboutDesc', 'Multi-model AI desktop application with agents, skills, and plugins.')}</p>
          </div>
        </div>
      </section>

      {/* ─── Performance ─── */}
      {electron ? (
        <section className="space-y-4">
          <SectionHeader icon="settings-performance" title={t('settings.performance', 'Performance')} />
          <div className="flex items-center gap-2">
            <button onClick={fetchMetrics} disabled={loading}
              className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5" aria-label="Refresh">
              {loading ? <><IconifyIcon name="ui-loading" size={12} color="currentColor" /> {t('settings.loading', 'Loading...')}</> : <><IconifyIcon name="ui-refresh" size={12} color="currentColor" /> {t('settings.refresh', 'Refresh')}</>}
            </button>
            <button onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${autoRefresh ? 'bg-green-500/15 text-green-400 border-green-500/20' : 'bg-surface-3 text-text-muted border-border'}`} aria-label="Toggle auto-refresh">
              {autoRefresh ? t('settings.autoRefreshOn', '● Auto (3s)') : t('settings.autoRefreshOff', '○ Auto OFF')}
            </button>
          </div>

          {metrics && (<>
            <div className="rounded-xl border border-border p-4 bg-surface-0/30">
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">{t('settings.memoryUsage', 'Memory')}</h4>
              <div className="grid grid-cols-4 gap-2">
                {([
                  { label: 'Heap Used', value: metrics.memory.heapUsed, pct: Math.round((metrics.memory.heapUsed / metrics.memory.heapTotal) * 100) },
                  { label: 'Heap Total', value: metrics.memory.heapTotal, pct: null },
                  { label: 'RSS', value: metrics.memory.rss, pct: null },
                  { label: 'External', value: metrics.memory.external, pct: null },
                ] as const).map(({ label, value, pct }) => (
                  <div key={label} className="rounded-lg bg-surface-1 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
                    <p className="text-sm font-mono font-semibold text-text-primary mt-0.5">{formatBytes(value)}</p>
                    {pct !== null && (
                      <div className="mt-1.5">
                        <div className="w-full h-1 bg-surface-3 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-400' : pct > 60 ? 'bg-yellow-400' : 'bg-green-400'}`}
                            style={{ width: `${pct}%` }} role="progressbar" aria-label={`${pct}%`} />
                        </div>
                        <p className="text-[10px] text-text-muted mt-0.5">{pct}%</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-surface-1 border border-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-text-muted">CPU User</p>
                <p className="text-sm font-mono font-semibold text-text-primary">{(metrics.cpu.user / 1000).toFixed(1)}ms</p>
              </div>
              <div className="rounded-lg bg-surface-1 border border-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-text-muted">CPU System</p>
                <p className="text-sm font-mono font-semibold text-text-primary">{(metrics.cpu.system / 1000).toFixed(1)}ms</p>
              </div>
              <div className="rounded-lg bg-surface-1 border border-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-text-muted">{t('settings.uptime', 'Uptime')}</p>
                <p className="text-sm font-mono font-semibold text-text-primary">{formatUptime(metrics.uptime)}</p>
              </div>
            </div>

            {metrics.versions && (
              <div className="rounded-xl border border-border p-4 bg-surface-0/30">
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{t('settings.runtimeVersions', 'Runtime Versions')}</h4>
                <div className="grid grid-cols-3 gap-1.5">
                  {Object.entries(metrics.versions).map(([name, version]) => (
                    <div key={name} className="flex items-center justify-between rounded-lg bg-surface-1 px-3 py-1.5">
                      <span className="text-[11px] text-text-muted">{name}</span>
                      <span className="text-[11px] font-mono text-text-primary">{version}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>)}
        </section>
      ) : (
        <section className="space-y-3">
          <SectionHeader icon="settings-performance" title={t('settings.performance', 'Performance')} />
          <p className="text-xs text-text-muted">{t('settings.perfNotAvailable', 'Performance monitoring is only available in the Electron desktop app.')}</p>
        </section>
      )}

      {/* ─── Crash Logs ─── */}
      {electron && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeader icon="ui-crash" title={t('settings.crashLogs', 'Crash Logs')} />
            {crashLogs.length > 0 && (
              <button onClick={async () => { await electron.invoke('crash:clearLogs'); setCrashLogs([]) }}
                className="px-3 py-1 text-[10px] font-medium bg-danger/10 text-danger rounded-lg hover:bg-danger/20 transition-colors">
                {t('settings.clearAll', 'Clear')}
              </button>
            )}
          </div>
          {crashLogs.length === 0 ? (
            <p className="text-xs text-text-muted"><IconifyIcon name="ui-check-circle" size={12} color="currentColor" /> {t('settings.noCrashLogs', 'No crash logs found.')}</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {crashLogs.map((log, i) => (
                <div key={i} className="rounded-lg bg-red-500/5 border border-red-500/10 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-text-muted font-mono">{log.file}</span>
                    <span className="text-[10px] text-text-muted">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}</span>
                  </div>
                  <p className="text-xs text-red-400 mt-1 font-mono break-all">{log.error || 'Unknown error'}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
