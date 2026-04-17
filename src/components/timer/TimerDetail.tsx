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

export function TimerDetail({ timer, onEdit, onDelete, onToggle }: {
  timer: ScheduledTask
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
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
    <div className="flex-1 flex flex-col p-6 animate-fade-in">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{timer.name}</h2>
          <p className="text-xs text-text-muted mt-1">
            <span className="inline-flex items-center gap-1">
              {timer.type === 'once' ? <><IconifyIcon name="ui-timer-once" size={12} /> {t('timer.oneTime', 'One-time')}</> : <><IconifyIcon name="ui-repeat" size={12} /> {t('timer.repeating', 'Repeating')}</>}
              {' · '}
              {timer.action === 'notify'
                ? <><IconifyIcon name="ui-notification" size={12} /> {t('timer.notification', 'Notification')}</>
                : timer.action === 'pipeline'
                  ? <><IconifyIcon name="skill-agent-comm" size={12} /> {t('timer.pipeline', 'Pipeline')}</>
                  : <><IconifyIcon name="agent-robot" size={12} /> {t('timer.agentPrompt', 'Agent Prompt')}</>}
            </span>
            {agent && <span className="ml-1 inline-flex items-center gap-0.5">→ <AgentAvatar avatar={agent.avatar} size={12} /> {agent.name}</span>}
            {pipeline && <span className="ml-1 inline-flex items-center gap-0.5">→ <IconifyIcon name="skill-agent-comm" size={12} /> {pipeline.name}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${timer.enabled ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25' : 'bg-surface-2 text-text-muted hover:text-text-secondary'}`}
          >
            {timer.enabled ? t('timer.enabled', '● Enabled') : t('timer.disabled', '○ Disabled')}
          </button>
          <button
            onClick={onEdit}
            className="px-3 py-1.5 rounded-lg bg-surface-2 text-text-muted text-xs font-medium hover:text-text-secondary transition-colors"
          >
            {t('common.edit', 'Edit')}
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
          >
            {t('common.delete', 'Delete')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <InfoCard label={t('timer.schedule', 'Schedule')} value={timer.type === 'once' ? formatDateTime(new Date(timer.schedule).getTime()) : timer.type === 'cron' ? timer.schedule : `Every ${timer.schedule} minutes`} />
        <InfoCard label={t('timer.nextRun', 'Next Run')} value={timer.nextRun ? `${formatDateTime(timer.nextRun)} (${formatRelative(timer.nextRun)})` : t('timer.notScheduled', 'Not scheduled')} />
        <InfoCard label={t('timer.lastRun', 'Last Run')} value={timer.lastRun ? formatDateTime(timer.lastRun) : t('timer.never', 'Never')} />
        <InfoCard label={t('timer.created', 'Created')} value={formatDateTime(timer.createdAt)} />
      </div>

      {(timer.prompt || pipeline) && (
        <div className="mt-6">
          <span className="text-[11px] text-text-muted uppercase tracking-wide">{timer.action === 'pipeline' ? t('timer.pipeline', 'Pipeline') : timer.action === 'notify' ? t('timer.notificationBody', 'Notification Body') : t('timer.promptText', 'Prompt')}</span>
          <p className="mt-1 text-xs text-text-secondary bg-surface-2 rounded-lg p-3 border border-border-subtle whitespace-pre-wrap">{timer.action === 'pipeline' ? (pipeline?.name || timer.pipelineId || 'Unknown pipeline') : timer.prompt}</p>
        </div>
      )}

      {/* Execution History */}
      <div className="mt-6">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-[11px] text-text-muted uppercase tracking-wide hover:text-text-secondary transition-colors flex items-center gap-1"
        >
          <span className={`inline-block transition-transform ${showHistory ? 'rotate-90' : ''}`}>▶</span>
          {t('timer.executionHistory', 'Execution History')}
        </button>
        {showHistory && (
          <div className="mt-2 space-y-1.5 max-h-60 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center">{t('timer.noExecutions', 'No executions recorded yet.')}</p>
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
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${canOpenPipeline ? 'bg-surface-1 hover:border-accent/30 hover:bg-accent/5' : 'bg-surface-1 border-border-subtle'} border-border-subtle disabled:cursor-default`}
                >
                  <div className="flex items-center gap-3">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${exec.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className="text-text-muted">{formatDateTime(exec.firedAt)}</span>
                  <span className="min-w-0 flex-1 text-text-secondary">
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
                  </span>
                  {exec.sessionId && (
                    <span className="text-accent text-[10px]">session created</span>
                  )}
                  {canOpenPipeline && (
                    <span className="shrink-0 rounded-full bg-accent/10 px-2 py-1 text-[10px] font-medium text-accent">
                      {t('timer.viewPipelineRun', 'View run')}
                    </span>
                  )}
                  {exec.error && (
                    <span className="max-w-40 truncate text-red-400 text-[10px]">{exec.error}</span>
                  )}
                  </div>
                </button>
              )})
            )}
          </div>
        )}
      </div>
    </div>
  )
}
