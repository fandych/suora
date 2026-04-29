import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { AgentAvatar, IconifyIcon } from '@/components/icons/IconifyIcons'
import { useI18n } from '@/hooks/useI18n'
import type { ScheduledTask, TimerExecution } from '@/types'
import { electronInvoke, formatRelative, formatDateTime } from './timerHelpers'

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-1 rounded-lg p-3 border border-border-subtle">
      <span className="text-[10px] text-text-muted uppercase tracking-wide block mb-0.5">{label}</span>
      <span className="text-xs text-text-primary">{value}</span>
    </div>
  )
}

export function TimerDetail({ timer, onEdit, onDelete, onToggle, onRunNow }: {
  timer: ScheduledTask
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onRunNow?: () => void
}) {
  const { agents, agentPipelines, setActiveModule } = useAppStore()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [history, setHistory] = useState<TimerExecution[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const agent = timer.agentId ? agents.find((a) => a.id === timer.agentId) : null
  const pipeline = timer.pipelineId ? agentPipelines.find((item) => item.id === timer.pipelineId) : null

  useEffect(() => {
    if (showHistory) {
      electronInvoke('timer:history', timer.id)
        .then((res) => {
          const r = res as { history?: TimerExecution[] }
          if (r.history) setHistory(r.history.reverse())
        })
        .catch(() => { /* ignore */ })
    }
  }, [showHistory, timer.id])

  const openPipelineExecution = (execution: TimerExecution) => {
    if (!execution.pipelineId) return

    const query = new URLSearchParams({ pipelineId: execution.pipelineId })
    query.set('timerId', execution.timerId)
    query.set('firedAt', String(execution.firedAt))
    if (execution.pipelineExecutionId) {
      query.set('executionId', execution.pipelineExecutionId)
    }

    setActiveModule('pipeline')
    navigate(`/pipeline?${query.toString()}`)
  }

  return (
    <div className="module-canvas flex-1 overflow-y-auto px-5 py-6 animate-fade-in xl:px-8 xl:py-8">
      <div className="module-content mx-auto max-w-6xl space-y-6">
        <section className="rounded-4xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/94 to-surface-2/72 p-6 shadow-[0_24px_70px_rgba(var(--t-accent-rgb),0.08)] xl:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-18 w-18 items-center justify-center rounded-[26px] border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.12)]">
                <IconifyIcon name={timer.type === 'once' ? 'ui-timer-once' : 'ui-repeat'} size={30} color="currentColor" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('timer.detail', 'Detail')}</div>
                <h2 className="mt-2 text-[30px] font-semibold tracking-tight text-text-primary">{timer.name}</h2>
                <p className="mt-2 text-[14px] leading-7 text-text-secondary/82">
                  <span className="inline-flex items-center gap-1.5">{timer.type === 'once' ? <><IconifyIcon name="ui-timer-once" size={12} /> {t('timer.oneTime', 'One-time')}</> : <><IconifyIcon name="ui-repeat" size={12} /> {t('timer.repeating', 'Repeating')}</>}</span>
                  <span className="mx-2 text-text-muted/40">·</span>
                  <span className="inline-flex items-center gap-1.5">{timer.action === 'notify' ? <><IconifyIcon name="ui-notification" size={12} /> {t('timer.notification', 'Notification')}</> : timer.action === 'pipeline' ? <><IconifyIcon name="skill-agent-comm" size={12} /> {t('timer.pipeline', 'Pipeline')}</> : <><IconifyIcon name="agent-robot" size={12} /> {t('timer.agentPrompt', 'Agent Prompt')}</>}</span>
                  {agent && <span className="ml-2 inline-flex items-center gap-1.5">· <AgentAvatar avatar={agent.avatar} size={12} /> {agent.name}</span>}
                  {pipeline && <span className="ml-2 inline-flex items-center gap-1.5">· <IconifyIcon name="skill-agent-comm" size={12} /> {pipeline.name}</span>}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 xl:max-w-100 xl:justify-end">
              <button
                onClick={onToggle}
                className={`px-4 py-2.5 rounded-2xl text-sm font-semibold transition-colors ${timer.enabled ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25' : 'bg-surface-2 text-text-muted hover:text-text-secondary'}`}
              >
                {timer.enabled ? t('timer.enabled', '● Enabled') : t('timer.disabled', '○ Disabled')}
              </button>
              <button
                onClick={onRunNow}
                className="px-4 py-2.5 rounded-2xl bg-accent/15 text-accent text-sm font-semibold hover:bg-accent/25 transition-colors"
              >
                {t('timer.runNow', 'Run now')}
              </button>
              <button
                onClick={onEdit}
                className="px-4 py-2.5 rounded-2xl bg-surface-2 text-text-muted text-sm font-semibold hover:text-text-secondary transition-colors"
              >
                {t('common.edit', 'Edit')}
              </button>
              <button
                onClick={onDelete}
                className="px-4 py-2.5 rounded-2xl bg-red-500/10 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-colors"
              >
                {t('common.delete', 'Delete')}
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-border-subtle/55 bg-linear-to-br from-surface-1/96 via-surface-1/88 to-surface-2/70 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)] xl:p-6">
              <div className="mb-5">
                <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('timer.overview', 'Overview')}</div>
                <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">{t('timer.scheduleAndState', 'Schedule & State')}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-text-secondary/80">{t('timer.scheduleAndStateHint', 'Review when this timer runs next and how it has behaved so far before changing it.')}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard label={t('timer.schedule', 'Schedule')} value={timer.type === 'once' ? formatDateTime(new Date(timer.schedule).getTime()) : timer.type === 'cron' ? timer.schedule : `Every ${timer.schedule} minutes`} />
                <InfoCard label={t('timer.nextRun', 'Next Run')} value={timer.nextRun ? `${formatDateTime(timer.nextRun)} (${formatRelative(timer.nextRun)})` : t('timer.notScheduled', 'Not scheduled')} />
                <InfoCard label={t('timer.lastRun', 'Last Run')} value={timer.lastRun ? formatDateTime(timer.lastRun) : t('timer.never', 'Never')} />
                <InfoCard label={t('timer.created', 'Created')} value={formatDateTime(timer.createdAt)} />
                <InfoCard label={t('timer.timezone', 'Timezone')} value={timer.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} />
                <InfoCard label={t('timer.retries', 'Retries')} value={`${timer.maxRetries ?? 0} × ${timer.retryIntervalMinutes ?? 5}m`} />
                <InfoCard label={t('timer.missedRuns', 'Missed runs')} value={timer.missedRunPolicy ?? 'skip'} />
                <InfoCard label={t('timer.calendar', 'Calendar')} value={timer.calendarRule ?? 'all-days'} />
              </div>
            </section>

            {(timer.prompt || pipeline) && (
              <section className="rounded-[28px] border border-border-subtle/55 bg-linear-to-br from-surface-1/96 via-surface-1/88 to-surface-2/70 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)] xl:p-6">
                <div className="mb-5">
                  <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('timer.payload', 'Payload')}</div>
                  <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">{timer.action === 'pipeline' ? t('timer.pipeline', 'Pipeline') : timer.action === 'notify' ? t('timer.notificationBody', 'Notification Body') : t('timer.promptText', 'Prompt')}</h3>
                </div>
                <p className="rounded-3xl border border-border-subtle bg-surface-2/75 p-4 text-sm leading-7 text-text-secondary whitespace-pre-wrap">{timer.action === 'pipeline' ? (pipeline?.name || timer.pipelineId || 'Unknown pipeline') : timer.prompt}</p>
              </section>
            )}
          </div>

          <section className="rounded-[28px] border border-border-subtle/55 bg-linear-to-br from-surface-1/96 via-surface-1/88 to-surface-2/70 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)] xl:p-6 h-fit">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full text-left"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('timer.executionHistory', 'Execution History')}</div>
                  <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">{t('timer.runLog', 'Run Log')}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-text-secondary/80">{t('timer.runLogHint', 'Expand the history to inspect recent executions and jump into pipeline runs when available.')}</p>
                </div>
                <span className={`inline-flex transition-transform text-text-muted ${showHistory ? 'rotate-90' : ''}`}>▶</span>
              </div>
            </button>

            {showHistory && (
              <div className="mt-4 space-y-2 max-h-112 overflow-y-auto">
                {history.length === 0 ? (
                  <p className="rounded-3xl border border-dashed border-border-subtle px-4 py-8 text-center text-xs text-text-muted">{t('timer.noExecutions', 'No executions recorded yet.')}</p>
                ) : (
                  history.map((exec) => {
                    const savedPipeline = exec.pipelineId ? agentPipelines.find((item) => item.id === exec.pipelineId) : null
                    const canOpenPipeline = Boolean(exec.pipelineId)

                    return (
                    <button
                      key={exec.id}
                      type="button"
                      onClick={() => canOpenPipeline && openPipelineExecution(exec)}
                      disabled={!canOpenPipeline}
                      className={`w-full rounded-[22px] border px-3.5 py-3 text-left text-xs transition-colors ${canOpenPipeline ? 'bg-surface-1 hover:border-accent/30 hover:bg-accent/5' : 'bg-surface-1 border-border-subtle'} border-border-subtle disabled:cursor-default`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${exec.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-text-muted">
                            <span>{formatDateTime(exec.firedAt)}</span>
                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${exec.status === 'success' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>{exec.status}</span>
                          </div>
                          <div className="mt-1 text-text-secondary">
                            {exec.action === 'notify'
                              ? <IconifyIcon name="ui-notification" size={12} />
                              : exec.action === 'pipeline'
                                ? <IconifyIcon name="skill-agent-comm" size={12} />
                                : <IconifyIcon name="agent-robot" size={12} />}
                            {exec.agentId && (() => {
                              const a = agents.find((ag) => ag.id === exec.agentId)
                              return a ? ` ${a.name}` : ''
                            })()}
                            {exec.pipelineId && (() => {
                              return savedPipeline ? ` ${savedPipeline.name}` : ''
                            })()}
                          </div>
                          {exec.error && <div className="mt-2 truncate text-[10px] text-red-400">{exec.error}</div>}
                        </div>
                        {canOpenPipeline && (
                          <span className="shrink-0 rounded-full bg-accent/10 px-2 py-1 text-[10px] font-medium text-accent">
                            {t('timer.viewPipelineRun', 'View run')}
                          </span>
                        )}
                      </div>
                    </button>
                  )})
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
