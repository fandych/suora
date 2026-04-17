import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { ICON_DATA, IconifyIcon } from '@/components/icons/IconifyIcons'
import { useI18n } from '@/hooks/useI18n'
import type { ScheduledTask, TimerType } from '@/types'
import { toLocalDatetimeValue, getNextCronExecutions, type TimerFormData } from './timerHelpers'

export function TimerForm({ initial, onSave, onCancel }: {
  initial?: ScheduledTask
  onSave: (data: TimerFormData) => void
  onCancel: () => void
}) {
  const { agents, agentPipelines } = useAppStore()
  const { t } = useI18n()
  const [form, setForm] = useState<TimerFormData>({
    name: initial?.name ?? '',
    type: initial?.type ?? 'once',
    schedule: initial?.schedule ?? '',
    action: initial?.action ?? 'notify',
    prompt: initial?.prompt ?? '',
    agentId: initial?.agentId ?? '',
    pipelineId: initial?.pipelineId ?? '',
  })

  const [cronPreview, setCronPreview] = useState<Date[]>([])
  const [cronError, setCronError] = useState('')

  // Update cron preview when schedule changes
  useEffect(() => {
    if (form.type === 'cron' && form.schedule) {
      const nextExecs = getNextCronExecutions(form.schedule)
      if (nextExecs.length > 0) {
        setCronPreview(nextExecs)
        setCronError('')
      } else {
        setCronPreview([])
        setCronError('Invalid cron expression')
      }
    } else {
      setCronPreview([])
      setCronError('')
    }
  }, [form.type, form.schedule])

  // For 'once' type, show a datetime-local input. Pre-fill with schedule if editing.
  const scheduleInput = form.type === 'once' ? (
    <input
      type="datetime-local"
      aria-label="Schedule date and time"
      className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border-subtle text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
      value={form.schedule ? toLocalDatetimeValue(form.schedule) : ''}
      onChange={(e) => {
        const d = new Date(e.target.value)
        if (!isNaN(d.getTime())) {
          setForm({ ...form, schedule: d.toISOString() })
        } else {
          setForm({ ...form, schedule: '' })
        }
      }}
    />
  ) : form.type === 'interval' ? (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="1"
        className="w-20 px-3 py-2 rounded-lg bg-surface-2 border border-border-subtle text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
        value={form.schedule}
        onChange={(e) => setForm({ ...form, schedule: e.target.value })}
        placeholder="30"
      />
      <span className="text-xs text-text-muted">{t('timer.minutes', 'minutes')}</span>
    </div>
  ) : (
    <div className="space-y-2">
      <input
        type="text"
        className={`w-full px-3 py-2 rounded-lg bg-surface-2 border ${cronError ? 'border-error' : 'border-border-subtle'} text-text-primary text-xs font-mono focus:outline-none focus:ring-1 focus:ring-accent`}
        value={form.schedule}
        onChange={(e) => setForm({ ...form, schedule: e.target.value })}
        placeholder="0 9 * * 1-5"
      />
      <p className="text-[10px] text-text-muted">
        Format: <code className="px-1 py-0.5 bg-surface-3 rounded">{t('timer.cronFormat', 'minute hour day month weekday')}</code>
      </p>
      {cronError && (
        <p className="text-[10px] text-error">{cronError}</p>
      )}
      {cronPreview.length > 0 && (
        <div className="text-[10px] text-text-muted space-y-0.5 bg-surface-3/50 p-2 rounded-lg">
          <p className="font-medium text-text-secondary">{t('timer.nextExecutions', 'Next 5 executions:')}</p>
          {cronPreview.map((date, i) => (
            <p key={i}>• {date.toLocaleString()}</p>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <h3 className="text-sm font-semibold text-text-primary">{initial ? t('timer.editTimer', 'Edit Timer') : t('timer.newTimer', 'New Timer')}</h3>

      <div>
        <label className="text-[11px] text-text-muted uppercase tracking-wide block mb-1">{t('timer.name', 'Name')}</label>
        <input
          type="text"
          className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border-subtle text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder={t('timer.reminderName', 'Reminder name')}
          autoFocus
        />
      </div>

      <div>
        <label className="text-[11px] text-text-muted uppercase tracking-wide block mb-1">{t('timer.type', 'Type')}</label>
        <div className="flex gap-2">
          {(['once', 'interval', 'cron'] as TimerType[]).map((tt) => (
            <button
              key={tt}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${form.type === tt ? 'bg-accent/20 text-accent' : 'bg-surface-2 text-text-muted hover:text-text-secondary'}`}
              onClick={() => setForm({ ...form, type: tt, schedule: '' })}
            >
              {tt === 'once' ? <><IconifyIcon name="ui-timer-once" size={14} /> {t('timer.oneTime', 'One-time')}</> : <><IconifyIcon name="ui-repeat" size={14} /> {t('timer.repeating', 'Repeating')}</>}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[11px] text-text-muted uppercase tracking-wide block mb-1">
          {form.type === 'once' ? t('timer.fireAt', 'Fire at') : t('timer.repeatEvery', 'Repeat every')}
        </label>
        {scheduleInput}
      </div>

      <div>
        <label className="text-[11px] text-text-muted uppercase tracking-wide block mb-1">{t('timer.action', 'Action')}</label>
        <div className="flex gap-2">
          <button
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${form.action === 'notify' ? 'bg-accent/20 text-accent' : 'bg-surface-2 text-text-muted hover:text-text-secondary'}`}
            onClick={() => setForm({ ...form, action: 'notify' })}
          >
            <IconifyIcon name="ui-notification" size={14} /> {t('timer.notify', 'Notify')}
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${form.action === 'prompt' ? 'bg-accent/20 text-accent' : 'bg-surface-2 text-text-muted hover:text-text-secondary'}`}
            onClick={() => setForm({ ...form, action: 'prompt' })}
          >
            <IconifyIcon name="agent-robot" size={14} /> {t('timer.agentPrompt', 'Agent Prompt')}
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${form.action === 'pipeline' ? 'bg-accent/20 text-accent' : 'bg-surface-2 text-text-muted hover:text-text-secondary'}`}
            onClick={() => setForm({ ...form, action: 'pipeline' })}
          >
            <IconifyIcon name="skill-agent-comm" size={14} /> {t('timer.pipeline', 'Pipeline')}
          </button>
        </div>
      </div>

      {form.action === 'prompt' && (
        <div>
          <label className="text-[11px] text-text-muted uppercase tracking-wide block mb-1">{t('common.agent', 'Agent')}</label>
          <select
            aria-label="Agent"
            value={form.agentId}
            onChange={(e) => setForm({ ...form, agentId: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border-subtle text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">{t('timer.selectAgent', '-- Select Agent --')}</option>
            {agents.filter((a) => a.enabled).map((a) => (
              <option key={a.id} value={a.id}>{ICON_DATA[a.avatar || ''] ? '●' : (a.avatar || '●')} {a.name}</option>
            ))}
          </select>
          {!form.agentId && (
            <p className="text-[10px] text-text-muted mt-1">{t('timer.agentHint', 'Select an agent to execute the prompt, or leave empty to use the default assistant.')}</p>
          )}
        </div>
      )}

      {form.action === 'pipeline' && (
        <div>
          <label className="text-[11px] text-text-muted uppercase tracking-wide block mb-1">{t('agents.pipeline', 'Pipeline')}</label>
          <select
            aria-label="Pipeline"
            value={form.pipelineId}
            onChange={(e) => setForm({ ...form, pipelineId: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border-subtle text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">{t('timer.selectPipeline', '-- Select Pipeline --')}</option>
            {agentPipelines.map((pipeline) => (
              <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>
            ))}
          </select>
          {!form.pipelineId && (
            <p className="text-[10px] text-text-muted mt-1">{t('timer.pipelineHint', 'Only saved pipelines can be scheduled by timers.')}</p>
          )}
        </div>
      )}

      {form.action !== 'pipeline' && (
      <div>
        <label className="text-[11px] text-text-muted uppercase tracking-wide block mb-1">
          {form.action === 'notify' ? t('timer.notificationBody', 'Notification Body') : t('timer.promptText', 'Prompt Text')}
        </label>
        <textarea
          className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border-subtle text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent resize-none"
          rows={3}
          value={form.prompt}
          onChange={(e) => setForm({ ...form, prompt: e.target.value })}
          placeholder={form.action === 'notify' ? t('timer.reminderText', 'Reminder text...') : t('timer.whatShouldAgentDo', 'What should the agent do?')}
        />
      </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          className="flex-1 px-4 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
          disabled={!form.name.trim() || !form.schedule || (form.type === 'cron' && !!cronError) || (form.action === 'pipeline' && !form.pipelineId)}
          onClick={() => onSave(form)}
        >
          {initial ? t('common.saveChanges', 'Save Changes') : t('timer.createTimer', 'Create Timer')}
        </button>
        <button
          className="px-4 py-2 rounded-lg bg-surface-2 text-text-muted text-xs font-medium hover:text-text-secondary transition-colors"
          onClick={onCancel}
        >
          {t('common.cancel', 'Cancel')}
        </button>
      </div>
    </div>
  )
}
