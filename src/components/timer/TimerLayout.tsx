import { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react'
import { SidePanel } from '@/components/layout/SidePanel'
import { ResizeHandle } from '@/components/layout/ResizeHandle'
import { useResizablePanel } from '@/hooks/useResizablePanel'
import { useAppStore } from '@/store/appStore'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { useI18n } from '@/hooks/useI18n'
import type { ScheduledTask } from '@/types'
import { electronInvoke, electronOn, electronOff, formatRelative, TIMER_REFRESH_INTERVAL_MS, type TimerFormData } from './timerHelpers'
import { TimerForm } from './TimerForm'
import { TimerDetail } from './TimerDetail'
import { loadPipelinesFromDisk } from '@/services/pipelineFiles'
import { handleTimerFired } from '@/services/timerRuntime'

export function TimerLayout() {
  const [panelWidth, setPanelWidth] = useResizablePanel('timer', 280)
  const [timers, setTimers] = useState<ScheduledTask[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { workspacePath, setAgentPipelines } = useAppStore()
  const { t } = useI18n()
  const deferredSearchQuery = useDeferredValue(searchQuery)

  const loadTimers = useCallback(async () => {
    try {
      const result = (await electronInvoke('timer:list')) as { timers?: ScheduledTask[]; error?: string }
      if (result.timers) setTimers(result.timers)
    } catch {
      // ignore — may be in browser mode
    }
  }, [])

  // Listen for timer:fired events from main process
  useEffect(() => {
    loadTimers()
    const handler = () => { void loadTimers() }
    electronOn('timer:fired', handler)
    // Also refresh every 30s so nextRun times stay current
    const interval = setInterval(loadTimers, TIMER_REFRESH_INTERVAL_MS)
    return () => {
      electronOff('timer:fired', handler)
      clearInterval(interval)
    }
  }, [loadTimers])

  useEffect(() => {
    if (!workspacePath) return
    loadPipelinesFromDisk(workspacePath).then((pipelines) => setAgentPipelines(pipelines))
  }, [workspacePath, setAgentPipelines])

  const selectedTimer = timers.find((t) => t.id === selectedId) ?? null

  useEffect(() => {
    if (creating || editing || selectedId || timers.length === 0) return
    setSelectedId(timers[0].id)
  }, [timers, selectedId, creating, editing])

  const filteredTimers = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase()
    if (!query) return timers
    return timers.filter((timer) => {
      const haystacks = [timer.name, timer.prompt || '', timer.pipelineId || '', timer.agentId || '']
      return haystacks.some((value) => value.toLowerCase().includes(query))
    })
  }, [timers, deferredSearchQuery])

  const enabledCount = useMemo(() => timers.filter((timer) => timer.enabled).length, [timers])
  const pipelineCount = useMemo(() => timers.filter((timer) => timer.action === 'pipeline').length, [timers])

  async function handleCreate(data: TimerFormData) {
    const result = (await electronInvoke('timer:create', {
      name: data.name,
      type: data.type,
      schedule: data.schedule,
      action: data.action,
      prompt: data.prompt,
      agentId: data.agentId || undefined,
      pipelineId: data.pipelineId || undefined,
      timezone: data.timezone,
      missedRunPolicy: data.missedRunPolicy,
      maxRetries: data.maxRetries,
      retryIntervalMinutes: data.retryIntervalMinutes,
      calendarRule: data.calendarRule,
      enabled: true,
    })) as { timer?: ScheduledTask; error?: string }
    if (result.timer) {
      setSelectedId(result.timer.id)
    }
    setCreating(false)
    loadTimers()
  }

  async function handleUpdate(data: TimerFormData) {
    if (!selectedId) return
    await electronInvoke('timer:update', selectedId, {
      name: data.name,
      type: data.type,
      schedule: data.schedule,
      action: data.action,
      prompt: data.prompt,
      agentId: data.agentId || undefined,
      pipelineId: data.pipelineId || undefined,
      timezone: data.timezone,
      missedRunPolicy: data.missedRunPolicy,
      maxRetries: data.maxRetries,
      retryIntervalMinutes: data.retryIntervalMinutes,
      calendarRule: data.calendarRule,
    })
    setEditing(false)
    loadTimers()
  }

  async function handleDelete() {
    if (!selectedId) return
    await electronInvoke('timer:delete', selectedId)
    setSelectedId(null)
    loadTimers()
  }

  async function handleToggle() {
    if (!selectedTimer) return
    await electronInvoke('timer:update', selectedTimer.id, { enabled: !selectedTimer.enabled })
    loadTimers()
  }

  async function handleRunNow() {
    if (!selectedTimer) return
    await handleTimerFired({ ...selectedTimer, lastRun: Date.now() })
    loadTimers()
  }

  // ─── Render ────────────────────────────────────────────────────────

  const sortedTimers = [...filteredTimers].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <>
      <SidePanel title={t('timer.title', 'Timers')} width={panelWidth} action={
        <button
          className="text-[11px] px-3 py-1.5 rounded-xl bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-semibold"
          onClick={() => { setCreating(true); setEditing(false); setSelectedId(null) }}
        >
          {t('timer.new', '+ New')}
        </button>
      }>
        <div className="module-sidebar-stack px-3 pb-3 pt-3 space-y-3">
          <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <div className="relative">
              <IconifyIcon name="ui-search" size={14} color="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/55 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('timer.searchTimers', 'Search timers...')}
                className="w-full rounded-2xl border border-border-subtle/55 bg-surface-2/80 py-2.5 pl-10 pr-3 text-[12px] text-text-primary placeholder-text-muted/55 focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted/70">
              <span>{sortedTimers.length} {t('common.results', 'results')}</span>
              {searchQuery && <span>{timers.length} {t('common.total', 'total')}</span>}
            </div>
          </div>

          {sortedTimers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/65 text-text-muted/60">
                <IconifyIcon name="ui-timer-once" size={18} color="currentColor" />
              </div>
              <p className="text-[12px] leading-relaxed text-text-muted">
                {searchQuery
                  ? t('timer.noMatchingTimers', 'No matching timers.')
                  : t('timer.noTimers', 'No timers yet. Create one to get started.')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedTimers.map((timer) => (
                <button
                  key={timer.id}
                  onClick={() => { setSelectedId(timer.id); setCreating(false); setEditing(false) }}
                  className={`w-full rounded-[22px] border px-3.5 py-3.5 text-left transition-all duration-200 ${
                    selectedId === timer.id
                      ? 'border-accent/20 bg-accent/10 shadow-[0_14px_34px_rgba(var(--t-accent-rgb),0.07)]'
                      : 'border-transparent bg-surface-1/20 hover:bg-surface-3/55 hover:border-border-subtle/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-0/75 shadow-sm text-accent">
                        <IconifyIcon name={timer.type === 'once' ? 'ui-timer-once' : 'ui-repeat'} size={18} color="currentColor" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-[13px] font-semibold text-text-primary">{timer.name}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${timer.enabled ? 'bg-green-500/15 text-green-400' : 'bg-surface-3 text-text-muted'}`}>
                            {timer.enabled ? t('timer.enabled', 'Enabled') : t('timer.disabled', 'Disabled')}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-text-secondary/80 line-clamp-2">
                          {timer.action === 'pipeline'
                            ? t('timer.pipelineScheduledRun', 'Saved pipeline execution on schedule')
                            : timer.prompt || t('timer.emptyPrompt', 'No prompt content')}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-text-muted">
                          <span className="rounded-full bg-surface-3/80 px-2 py-0.5">{timer.action === 'pipeline' ? t('agents.pipeline', 'Pipeline') : timer.action === 'prompt' ? t('timer.agentPrompt', 'Agent Prompt') : t('timer.notify', 'Notify')}</span>
                          <span className="rounded-full bg-surface-3/80 px-2 py-0.5">{timer.nextRun ? `${t('timer.nextRun', 'Next Run')}: ${formatRelative(timer.nextRun)}` : t('timer.notScheduled', 'Not scheduled')}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${timer.enabled ? 'bg-green-400' : 'bg-text-muted/30'}`} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </SidePanel>
      <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={224} maxWidth={360} />

      <div className="module-workspace flex-1 flex flex-col overflow-y-auto">
        {creating ? (
          <TimerForm key="new" onSave={handleCreate} onCancel={() => setCreating(false)} />
        ) : editing && selectedTimer ? (
          <TimerForm key={selectedTimer.id} initial={selectedTimer} onSave={handleUpdate} onCancel={() => setEditing(false)} />
        ) : selectedTimer ? (
          <TimerDetail
            timer={selectedTimer}
            onEdit={() => setEditing(true)}
            onDelete={handleDelete}
            onToggle={handleToggle}
            onRunNow={handleRunNow}
          />
        ) : (
          <div className="module-canvas flex-1 overflow-y-auto px-6 py-8 text-text-muted xl:px-10">
            <div className="mx-auto flex h-full w-full max-w-4xl items-start justify-center pt-6">
              <div className="w-full rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/94 via-surface-1/88 to-surface-2/72 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.16)] animate-fade-in xl:p-10">
                <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-2xl">
                    <div className="flex h-18 w-18 items-center justify-center rounded-[26px] border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.12)]">
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <p className="mt-5 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('timer.scheduler', 'Scheduler')}</p>
                    <h2 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">{t('timer.timersAndReminders', 'Timers & Reminders')}</h2>
                    <p className="mt-3 max-w-xl text-[14px] leading-7 text-text-secondary/82">{t('timer.createHint', 'Create timers via the + New button or ask your AI assistant.')}</p>
                    <p className="mt-4 max-w-xl text-[12px] leading-6 text-text-muted">{t('timer.trySaying', 'Try saying:')} “{t('timer.exampleTimer', 'Set a timer for 10 minutes to remind me to take a break')}”</p>
                    <button
                      className="mt-6 rounded-2xl bg-accent px-5 py-3 text-[13px] font-semibold text-white shadow-[0_10px_30px_rgba(var(--t-accent-rgb),0.22)] transition-all hover:bg-accent-hover"
                      onClick={() => { setCreating(true); setEditing(false); setSelectedId(null) }}
                    >
                      {t('timer.new', '+ New')}
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 xl:w-[24rem] xl:grid-cols-1">
                    <div className="rounded-[22px] border border-border-subtle/55 bg-surface-0/60 p-4">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('common.total', 'Total')}</div>
                      <div className="mt-2 text-2xl font-semibold text-text-primary tabular-nums">{timers.length}</div>
                      <div className="mt-1 text-[12px] text-text-muted">{t('timer.scheduledItems', 'scheduled items')}</div>
                    </div>
                    <div className="rounded-[22px] border border-border-subtle/55 bg-surface-0/60 p-4">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('common.enabled', 'Enabled')}</div>
                      <div className="mt-2 text-2xl font-semibold text-text-primary tabular-nums">{enabledCount}</div>
                      <div className="mt-1 text-[12px] text-text-muted">{t('timer.currentlyActive', 'currently active')}</div>
                    </div>
                    <div className="rounded-[22px] border border-border-subtle/55 bg-surface-0/60 p-4">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('agents.pipeline', 'Pipeline')}</div>
                      <div className="mt-2 text-2xl font-semibold text-text-primary tabular-nums">{pipelineCount}</div>
                      <div className="mt-1 text-[12px] text-text-muted">{t('timer.pipelineSchedules', 'pipeline schedules')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
