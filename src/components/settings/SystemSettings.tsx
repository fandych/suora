import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { useAppStore } from '@/store/appStore'
import { getElectron } from './shared'
import {
  SettingsSection,
  SettingsStat,
  SettingsToggleRow,
  settingsDangerButtonClass,
  settingsFieldCardClass,
  settingsPrimaryButtonClass,
  settingsSecondaryButtonClass,
  settingsSurfaceCardClass,
} from './panelUi'

interface PerfMetrics {
  memory: { heapUsed: number; heapTotal: number; rss: number; external: number }
  cpu: { user: number; system: number }
  uptime: number
  versions: Record<string, string>
}

interface UpdaterSnapshot {
  status: 'unsupported' | 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'no-update' | 'error'
  currentVersion: string
  latestVersion?: string
  releaseDate?: string
  releaseNotes?: string
  downloadUrl?: string
  downloadPercent?: number
  downloaded: boolean
  lastCheckedAt?: string
  error?: string
}

function getUsageMeterTone(pct: number): string {
  if (pct > 80) return 'is-danger'
  if (pct > 60) return 'is-warning'
  return 'is-success'
}

export function SystemSettings() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const setOnboarding = useAppStore((state) => state.setOnboarding)
  const [metrics, setMetrics] = useState<PerfMetrics | null>(null)
  const [appVersion, setAppVersion] = useState('—')
  const [updaterState, setUpdaterState] = useState<UpdaterSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [checkingUpdates, setCheckingUpdates] = useState(false)
  const [installingUpdate, setInstallingUpdate] = useState(false)
  const [updateNote, setUpdateNote] = useState<string | null>(null)
  const [crashLogs, setCrashLogs] = useState<Array<{ file: string; timestamp: string; error: string }>>([])

  const electron = getElectron()

  const fetchMetrics = useCallback(async () => {
    if (!electron) return
    setLoading(true)
    try {
      const result = await electron.invoke('perf:getMetrics') as PerfMetrics
      setMetrics(result)
    } catch {
      // ignore
    }
    setLoading(false)
  }, [electron])

  const fetchCrashLogs = useCallback(async () => {
    if (!electron) return
    try {
      const result = await electron.invoke('crash:getLogs') as Array<{ file: string; timestamp: string; error: string }>
      setCrashLogs(result || [])
    } catch {
      // ignore
    }
  }, [electron])

  const refreshUpdaterState = useCallback(async () => {
    if (!electron) return
    try {
      const [version, snapshot] = await Promise.all([
        electron.invoke('updater:getVersion'),
        electron.invoke('updater:getState'),
      ])
      setAppVersion(typeof version === 'string' && version.trim().length > 0 ? version : '—')
      setUpdaterState(snapshot as UpdaterSnapshot)
    } catch {
      // ignore
    }
  }, [electron])

  useEffect(() => {
    void fetchMetrics()
    void fetchCrashLogs()
    void refreshUpdaterState()
  }, [fetchMetrics, fetchCrashLogs, refreshUpdaterState])

  useEffect(() => {
    if (!electron?.on || !electron.off) return
    const listener = (_event: unknown, snapshot: unknown) => {
      const nextSnapshot = snapshot as UpdaterSnapshot | undefined
      if (!nextSnapshot) return
      setUpdaterState(nextSnapshot)
      if (nextSnapshot.currentVersion) setAppVersion(nextSnapshot.currentVersion)
    }
    electron.on('updater:state', listener)
    return () => electron.off?.('updater:state', listener)
  }, [electron])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      void fetchMetrics()
    }, 3000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchMetrics])

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return hours > 0 ? `${hours}h ${minutes}m ${remainingSeconds}s` : minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`
  }

  const rssValue = metrics ? formatBytes(metrics.memory.rss) : '—'
  const uptimeValue = metrics ? formatUptime(metrics.uptime) : '—'
  const displayVersion = electron ? (appVersion === '—' ? '…' : `v${appVersion}`) : 'browser-preview'

  const updateStatusText = (() => {
    switch (updaterState?.status) {
      case 'unsupported':
        return updaterState.error || t('settings.updateUnsupported', 'Auto updates are only available in packaged desktop builds.')
      case 'checking':
        return t('settings.checkingUpdates', 'Checking for updates…')
      case 'available':
        return t('settings.updateAvailableDesc', 'Update found. Download is starting in the background.')
      case 'downloading':
        return t('settings.downloadingUpdate', 'Downloading update in the background…')
      case 'downloaded':
        return t('settings.updateReady', 'Update downloaded. Restart and install when ready.')
      case 'no-update':
        return t('settings.noUpdates', 'You are already on the latest version.')
      case 'error':
        return updaterState.error || t('settings.updateFailed', 'Update check failed.')
      default:
        return t('settings.updateIdle', 'Check for updates manually or wait for the background check after startup.')
    }
  })()

  const handleCheckForUpdates = async () => {
    if (!electron) return
    setCheckingUpdates(true)
    setUpdateNote(null)
    try {
      await electron.invoke('updater:check')
      await refreshUpdaterState()
    } catch {
      setUpdateNote(t('settings.updateFailed', 'Update check failed.'))
    } finally {
      setCheckingUpdates(false)
    }
  }

  const handleInstallUpdate = async () => {
    if (!electron) return
    setInstallingUpdate(true)
    setUpdateNote(null)
    try {
      const result = await electron.invoke('updater:install') as { success?: boolean; error?: string }
      if (!result?.success) {
        setUpdateNote(result?.error || t('settings.installUpdateFailed', 'Unable to install the downloaded update.'))
        return
      }
      setUpdateNote(t('settings.restartingForUpdate', 'Restarting to apply the downloaded update…'))
    } catch {
      setUpdateNote(t('settings.installUpdateFailed', 'Unable to install the downloaded update.'))
    } finally {
      setInstallingUpdate(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-4xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/94 to-surface-2/72 p-6 shadow-[0_24px_70px_rgba(var(--t-accent-rgb),0.08)] xl:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('settings.system', 'System')}</div>
            <h2 className="mt-2 text-[30px] font-semibold tracking-tight text-text-primary">{t('settings.systemWorkbench', 'Runtime & Diagnostics')}</h2>
            <p className="mt-2 text-[14px] leading-7 text-text-secondary/82">
              {t('settings.systemWorkbenchDesc', 'Inspect the desktop runtime, replay onboarding, monitor resource usage, and clean up crash traces from the current machine.')}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-md xl:grid-cols-4">
            <SettingsStat label={t('settings.runtime', 'Runtime')} value={electron ? 'Electron' : 'Browser'} accent />
            <SettingsStat label={t('settings.rss', 'RSS')} value={rssValue} />
            <SettingsStat label={t('settings.uptime', 'Uptime')} value={uptimeValue} />
            <SettingsStat label={t('settings.crashLogs', 'Crash Logs')} value={String(crashLogs.length)} />
          </div>
        </div>
      </section>

      <SettingsSection
        eyebrow={t('settings.about', 'About')}
        title={t('settings.productIdentity', 'Product Identity')}
        description={t('settings.productIdentityDesc', 'Quick reference for the current desktop shell, version surface, and the stack the renderer is running on.')}
      >
        <div className={`${settingsFieldCardClass} flex flex-col gap-4 sm:flex-row sm:items-center`}>
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-accent/18 bg-accent/10 text-accent shadow-[0_12px_32px_rgba(var(--t-accent-rgb),0.14)]">
            <IconifyIcon name="ui-sparkles" size={28} color="currentColor" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Suora <span className="font-normal text-text-muted">{displayVersion}</span></p>
            <p className="mt-1 text-[12px] text-text-muted">Electron + React + Vite + AI SDK</p>
            <p className="mt-1 text-[12px] leading-relaxed text-text-secondary/80">{t('settings.aboutDesc', 'Multi-model AI desktop application with agents, skills, and plugins.')}</p>
          </div>
        </div>
      </SettingsSection>

      {electron && (
        <SettingsSection
          eyebrow={t('settings.updates', 'Updates')}
          title={t('settings.appUpdates', 'Application Updates')}
          description={t('settings.appUpdatesDesc', 'Check the packaged app version, monitor update progress, and install downloaded releases without leaving the workbench.')}
        >
          <div className={`${settingsFieldCardClass} space-y-4`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {t('settings.currentVersion', 'Current Version')} <span className="font-mono">{displayVersion}</span>
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{updateStatusText}</p>
                {updaterState?.latestVersion && updaterState.latestVersion !== appVersion && (
                  <p className="mt-2 text-[12px] text-text-secondary">
                    {t('settings.latestAvailableVersion', 'Latest available')}: <span className="font-mono text-text-primary">v{updaterState.latestVersion}</span>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleCheckForUpdates()}
                  disabled={checkingUpdates || installingUpdate}
                  className={settingsPrimaryButtonClass}
                >
                  <IconifyIcon name={checkingUpdates ? 'ui-loading' : 'ui-refresh'} size={14} color="currentColor" />
                  {checkingUpdates ? t('settings.checkingUpdates', 'Checking for updates…') : t('settings.checkForUpdates', 'Check for Updates')}
                </button>
                {updaterState?.status === 'downloaded' && (
                  <button
                    type="button"
                    onClick={() => void handleInstallUpdate()}
                    disabled={installingUpdate}
                    className={settingsSecondaryButtonClass}
                  >
                    <IconifyIcon name={installingUpdate ? 'ui-loading' : 'ui-download'} size={14} color="currentColor" />
                    {installingUpdate ? t('settings.installingUpdate', 'Installing…') : t('settings.installUpdate', 'Install Update')}
                  </button>
                )}
              </div>
            </div>

            {typeof updaterState?.downloadPercent === 'number' && updaterState.status === 'downloading' && (
              <div className={settingsSurfaceCardClass}>
                <div className="mb-2 flex items-center justify-between gap-3 text-[11px] text-text-muted">
                  <span>{t('settings.downloadProgress', 'Download Progress')}</span>
                  <span className="font-mono text-text-primary">{Math.round(updaterState.downloadPercent)}%</span>
                </div>
                <progress
                  value={Math.max(0, Math.min(100, updaterState.downloadPercent))}
                  max={100}
                  className="memory-usage-meter is-success"
                  aria-label={`${t('settings.downloadProgress', 'Download Progress')} ${Math.round(updaterState.downloadPercent)}%`}
                />
              </div>
            )}

            {(updaterState?.releaseDate || updaterState?.downloadUrl) && (
              <div className="grid gap-3 md:grid-cols-2">
                {updaterState.releaseDate && (
                  <div className={settingsSurfaceCardClass}>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.releaseDate', 'Release Date')}</div>
                    <div className="mt-2 text-[12px] font-mono text-text-primary">{new Date(updaterState.releaseDate).toLocaleString()}</div>
                  </div>
                )}
                {updaterState.downloadUrl && (
                  <div className={settingsSurfaceCardClass}>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.releaseSource', 'Release Source')}</div>
                    <div className="mt-2 break-all text-[12px] font-mono text-text-primary">{updaterState.downloadUrl}</div>
                  </div>
                )}
              </div>
            )}

            {updaterState?.releaseNotes && (
              <div className={settingsSurfaceCardClass}>
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.releaseNotes', 'Release Notes')}</div>
                <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] leading-6 text-text-secondary">{updaterState.releaseNotes}</pre>
              </div>
            )}

            {updateNote && (
              <div className="rounded-2xl border border-border-subtle/55 bg-surface-2/60 px-4 py-3 text-[12px] text-text-secondary">
                {updateNote}
              </div>
            )}
          </div>
        </SettingsSection>
      )}

      <SettingsSection
        eyebrow={t('settings.setup', 'Setup')}
        title={t('settings.replayOnboarding', 'Replay Onboarding')}
        description={t('settings.replayOnboardingDesc', 'Jump back into the guided first-run flow to reconfigure basics, provider setup, and recommended workbench entry points.')}
      >
        <div className={`${settingsFieldCardClass} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <p className="text-sm font-semibold text-text-primary">{t('settings.onboardingTitle', 'Onboarding Walkthrough')}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{t('settings.onboardingDesc', 'Replay the first-run setup guide and jump back into the recommended starting flow.')}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOnboarding({ completed: false, skipped: false, currentStep: 0 })
              navigate('/chat')
            }}
            className={settingsPrimaryButtonClass}
          >
            {t('settings.rerunOnboarding', 'Re-run Walkthrough')}
          </button>
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.performance', 'Performance')}
        title={t('settings.liveRuntimeMetrics', 'Live Runtime Metrics')}
        description={t('settings.liveRuntimeMetricsDesc', 'Sample memory, CPU, and runtime version data from the Electron main process when the desktop shell is available.')}
      >
        {!electron ? (
          <div className="rounded-3xl border border-dashed border-border-subtle/55 bg-surface-2/40 px-4 py-8 text-center text-[12px] text-text-muted">
            {t('settings.perfNotAvailable', 'Performance monitoring is only available in the Electron desktop app.')}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void fetchMetrics()} disabled={loading} className={settingsPrimaryButtonClass}>
                <IconifyIcon name={loading ? 'ui-loading' : 'ui-refresh'} size={14} color="currentColor" />
                {loading ? t('settings.loading', 'Loading...') : t('settings.refresh', 'Refresh')}
              </button>
              <button type="button" onClick={() => setAutoRefresh(!autoRefresh)} className={settingsSecondaryButtonClass}>
                {autoRefresh ? t('settings.autoRefreshOn', 'Auto refresh on (3s)') : t('settings.autoRefreshOff', 'Auto refresh off')}
              </button>
            </div>

            <SettingsToggleRow
              label={t('settings.autoRefresh', 'Auto refresh metrics')}
              description={t('settings.autoRefreshMetricsDesc', 'Continuously refresh memory and CPU counters every three seconds while this page is open.')}
              checked={autoRefresh}
              onChange={() => setAutoRefresh(!autoRefresh)}
            />

            {metrics && (
              <div className="space-y-4">
                <div className={settingsFieldCardClass}>
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted/55">{t('settings.memoryUsage', 'Memory')}</div>
                  <div className="grid gap-3 lg:grid-cols-4">
                    {([
                      { label: 'Heap Used', value: metrics.memory.heapUsed, pct: Math.round((metrics.memory.heapUsed / metrics.memory.heapTotal) * 100) },
                      { label: 'Heap Total', value: metrics.memory.heapTotal, pct: null },
                      { label: 'RSS', value: metrics.memory.rss, pct: null },
                      { label: 'External', value: metrics.memory.external, pct: null },
                    ] as const).map(({ label, value, pct }) => (
                      <div key={label} className={settingsSurfaceCardClass}>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{label}</p>
                        <p className="mt-2 text-sm font-mono font-semibold text-text-primary">{formatBytes(value)}</p>
                        {pct !== null && (
                          <div className="mt-3">
                            <progress value={pct} max={100} className={`memory-usage-meter ${getUsageMeterTone(pct)}`} aria-label={`${label} usage ${pct}%`} />
                            <p className="mt-1 text-[10px] text-text-muted">{pct}%</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className={settingsFieldCardClass}>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">CPU User</p>
                    <p className="mt-2 text-sm font-mono font-semibold text-text-primary">{(metrics.cpu.user / 1000).toFixed(1)}ms</p>
                  </div>
                  <div className={settingsFieldCardClass}>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">CPU System</p>
                    <p className="mt-2 text-sm font-mono font-semibold text-text-primary">{(metrics.cpu.system / 1000).toFixed(1)}ms</p>
                  </div>
                  <div className={settingsFieldCardClass}>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.uptime', 'Uptime')}</p>
                    <p className="mt-2 text-sm font-mono font-semibold text-text-primary">{formatUptime(metrics.uptime)}</p>
                  </div>
                </div>

                {metrics.versions && (
                  <div className={settingsFieldCardClass}>
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted/55">{t('settings.runtimeVersions', 'Runtime Versions')}</div>
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {Object.entries(metrics.versions).map(([name, version]) => (
                        <div key={name} className={`${settingsSurfaceCardClass} flex items-center justify-between gap-3`}>
                          <span className="text-[11px] text-text-muted">{name}</span>
                          <span className="text-[11px] font-mono text-text-primary">{version}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SettingsSection>

      {electron && (
        <SettingsSection
          eyebrow={t('settings.crashLogs', 'Crash Logs')}
          title={t('settings.failureArchive', 'Failure Archive')}
          description={t('settings.failureArchiveDesc', 'Review recent desktop crashes, inspect the recorded error payload, and clear the archive once the issue is understood.')}
          action={crashLogs.length > 0 ? (
            <button
              type="button"
              onClick={async () => {
                await electron.invoke('crash:clearLogs')
                setCrashLogs([])
              }}
              className={settingsDangerButtonClass}
            >
              {t('settings.clearAll', 'Clear')}
            </button>
          ) : undefined}
        >
          {crashLogs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border-subtle/55 bg-surface-2/40 px-4 py-8 text-center text-[12px] text-text-muted">
              <span className="inline-flex items-center gap-2 text-text-secondary">
                <IconifyIcon name="ui-check-circle" size={14} color="currentColor" />
                {t('settings.noCrashLogs', 'No crash logs found.')}
              </span>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {crashLogs.map((log, index) => (
                <div key={index} className="rounded-3xl border border-red-500/12 bg-red-500/5 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-mono text-[11px] text-text-muted">{log.file}</span>
                    <span className="text-[11px] text-text-muted">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}</span>
                  </div>
                  <p className="mt-3 wrap-break-word font-mono text-[12px] leading-6 text-red-400">{log.error || 'Unknown error'}</p>
                </div>
              ))}
            </div>
          )}
        </SettingsSection>
      )}
    </div>
  )
}