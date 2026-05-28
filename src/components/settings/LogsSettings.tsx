import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { clearAuditLog, getAuditLog } from '@/services/skillSecurity'
import { SettingsSection, SettingsStat, settingsInputClass } from './panelUi'
import { getElectron } from './shared'

type AuditLogStatus = 'success' | 'error' | 'blocked'
type LogsTab = 'overview' | 'audit' | 'runtime'

interface AuditLogEntry {
  id: string
  timestamp: number
  toolName: string
  status: string
  duration?: number
  result?: string
}

interface RuntimeLogFile {
  name: string
  size: number
  modifiedAt: string
  active: boolean
}

function StatusPill({ status }: { status: AuditLogStatus }) {
  const { t } = useI18n()
  const className = status === 'success'
    ? 'bg-green-500/12 text-green-400'
    : status === 'blocked'
      ? 'bg-amber-500/12 text-amber-400'
      : 'bg-red-500/12 text-red-400'

  const label = status === 'success'
    ? t('settings.success', 'success')
    : status === 'blocked'
      ? t('settings.blocked', 'blocked')
      : t('settings.error', 'error')

  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${className}`}>{label}</span>
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function isRuntimeLogFileArray(value: unknown): value is RuntimeLogFile[] {
  return Array.isArray(value) && value.every((item) => {
    const candidate = item as Partial<RuntimeLogFile>
    return typeof candidate.name === 'string'
      && typeof candidate.size === 'number'
      && typeof candidate.modifiedAt === 'string'
      && typeof candidate.active === 'boolean'
  })
}

export function LogsSettings() {
  const { t } = useI18n()
  const electron = getElectron()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [runtimeFiles, setRuntimeFiles] = useState<RuntimeLogFile[]>([])
  const [selectedLogFile, setSelectedLogFile] = useState<string>('')
  const [runtimeContent, setRuntimeContent] = useState('')
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [runtimeLoading, setRuntimeLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | AuditLogStatus>('all')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<LogsTab>('overview')
  const deferredSearch = useDeferredValue(search)

  const fetchRuntimeFiles = useCallback(async () => {
    if (!electron) return
    try {
      const result = await electron.invoke('log:listFiles')
      if (!isRuntimeLogFileArray(result)) return
      setRuntimeFiles(result)
      setSelectedLogFile((current) => current || result[0]?.name || '')
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : String(error))
    }
  }, [electron])

  const fetchRuntimeContent = useCallback(async (fileName: string) => {
    if (!electron || !fileName) {
      setRuntimeContent('')
      return
    }
    setRuntimeLoading(true)
    setRuntimeError(null)
    try {
      const result = await electron.invoke('log:readFile', fileName, 1024 * 1024) as { content?: unknown; error?: unknown }
      if (typeof result.error === 'string') {
        setRuntimeError(result.error)
        setRuntimeContent('')
      } else {
        setRuntimeContent(typeof result.content === 'string' ? result.content : '')
      }
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : String(error))
      setRuntimeContent('')
    } finally {
      setRuntimeLoading(false)
    }
  }, [electron])

  useEffect(() => {
    setLogs([...getAuditLog()].reverse())
    void fetchRuntimeFiles()
  }, [fetchRuntimeFiles])

  useEffect(() => {
    void fetchRuntimeContent(selectedLogFile)
  }, [fetchRuntimeContent, selectedLogFile])

  const displayed = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    return logs
      .filter((log) => filter === 'all' || log.status === filter)
      .filter((log) => !query || log.toolName.toLowerCase().includes(query) || (log.result || '').toLowerCase().includes(query))
  }, [deferredSearch, filter, logs])

  const stats = useMemo(() => {
    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000
    const byTool: Record<string, number> = {}
    let errors = 0
    let blocked = 0
    let last24h = 0

    for (const entry of logs) {
      byTool[entry.toolName] = (byTool[entry.toolName] || 0) + 1
      if (entry.status === 'error') errors++
      if (entry.status === 'blocked') blocked++
      if (entry.timestamp >= oneDayAgo) last24h++
    }

    const runtimeBytes = runtimeFiles.reduce((total, file) => total + file.size, 0)
    return { total: logs.length, errors, blocked, last24h, byTool, runtimeBytes }
  }, [logs, runtimeFiles])

  const topTools = useMemo(
    () => Object.entries(stats.byTool).sort(([, left], [, right]) => right - left).slice(0, 8),
    [stats.byTool],
  )

  const recentEntries = useMemo(() => logs.slice(0, 20), [logs])

  const selectedRuntimeFile = useMemo(
    () => runtimeFiles.find((file) => file.name === selectedLogFile),
    [runtimeFiles, selectedLogFile],
  )

  const handleClearAuditLogs = () => {
    clearAuditLog()
    setLogs([])
  }

  const handleClearRuntimeLogs = async () => {
    if (!electron) return
    setRuntimeLoading(true)
    try {
      const result = await electron.invoke('log:clearFiles') as { error?: unknown } | undefined
      if (result?.error) {
        setRuntimeError(String(result.error))
        return
      }
      setRuntimeContent('')
      setSelectedLogFile('')
      await fetchRuntimeFiles()
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : String(error))
    } finally {
      setRuntimeLoading(false)
    }
  }

  const exportAuditLogs = () => {
    const text = JSON.stringify(displayed, null, 2)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportRuntimeLog = () => {
    if (!selectedLogFile) return
    const blob = new Blob([runtimeContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = selectedLogFile
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        eyebrow={t('settings.logs', 'Logs')}
        title={t('settings.auditAndRuntimeEvidence', 'Audit & Runtime Evidence')}
        description={t('settings.auditAndRuntimeEvidenceHint', 'Review tool execution history, runtime log files, and recent failures so it is easier to trace what the workspace actually did.')}
        action={
          <div className="flex flex-wrap gap-2">
            {([
              { id: 'overview' as const, label: t('settings.auditDashboard', 'Overview') },
              { id: 'audit' as const, label: t('settings.auditLogs', 'Audit Logs') },
              { id: 'runtime' as const, label: t('settings.runtimeLogs', 'Runtime Logs') },
            ]).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${tab === item.id ? 'border-accent/20 bg-accent/10 text-accent' : 'border-border-subtle/55 bg-surface-0/72 text-text-secondary hover:bg-surface-2'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SettingsStat label={t('settings.totalCalls', 'Total')} value={String(stats.total)} accent />
          <SettingsStat label={t('settings.last24h', '24h')} value={String(stats.last24h)} />
          <SettingsStat label={t('settings.runtimeFiles', 'Runtime Files')} value={String(runtimeFiles.length)} />
          <SettingsStat label={t('settings.logSize', 'Log Size')} value={formatBytes(stats.runtimeBytes)} />
        </div>
      </SettingsSection>

      {tab === 'overview' && (
        <SettingsSection
          eyebrow={t('settings.auditDashboard', 'Overview')}
          title={t('settings.recentActivity', 'Recent Activity')}
          description={t('settings.recentActivityHint', 'The newest audit entries and runtime log files surface here first, alongside the tools most frequently involved in recent execution.')}
          action={
            <button
              type="button"
              onClick={() => {
                setLogs([...getAuditLog()].reverse())
                void fetchRuntimeFiles()
              }}
              className="rounded-2xl border border-accent/18 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/18"
            >
              {t('settings.refresh', 'Refresh')}
            </button>
          }
        >
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.recentActivity', 'Recent Activity')}</div>
              <div className="mt-4 space-y-2 max-h-96 overflow-y-auto pr-1">
                {recentEntries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border-subtle/60 bg-surface-2/35 px-4 py-10 text-center text-[12px] text-text-muted">{t('settings.noAuditEntries', 'No audit log entries yet.')}</div>
                ) : (
                  recentEntries.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[12px] font-semibold text-text-primary">{entry.toolName}</span>
                            <StatusPill status={entry.status as AuditLogStatus} />
                          </div>
                          <p className="mt-2 text-[11px] leading-5 text-text-secondary/80">{entry.result?.slice(0, 160) || t('settings.noResultPreview', 'No result preview recorded.')}</p>
                        </div>
                        <div className="text-right text-[10px] text-text-muted/75">
                          <div>{new Date(entry.timestamp).toLocaleTimeString()}</div>
                          {entry.duration != null && <div className="mt-1">{entry.duration}ms</div>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.runtimeLogFiles', 'Runtime Log Files')}</div>
                <div className="mt-4 space-y-2">
                  {runtimeFiles.length === 0 ? (
                    <span className="text-[12px] text-text-muted">{electron ? t('settings.noRuntimeLogs', 'No runtime log files found.') : t('settings.desktopRuntimeRequired', 'Runtime log files are available in the desktop app.')}</span>
                  ) : (
                    runtimeFiles.slice(0, 5).map((file) => (
                      <button
                        key={file.name}
                        type="button"
                        onClick={() => {
                          setSelectedLogFile(file.name)
                          setTab('runtime')
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-[12px] font-semibold text-text-primary">{file.name}</span>
                          <span className="text-[10px] text-text-muted">{new Date(file.modifiedAt).toLocaleString()}</span>
                        </span>
                        <span className="shrink-0 text-[10px] text-text-muted">{formatBytes(file.size)}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.topTools', 'Top Tools')}</div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {topTools.length === 0 ? (
                    <span className="text-[12px] text-text-muted">{t('settings.noAuditEntries', 'No audit log entries yet.')}</span>
                  ) : (
                    topTools.map(([toolName, count]) => (
                      <span key={toolName} className="rounded-full bg-surface-2/70 px-3 py-1 text-[11px] text-text-secondary">
                        <span className="font-mono text-text-primary">{toolName}</span> · {count}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </SettingsSection>
      )}

      {tab === 'audit' && (
        <SettingsSection
          eyebrow={t('settings.auditLogs', 'Audit Logs')}
          title={t('settings.filterableAuditStream', 'Filterable Audit Stream')}
          description={t('settings.filterableAuditStreamHint', 'Search by tool or result content, narrow by status, then export the filtered evidence as JSON if needed.')}
          action={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportAuditLogs}
                className="rounded-2xl border border-accent/18 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/18"
              >
                <span className="inline-flex items-center gap-1.5"><IconifyIcon name="ui-export" size={14} color="currentColor" /> {t('settings.exportJson', 'Export')}</span>
              </button>
              <button
                type="button"
                onClick={handleClearAuditLogs}
                className="rounded-2xl border border-red-500/18 bg-red-500/8 px-4 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/14"
              >
                {t('settings.clearAll', 'Clear')}
              </button>
            </div>
          }
        >
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('settings.searchLogs', 'Search logs...')}
              className={settingsInputClass}
            />
            <div className="flex flex-wrap gap-2">
              {(['all', 'success', 'error', 'blocked'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilter(status)}
                  className={`rounded-2xl border px-4 py-3 text-[11px] font-semibold capitalize transition-colors ${filter === status ? 'border-accent/20 bg-accent/10 text-accent' : 'border-border-subtle/55 bg-surface-0/72 text-text-secondary hover:bg-surface-2'}`}
                >
                  {status === 'all'
                    ? t('settings.all', 'all')
                    : status === 'success'
                      ? t('settings.success', 'success')
                      : status === 'error'
                        ? t('settings.error', 'error')
                        : t('settings.blocked', 'blocked')}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 text-[11px] text-text-muted/75">{displayed.length} / {logs.length}</div>

          <div className="mt-5 space-y-3 max-h-180 overflow-y-auto pr-1">
            {displayed.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center text-[12px] text-text-muted">{t('settings.noLogEntries', 'No log entries')}</div>
            ) : (
              displayed.slice(0, 200).map((entry) => (
                <article key={entry.id} className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[12px] font-semibold text-text-primary">{entry.toolName}</span>
                        <StatusPill status={entry.status as AuditLogStatus} />
                        {entry.duration != null && <span className="text-[10px] text-text-muted/75">{entry.duration}ms</span>}
                      </div>
                      <div className="mt-2 text-[11px] leading-6 text-text-secondary wrap-break-word">{entry.result || t('settings.noResultPreview', 'No result preview recorded.')}</div>
                    </div>
                    <div className="shrink-0 text-right text-[10px] text-text-muted/75">{new Date(entry.timestamp).toLocaleString()}</div>
                  </div>
                </article>
              ))
            )}
          </div>
        </SettingsSection>
      )}

      {tab === 'runtime' && (
        <SettingsSection
          eyebrow={t('settings.runtimeLogs', 'Runtime Logs')}
          title={t('settings.runtimeLogFiles', 'Runtime Log Files')}
          description={t('settings.runtimeLogFilesHint', 'Inspect the rotating desktop log files written by the main process and renderer logger.')}
          action={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void fetchRuntimeFiles()}
                className="rounded-2xl border border-accent/18 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/18"
              >
                {t('settings.refresh', 'Refresh')}
              </button>
              <button
                type="button"
                disabled={!selectedLogFile}
                onClick={exportRuntimeLog}
                className="rounded-2xl border border-accent/18 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/18 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-1.5"><IconifyIcon name="ui-export" size={14} color="currentColor" /> {t('settings.exportLogFile', 'Export Log')}</span>
              </button>
              <button
                type="button"
                disabled={!electron || runtimeLoading}
                onClick={() => void handleClearRuntimeLogs()}
                className="rounded-2xl border border-red-500/18 bg-red-500/8 px-4 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/14 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('settings.clearRuntimeLogs', 'Clear Runtime Logs')}
              </button>
            </div>
          }
        >
          {!electron ? (
            <div className="rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center text-[12px] text-text-muted">{t('settings.desktopRuntimeRequired', 'Runtime log files are available in the desktop app.')}</div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
              <div className="space-y-2 max-h-180 overflow-y-auto pr-1">
                {runtimeFiles.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center text-[12px] text-text-muted">{t('settings.noRuntimeLogs', 'No runtime log files found.')}</div>
                ) : (
                  runtimeFiles.map((file) => (
                    <button
                      key={file.name}
                      type="button"
                      onClick={() => setSelectedLogFile(file.name)}
                      className={`w-full rounded-3xl border px-4 py-3 text-left transition-colors ${selectedLogFile === file.name ? 'border-accent/20 bg-accent/10' : 'border-border-subtle/55 bg-surface-0/45 hover:bg-surface-2'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate font-mono text-[12px] font-semibold text-text-primary">{file.name}</span>
                        {file.active && <span className="shrink-0 rounded-full bg-green-500/12 px-2 py-0.5 text-[10px] font-medium text-green-400">{t('settings.active', 'Active')}</span>}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-text-muted">
                        <span>{new Date(file.modifiedAt).toLocaleString()}</span>
                        <span>{formatBytes(file.size)}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="min-w-0 rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-[12px] font-semibold text-text-primary">{selectedRuntimeFile?.name || t('settings.noLogSelected', 'No log selected')}</div>
                    {selectedRuntimeFile && <div className="mt-1 text-[10px] text-text-muted">{formatBytes(selectedRuntimeFile.size)} · {new Date(selectedRuntimeFile.modifiedAt).toLocaleString()}</div>}
                  </div>
                  {runtimeLoading && <span className="text-[11px] text-text-muted">{t('settings.loading', 'Loading...')}</span>}
                </div>
                {runtimeError ? (
                  <div className="rounded-2xl border border-red-500/18 bg-red-500/8 px-4 py-3 text-[12px] text-red-400">{runtimeError}</div>
                ) : (
                  <pre className="max-h-180 overflow-auto whitespace-pre-wrap rounded-2xl bg-surface-2/70 p-4 font-mono text-[11px] leading-6 text-text-secondary">
                    {runtimeContent || t('settings.noLogContent', 'No log content to display.')}
                  </pre>
                )}
              </div>
            </div>
          )}
        </SettingsSection>
      )}
    </div>
  )
}
