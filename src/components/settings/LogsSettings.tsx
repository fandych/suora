import { useState, useEffect } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { getAuditLog, getAuditStats, clearAuditLog } from '@/services/skillSecurity'

function AuditDashboard() {
  const { t } = useI18n()
  const [stats, setStats] = useState({ total: 0, byTool: {} as Record<string, number>, errors: 0, blocked: 0, last24h: 0 })

  useEffect(() => { setStats(getAuditStats()) }, [])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        {([
          { value: stats.total, label: t('settings.totalCalls', 'Total'), color: 'text-accent' },
          { value: stats.last24h, label: t('settings.last24h', '24h'), color: 'text-accent' },
          { value: stats.errors, label: t('settings.errors', 'Errors'), color: 'text-danger' },
          { value: stats.blocked, label: t('settings.blocked', 'Blocked'), color: 'text-warning' },
        ]).map(({ value, label, color }) => (
          <div key={label} className="rounded-lg bg-surface-1 p-3 text-center">
            <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
            <div className="text-[10px] text-text-muted mt-0.5">{label}</div>
          </div>
        ))}
      </div>
      {Object.keys(stats.byTool).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(stats.byTool).sort(([, a], [, b]) => b - a).slice(0, 8).map(([name, count]) => (
            <span key={name} className="px-2 py-0.5 rounded-md bg-surface-2 text-[10px] text-text-secondary font-mono">{name}: <strong>{count}</strong></span>
          ))}
        </div>
      )}
    </div>
  )
}

export function LogsSettings() {
  const { t } = useI18n()
  const [logs, setLogs] = useState<Array<{ id: string; timestamp: number; toolName: string; status: string; duration?: number; result?: string }>>([])
  const [filter, setFilter] = useState<'all' | 'success' | 'error' | 'blocked'>('all')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'overview' | 'detail'>('overview')

  useEffect(() => { setLogs(getAuditLog().reverse()) }, [])

  const displayed = logs
    .filter((l) => filter === 'all' || l.status === filter)
    .filter((l) => !search || l.toolName.toLowerCase().includes(search.toLowerCase()) || (l.result || '').toLowerCase().includes(search.toLowerCase()))

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
    <div className="space-y-5">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-surface-2 rounded-xl p-1 w-fit">
        {([
          { id: 'overview' as const, label: t('settings.auditDashboard', 'Overview') },
          { id: 'detail' as const, label: t('settings.detailLogs', 'Detail Logs') },
        ]).map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === tb.id ? 'bg-accent/15 text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        /* ─── Audit Overview ─── */
        <div className="space-y-4">
          <AuditDashboard />
          <div className="rounded-xl border border-border p-4 bg-surface-0/30">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">{t('settings.recentActivity', 'Recent Activity')}</h3>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {getAuditLog().slice(-20).reverse().map((entry) => (
                <div key={entry.id} className="flex items-center gap-2 text-xs bg-surface-2 rounded-lg px-3 py-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${entry.status === 'success' ? 'bg-green-500' : entry.status === 'blocked' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                  <span className="font-mono text-accent shrink-0">{entry.toolName}</span>
                  <span className="text-text-muted truncate">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  {entry.duration && <span className="text-text-muted/60 shrink-0">{entry.duration}ms</span>}
                </div>
              ))}
              {getAuditLog().length === 0 && (
                <p className="text-xs text-text-muted py-4 text-center">{t('settings.noAuditEntries', 'No audit log entries yet.')}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => { clearAuditLog(); setLogs([]) }}
            className="px-4 py-2 rounded-xl bg-danger/10 text-danger text-xs font-medium hover:bg-danger/20 transition-colors"
          >
            {t('settings.clearAuditLog', 'Clear Audit Log')}
          </button>
        </div>
      ) : (
        /* ─── Detail Logs ─── */
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('settings.searchLogs', 'Search logs...')}
              className="flex-1 min-w-[160px] px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <div className="flex gap-1">
              {(['all', 'success', 'error', 'blocked'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs capitalize transition-colors ${
                    filter === f ? 'bg-accent/15 text-accent font-medium' : 'text-text-muted hover:bg-surface-2'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button onClick={exportLogs} className="px-3 py-1.5 rounded-xl bg-accent/15 text-accent text-xs font-medium hover:bg-accent/25 transition-colors border border-accent/30 inline-flex items-center gap-1">
              <IconifyIcon name="ui-export" size={12} color="currentColor" /> {t('settings.exportJson', 'Export')}
            </button>
            <button onClick={() => { clearAuditLog(); setLogs([]) }} className="px-3 py-1.5 rounded-xl bg-danger/15 text-danger text-xs font-medium hover:bg-danger/25 transition-colors border border-danger/30">
              {t('settings.clearAll', 'Clear')}
            </button>
          </div>

          <div className="text-[10px] text-text-muted">{displayed.length} / {logs.length}</div>

          <div className="space-y-1 max-h-[480px] overflow-y-auto">
            {displayed.length === 0 ? (
              <div className="text-center py-12 text-text-muted text-sm">{t('settings.noLogEntries', 'No log entries')}</div>
            ) : (
              displayed.slice(0, 200).map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-1 border border-border/30 text-xs hover:bg-surface-2/80 transition-colors">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${entry.status === 'success' ? 'bg-green-500' : entry.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                  <span className="font-mono font-medium text-text-primary min-w-[120px]">{entry.toolName}</span>
                  {entry.duration != null && <span className="text-text-muted">{entry.duration}ms</span>}
                  <span className="flex-1 text-text-muted truncate font-mono text-[10px]">{entry.result?.slice(0, 100)}</span>
                  <span className="text-text-muted shrink-0">{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
