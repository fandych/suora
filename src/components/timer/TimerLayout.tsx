import { useState, useEffect, useCallback } from 'react'
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

export function TimerLayout() {
  const [panelWidth, setPanelWidth] = useResizablePanel('timer', 280)
  const [timers, setTimers] = useState<ScheduledTask[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [creating, setCreating] = useState(false)
  const { workspacePath, setAgentPipelines } = useAppStore()
  const { t } = useI18n()

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

  async function handleCreate(data: TimerFormData) {
    const result = (await electronInvoke('timer:create', {
      name: data.name,
      type: data.type,
      schedule: data.schedule,
      action: data.action,
      prompt: data.prompt,
      agentId: data.agentId || undefined,
      pipelineId: data.pipelineId || undefined,
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

  // ─── Render ────────────────────────────────────────────────────────

  const sortedTimers = [...timers].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <>
      <SidePanel title={t('timer.title', 'Timers')} width={panelWidth} action={
        <button
          className="text-[11px] px-2.5 py-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium"
          onClick={() => { setCreating(true); setEditing(false); setSelectedId(null) }}
        >
          {t('timer.new', '+ New')}
        </button>
      }>
        {sortedTimers.length === 0 ? (
          <div className="p-4 text-xs text-text-muted text-center py-8">
            {t('timer.noTimers', 'No timers yet. Create one to get started.')}
          </div>
        ) : (
          <div className="flex flex-col">
            {sortedTimers.map((timer) => (
              <button
                key={timer.id}
                onClick={() => { setSelectedId(timer.id); setCreating(false); setEditing(false) }}
                className={`w-full text-left px-4 py-3 border-b border-border-subtle transition-colors ${
                  selectedId === timer.id ? 'bg-accent/8' : 'hover:bg-surface-2/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-primary truncate">{timer.name}</span>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${timer.enabled ? 'bg-green-400' : 'bg-text-muted/30'}`} />
                </div>
                <div className="text-[10px] text-text-muted mt-0.5 flex items-center gap-1">
                  {timer.type === 'once' ? <IconifyIcon name="ui-timer-once" size={10} /> : <IconifyIcon name="ui-repeat" size={10} />} {timer.nextRun ? `Next: ${formatRelative(timer.nextRun)}` : 'Not scheduled'}
                </div>
              </button>
            ))}
          </div>
        )}
      </SidePanel>
      <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={200} maxWidth={480} />

      <div className="flex-1 flex flex-col overflow-y-auto">
        {creating ? (
          <TimerForm onSave={handleCreate} onCancel={() => setCreating(false)} />
        ) : editing && selectedTimer ? (
          <TimerForm initial={selectedTimer} onSave={handleUpdate} onCancel={() => setEditing(false)} />
        ) : selectedTimer ? (
          <TimerDetail
            timer={selectedTimer}
            onEdit={() => setEditing(true)}
            onDelete={handleDelete}
            onToggle={handleToggle}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-muted">
            <div className="text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-5 border border-border-subtle">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <p className="text-sm text-text-secondary font-medium">{t('timer.timersAndReminders', 'Timers & Reminders')}</p>
              <p className="text-xs text-text-muted mt-1">{t('timer.createHint', 'Create timers via the + New button or ask your AI assistant.')}</p>
              <p className="text-[10px] text-text-muted mt-3 max-w-xs mx-auto">
                {t('timer.trySaying', 'Try saying:')} &ldquo;{t('timer.exampleTimer', 'Set a timer for 10 minutes to remind me to take a break')}&rdquo;
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
