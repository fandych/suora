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
        setCronError(t('timer.invalidCron', 'Invalid cron expression'))
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
      aria-label={t('timer.scheduleDateTime', 'Schedule date and time')}
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
        placeholder={t('timer.intervalPlaceholder', '30')}
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

  const scheduleSummary = form.type === 'once'
    ? (form.schedule ? new Date(form.schedule).toLocaleString() : t('timer.notScheduled', 'Not scheduled'))
    : form.type === 'interval'
      ? t('timer.everyMinutes', 'Every {minutes} minutes').replace('{minutes}', form.schedule || '0')
      : (form.schedule || t('timer.cronPending', 'Cron pending'))

  const actionSummary = form.action === 'pipeline'
    ? t('agents.pipeline', 'Pipeline')
    : form.action === 'prompt'
      ? t('timer.agentPrompt', 'Agent Prompt')
      : t('timer.notify', 'Notify')

  return (
    <div className="animate-fade-in px-5 py-6 xl:px-8 xl:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-4xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/94 to-surface-2/72 p-6 shadow-[0_24px_70px_rgba(var(--t-accent-rgb),0.08)] xl:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-18 w-18 items-center justify-center rounded-[26px] border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.12)]">
                <IconifyIcon name={form.type === 'once' ? 'ui-timer-once' : 'ui-repeat'} size={30} color="currentColor" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{initial ? t('timer.editTimer', 'Edit Timer') : t('timer.newTimer', 'New Timer')}</div>
                <h2 className="mt-2 text-[30px] font-semibold tracking-tight text-text-primary">{form.name.trim() || t('timer.untitledTimer', 'Untitled Timer')}</h2>
                <p className="mt-2 max-w-3xl text-[14px] leading-7 text-text-secondary/82">{t('timer.formHeroHint', 'Set the cadence, choose the destination, and keep the payload clear enough that the timer can run unattended.')}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-border-subtle/45 bg-surface-0/78 px-3 py-1 text-[11px] text-text-secondary">{scheduleSummary}</span>
                  <span className="rounded-full border border-accent/18 bg-accent/10 px-3 py-1 text-[11px] text-accent">{actionSummary}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:w-[24rem] xl:grid-cols-1">
              <div className="rounded-[22px] border border-border-subtle/55 bg-surface-0/60 p-4">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('timer.type', 'Type')}</div>
                <div className="mt-2 text-lg font-semibold text-text-primary">{form.type === 'once' ? t('timer.oneTime', 'One-time') : form.type === 'interval' ? t('timer.repeating', 'Repeating') : 'Cron'}</div>
              </div>
              <div className="rounded-[22px] border border-border-subtle/55 bg-surface-0/60 p-4">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('timer.action', 'Action')}</div>
                <div className="mt-2 text-lg font-semibold text-text-primary">{actionSummary}</div>
              </div>
              <div className="rounded-[22px] border border-border-subtle/55 bg-surface-0/60 p-4">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('common.status', 'Status')}</div>
                <div className="mt-2 text-lg font-semibold text-text-primary">{initial ? t('common.editing', 'Editing') : t('common.draft', 'Draft')}</div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.95fr)]">
          <section className="rounded-[28px] border border-border-subtle/55 bg-linear-to-br from-surface-1/96 via-surface-1/88 to-surface-2/70 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)] xl:p-6">
            <div className="mb-5">
              <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('timer.schedule', 'Schedule')}</div>
              <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">{t('timer.scheduleSetup', 'Schedule Setup')}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-text-secondary/80">{t('timer.scheduleSetupHint', 'Choose how often the timer fires, then confirm the next expected run before saving it.')}</p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wide block mb-2">{t('timer.name', 'Name')}</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-2xl bg-surface-2/75 border border-border-subtle text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t('timer.reminderName', 'Reminder name')}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wide block mb-2">{t('timer.type', 'Type')}</label>
                <div className="flex flex-wrap gap-2">
                  {(['once', 'interval', 'cron'] as TimerType[]).map((tt) => (
                    <button
                      key={tt}
                      type="button"
                      className={`px-3.5 py-2 rounded-2xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${form.type === tt ? 'bg-accent/20 text-accent shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.14)]' : 'bg-surface-2 text-text-muted hover:text-text-secondary'}`}
                      onClick={() => setForm({ ...form, type: tt, schedule: '' })}
                    >
                      {tt === 'once' ? <><IconifyIcon name="ui-timer-once" size={14} /> {t('timer.oneTime', 'One-time')}</> : tt === 'interval' ? <><IconifyIcon name="ui-repeat" size={14} /> {t('timer.repeating', 'Repeating')}</> : <><IconifyIcon name="ui-clock" size={14} /> Cron</>}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wide block mb-2">
                  {form.type === 'once' ? t('timer.fireAt', 'Fire at') : t('timer.repeatEvery', 'Repeat every')}
                </label>
                {scheduleInput}
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-border-subtle/55 bg-linear-to-br from-surface-1/96 via-surface-1/88 to-surface-2/70 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)] xl:p-6">
            <div className="mb-5">
              <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('timer.action', 'Action')}</div>
              <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">{t('timer.deliveryAndPayload', 'Delivery & Payload')}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-text-secondary/80">{t('timer.deliveryAndPayloadHint', 'Choose what happens when the timer fires and supply the prompt, notification copy, or linked pipeline.')}</p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wide block mb-2">{t('timer.action', 'Action')}</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`px-3.5 py-2 rounded-2xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${form.action === 'notify' ? 'bg-accent/20 text-accent shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.14)]' : 'bg-surface-2 text-text-muted hover:text-text-secondary'}`}
                    onClick={() => setForm({ ...form, action: 'notify' })}
                  >
                    <IconifyIcon name="ui-notification" size={14} /> {t('timer.notify', 'Notify')}
                  </button>
                  <button
                    type="button"
                    className={`px-3.5 py-2 rounded-2xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${form.action === 'prompt' ? 'bg-accent/20 text-accent shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.14)]' : 'bg-surface-2 text-text-muted hover:text-text-secondary'}`}
                    onClick={() => setForm({ ...form, action: 'prompt' })}
                  >
                    <IconifyIcon name="agent-robot" size={14} /> {t('timer.agentPrompt', 'Agent Prompt')}
                  </button>
                  <button
                    type="button"
                    className={`px-3.5 py-2 rounded-2xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${form.action === 'pipeline' ? 'bg-accent/20 text-accent shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.14)]' : 'bg-surface-2 text-text-muted hover:text-text-secondary'}`}
                    onClick={() => setForm({ ...form, action: 'pipeline' })}
                  >
                    <IconifyIcon name="skill-agent-comm" size={14} /> {t('timer.pipeline', 'Pipeline')}
                  </button>
                </div>
              </div>

              {form.action === 'prompt' && (
                <div>
                  <label className="text-[11px] text-text-muted uppercase tracking-wide block mb-2">{t('chat.agent', 'Agent')}</label>
                  <select
                    aria-label={t('chat.agent', 'Agent')}
                    value={form.agentId}
                    onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-surface-2/75 border border-border-subtle text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="">{t('timer.selectAgent', '-- Select Agent --')}</option>
                    {agents.filter((a) => a.enabled).map((a) => (
                      <option key={a.id} value={a.id}>{ICON_DATA[a.avatar || ''] ? '●' : (a.avatar || '●')} {a.name}</option>
                    ))}
                  </select>
                  {!form.agentId && (
                    <p className="text-[10px] text-text-muted mt-2">{t('timer.agentHint', 'Select an agent to execute the prompt, or leave empty to use the default assistant.')}</p>
                  )}
                </div>
              )}

              {form.action === 'pipeline' && (
                <div>
                  <label className="text-[11px] text-text-muted uppercase tracking-wide block mb-2">{t('agents.pipeline', 'Pipeline')}</label>
                  <select
                    aria-label={t('agents.pipeline', 'Pipeline')}
                    value={form.pipelineId}
                    onChange={(e) => setForm({ ...form, pipelineId: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-surface-2/75 border border-border-subtle text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="">{t('timer.selectPipeline', '-- Select Pipeline --')}</option>
                    {agentPipelines.map((pipeline) => (
                      <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>
                    ))}
                  </select>
                  {!form.pipelineId && (
                    <p className="text-[10px] text-text-muted mt-2">{t('timer.pipelineHint', 'Only saved pipelines can be scheduled by timers.')}</p>
                  )}
                </div>
              )}

              {form.action !== 'pipeline' && (
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wide block mb-2">
                  {form.action === 'notify' ? t('timer.notificationBody', 'Notification Body') : t('timer.promptText', 'Prompt Text')}
                </label>
                <textarea
                  className="w-full px-4 py-3 rounded-[24px] bg-surface-2/75 border border-border-subtle text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
                  rows={5}
                  value={form.prompt}
                  onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                  placeholder={form.action === 'notify' ? t('timer.reminderText', 'Reminder text...') : t('timer.whatShouldAgentDo', 'What should the agent do?')}
                />
              </div>
              )}

              <div className="rounded-[24px] border border-border-subtle/45 bg-surface-0/55 p-4">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{t('timer.review', 'Review')}</div>
                <div className="mt-2 text-[13px] leading-6 text-text-secondary/82">
                  {t('timer.reviewHint', 'Timers should be specific enough that the action can run without ambiguity. If you are scheduling a pipeline, confirm it has already been saved.')}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            className="px-5 py-3 rounded-2xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
            disabled={!form.name.trim() || !form.schedule || (form.type === 'cron' && !!cronError) || (form.action === 'pipeline' && !form.pipelineId)}
            onClick={() => onSave(form)}
          >
            {initial ? t('common.saveChanges', 'Save Changes') : t('timer.createTimer', 'Create Timer')}
          </button>
          <button
            type="button"
            className="px-5 py-3 rounded-2xl bg-surface-2 text-text-muted text-sm font-medium hover:text-text-secondary transition-colors"
            onClick={onCancel}
          >
            {t('common.cancel', 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
