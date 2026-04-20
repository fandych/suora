import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { clearAuditLog, getAuditLog } from '@/services/skillSecurity'
import { SettingsSection, SettingsStat, settingsInputClass } from './panelUi'

function StatusPill({ status }: { status: 'success' | 'error' | 'blocked' }) {
  const className = status === 'success'
    ? 'bg-green-500/12 text-green-400'
    : status === 'blocked'
      ? 'bg-amber-500/12 text-amber-400'
      : 'bg-red-500/12 text-red-400'

  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${className}`}>{status}</span>
}

export function LogsSettings() {
  const { t } = useI18n()
  const [logs, setLogs] = useState<Array<{ id: string; timestamp: number; toolName: string; status: string; duration?: number; result?: string }>>([])
  const [filter, setFilter] = useState<'all' | 'success' | 'error' | 'blocked'>('all')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'overview' | 'detail'>('overview')
  const deferredSearch = useDeferredValue(search)

  useEffect(() => { setLogs(getAuditLog().reverse()) }, [])

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

    return { total: logs.length, errors, blocked, last24h, byTool }
  }, [logs])

  const topTools = useMemo(
    () => Object.entries(stats.byTool).sort(([, left], [, right]) => right - left).slice(0, 8),
    [stats.byTool],
  )

  const recentEntries = useMemo(() => logs.slice(0, 20), [logs])

  const handleClearLogs = () => {
    clearAuditLog()
    setLogs([])
  }

  const exportLogs = () => {
    const text = JSON.stringify(logs, null, 2)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `app-logs-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        eyebrow={t('settings.logs', 'Logs')}
        title={t('settings.auditAndRuntimeEvidence', 'Audit & Runtime Evidence')}
        description={t('settings.auditAndRuntimeEvidenceHint', 'Review tool execution history, blocked actions, and recent failures so it is easier to trace what the workspace actually did.')}
        action={
          <div className="flex gap-2">
            {([
              { id: 'overview' as const, label: t('settings.auditDashboard', 'Overview') },
              { id: 'detail' as const, label: t('settings.detailLogs', 'Detail Logs') },
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
          <SettingsStat label={t('settings.errors', 'Errors')} value={String(stats.errors)} />
          <SettingsStat label={t('settings.blocked', 'Blocked')} value={String(stats.blocked)} />
        </div>
      </SettingsSection>

      {tab === 'overview' ? (
        <SettingsSection
          eyebrow={t('settings.auditDashboard', 'Overview')}
          title={t('settings.recentActivity', 'Recent Activity')}
          description={t('settings.recentActivityHint', 'The newest audit entries surface here first, alongside the tools most frequently involved in recent execution.')}
          action={
            <button
              type="button"
              onClick={handleClearLogs}
              className="rounded-2xl border border-red-500/18 bg-red-500/8 px-4 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/14"
            >
              {t('settings.clearAuditLog', 'Clear Audit Log')}
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
                            <StatusPill status={entry.status as 'success' | 'error' | 'blocked'} />
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

              <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.captureHint', 'Capture Hint')}</div>
                <p className="mt-3 text-[12px] leading-6 text-text-secondary/80">{t('settings.captureHintBody', 'Use this page as a fast audit dashboard, then switch to detail logs when you need targeted filtering or exportable evidence.')}</p>
              </div>
            </div>
          </div>
        </SettingsSection>
      ) : (
        <SettingsSection
          eyebrow={t('settings.detailLogs', 'Detail Logs')}
          title={t('settings.filterableAuditStream', 'Filterable Audit Stream')}
          description={t('settings.filterableAuditStreamHint', 'Search by tool or result content, narrow by status, then export the resulting evidence as JSON if needed.')}
          action={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportLogs}
                className="rounded-2xl border border-accent/18 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/18"
              >
                <span className="inline-flex items-center gap-1.5"><IconifyIcon name="ui-export" size={14} color="currentColor" /> {t('settings.exportJson', 'Export')}</span>
              </button>
              <button
                type="button"
                onClick={handleClearLogs}
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
                  {status}
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
                        <StatusPill status={entry.status as 'success' | 'error' | 'blocked'} />
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
    </div>
  )
}
