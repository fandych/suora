import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { ChatInput } from '@/components/chat/ChatInput'
import { MessageBubble } from '@/components/chat/ChatMessages'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { useAIChat } from '@/hooks/useAIChat'
import { useI18n } from '@/hooks/useI18n'
import { TIMER_BUILDER_AGENT_ID, useAppStore } from '@/store/appStore'
import type { MessageAttachment, ScheduledTask, Session } from '@/types'
import { generateId } from '@/utils/helpers'

type TimerAssistantMode = 'create' | 'edit'
type Translate = (key: string, fallback: string) => string

function ContextChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-subtle/50 bg-surface-0/72 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/45">{label}</div>
      <div className="mt-1 text-[12px] leading-5 text-text-primary">{value}</div>
    </div>
  )
}

function SuggestionButton({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-[22px] border border-border-subtle/55 bg-surface-0/64 px-4 py-3 text-left text-[12px] leading-5 text-text-secondary transition-colors hover:border-accent/22 hover:bg-accent/8 hover:text-text-primary disabled:opacity-45"
    >
      {label}
    </button>
  )
}

function describeVisibleSchedule(timer: ScheduledTask, locale: string, everyMinutesLabel: string) {
  if (timer.type === 'once') return new Date(timer.schedule).toLocaleString(locale)
  if (timer.type === 'interval') return everyMinutesLabel.replace('{minutes}', timer.schedule)
  return timer.schedule
}

function describeVisibleAction(
  timer: ScheduledTask,
  labels: {
    pipeline: string
    prompt: string
    notify: string
  },
) {
  if (timer.action === 'pipeline') return labels.pipeline
  if (timer.action === 'prompt') return labels.prompt
  return labels.notify
}

function describeAssistantTimerType(timer: ScheduledTask, t: Translate) {
  if (timer.type === 'once') return t('timer.oneTime', 'One-time')
  if (timer.type === 'interval') return t('timer.interval', 'Interval')
  return t('timer.cronLabel', 'Cron')
}

function buildContextPrompt({
  mode,
  timer,
  t,
  locale,
  everyMinutesLabel,
  actionLabels,
}: {
  mode: TimerAssistantMode
  timer?: ScheduledTask | null
  t: Translate
  locale: string
  everyMinutesLabel: string
  actionLabels: {
    pipeline: string
    prompt: string
    notify: string
  }
}) {
  const lines = [
    t('timer.assistantContextIntro', "You are operating inside Suora's Timer module as the timer assistant."),
    t('timer.assistantContextTools', 'Use timer_list, timer_add, timer_update, and timer_remove to help the user create or modify timers.'),
    t('timer.assistantContextScheduleTypes', 'Timers support type "once" with an ISO datetime, "interval" with minutes, and "cron" with a cron expression.'),
    mode === 'edit' && timer
      ? t('timer.assistantContextEditTarget', 'When the user says "this timer" or "current timer", it refers to the target timer below. Unless the user explicitly asks to create a new timer or delete it, prefer timer_update with this id.')
      : t('timer.assistantContextCreateTarget', 'The default goal in this session is to create a new timer. If the user wants to edit an existing timer, list or identify the target timer first.'),
    t('timer.assistantContextConfirm', 'Before executing an add, update, or remove action, first summarize the structured timer fields you plan to apply. The tool layer will ask for a final confirmation.'),
    '',
    `${t('timer.assistantMode', 'Mode')}: ${mode === 'edit' ? t('timer.assistantModeEdit', 'Edit existing timer') : t('timer.assistantModeCreate', 'Create new timer')}`,
  ]

  if (mode === 'edit' && timer) {
    const noneLabel = t('common.none', 'None')
    lines.push(
      `${t('timer.assistantTargetTimerId', 'Target timer id')}: ${timer.id}`,
      `${t('timer.assistantCurrentName', 'Current name')}: ${timer.name}`,
      `${t('timer.assistantCurrentType', 'Current type')}: ${describeAssistantTimerType(timer, t)}`,
      `${t('timer.assistantCurrentSchedule', 'Current schedule')}: ${describeVisibleSchedule(timer, locale, everyMinutesLabel)}`,
      `${t('timer.assistantCurrentAction', 'Current action')}: ${describeVisibleAction(timer, actionLabels)}`,
      `${t('timer.assistantCurrentPrompt', 'Current prompt/body')}: ${timer.prompt || noneLabel}`,
      `${t('timer.assistantCurrentAgentId', 'Current agentId')}: ${timer.agentId || noneLabel}`,
      `${t('timer.assistantCurrentPipelineId', 'Current pipelineId')}: ${timer.pipelineId || noneLabel}`,
      `${t('timer.assistantCurrentTimezone', 'Current timezone')}: ${timer.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}`,
      `${t('timer.assistantCurrentMissedRunPolicy', 'Current missedRunPolicy')}: ${timer.missedRunPolicy || 'skip'}`,
      `${t('timer.assistantCurrentCalendarRule', 'Current calendarRule')}: ${timer.calendarRule || 'all-days'}`,
    )
  }

  return lines.join('\n')
}

function buildSessionTitle(mode: TimerAssistantMode, timer: ScheduledTask | null | undefined, t: Translate) {
  if (mode === 'edit' && timer) {
    return `${t('timer.assistantLabel', 'Timer assistant')} · ${timer.name}`
  }
  return `${t('timer.assistantLabel', 'Timer assistant')} · ${t('timer.newTimer', 'New Timer')}`
}

export function TimerAssistantDrawer({
  mode,
  timer,
  onClose,
  onTimerMutated,
}: {
  mode: TimerAssistantMode
  timer?: ScheduledTask | null
  onClose: () => void
  onTimerMutated?: () => void
}) {
  const {
    sessions,
    addSession,
    updateSession,
    selectedModel,
    models,
  } = useAppStore()
  const { t, locale } = useI18n()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const contextKeyRef = useRef<string | null>(null)
  const processedToolCallsRef = useRef<Set<string>>(new Set())
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const { sendMessage, cancelStream, retryLastError, deleteMessage, regenerateMessage, clearMessages, isLoading: isStreaming } = useAIChat({ sessionId })
  const cancelStreamRef = useRef<() => void>(() => {})

  const contextKey = `${mode}:${timer?.id ?? 'create'}`
  const everyMinutesLabel = t('timer.assistantEveryMinutes', 'Every {minutes} minutes')
  const actionLabels = useMemo(() => ({
    pipeline: t('timer.assistantActionPipeline', 'Run pipeline'),
    prompt: t('timer.assistantActionPrompt', 'Run agent prompt'),
    notify: t('timer.assistantActionNotify', 'Desktop notification'),
  }), [t])
  const contextPrompt = useMemo(
    () => buildContextPrompt({ mode, timer, t, locale, everyMinutesLabel, actionLabels }),
    [actionLabels, everyMinutesLabel, locale, mode, t, timer],
  )

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    cancelStreamRef.current = cancelStream
  }, [cancelStream])

  useEffect(() => {
    const session: Session = {
      id: generateId('session'),
      title: buildSessionTitle(mode, timer, t),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      surface: 'timer-assistant',
      agentId: TIMER_BUILDER_AGENT_ID,
      modelId: selectedModel?.id,
      messages: [],
      contextPrompt,
    }

    contextKeyRef.current = contextKey
    addSession(session)
    setSessionId(session.id)

    return () => {
      cancelStreamRef.current()
      const currentSessionId = sessionIdRef.current
      if (!currentSessionId) return
      queueMicrotask(() => {
        const store = useAppStore.getState()
        if (store.sessions.some((item) => item.id === currentSessionId)) {
          store.removeSession(currentSessionId)
        }
      })
    }
  }, [addSession])

  useEffect(() => {
    if (!sessionId) return
    const previousKey = contextKeyRef.current
    const contextChanged = Boolean(previousKey && previousKey !== contextKey)
    contextKeyRef.current = contextKey
    if (contextChanged) {
      cancelStream()
      processedToolCallsRef.current.clear()
    }

    updateSession(sessionId, {
      title: buildSessionTitle(mode, timer, t),
      agentId: TIMER_BUILDER_AGENT_ID,
      modelId: selectedModel?.id,
      contextPrompt,
      ...(contextChanged ? { messages: [] } : {}),
    })
  }, [cancelStream, contextKey, contextPrompt, mode, selectedModel?.id, sessionId, t, timer, updateSession])

  const session = sessions.find((item) => item.id === sessionId) ?? null
  const messages = session?.messages ?? []
  const sessionModel = session?.modelId
    ? models.find((model) => model.id === session.modelId) ?? null
    : selectedModel

  const selectableModels = useMemo(() => models.filter((model) => model.enabled), [models])

  const handleSessionModelChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    if (!sessionId) return
    const nextModelId = event.target.value || undefined
    updateSession(sessionId, { modelId: nextModelId })
  }, [sessionId, updateSession])

  const starterPrompts = useMemo(() => {
    if (mode === 'edit') {
      return [
        t('timer.assistantPromptEditWeekday', 'Move this timer to weekdays at 8:30 AM'),
        t('timer.assistantPromptEditPause', 'Pause this timer'),
        t('timer.assistantPromptEditBody', 'Change the reminder text to "Remember to submit the daily report"'),
      ]
    }

    return [
      t('timer.assistantPromptCreateDaily', 'Create a timer to remind me every day at 9 AM to read the daily report'),
      t('timer.assistantPromptCreatePipeline', 'Run the Morning Run pipeline every Monday at 8:30 AM'),
      t('timer.assistantPromptCreateWeekday', 'Remind me on weekdays at 6 PM to write the daily summary'),
    ]
  }, [mode, t])

  const handleSend = useCallback((input: string, attachments?: MessageAttachment[]) => {
    if (!sessionId) return
    void sendMessage(input, attachments)
  }, [sendMessage, sessionId])

  useEffect(() => {
    const container = messagesScrollRef.current
    if (!container) return
    if (typeof container.scrollTo === 'function') {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
      return
    }
    container.scrollTop = container.scrollHeight
  }, [messages])

  useEffect(() => {
    if (!onTimerMutated) return

    let hasMutation = false
    for (const message of messages) {
      for (const toolCall of message.toolCalls ?? []) {
        if (!['timer_add', 'timer_update', 'timer_remove'].includes(toolCall.toolName)) continue
        if (toolCall.status !== 'completed' || processedToolCallsRef.current.has(toolCall.id)) continue
        processedToolCallsRef.current.add(toolCall.id)
        hasMutation = true
      }
    }

    if (hasMutation) onTimerMutated()
  }, [messages, onTimerMutated])

  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-40 flex w-full justify-end pl-16">
      <section
        role="dialog"
        aria-label={t('timer.assistantLabel', 'Timer assistant')}
        className="pointer-events-auto flex h-full w-full max-w-136 flex-col border-l border-border-subtle/55 bg-surface-0/94 shadow-[-24px_0_60px_rgba(15,23,42,0.22)] backdrop-blur-xl"
      >
        <div className="border-b border-border-subtle/55 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('timer.assistantSection', 'Side chat')}</div>
              <h2 className="mt-1 text-[20px] font-semibold text-text-primary">
                {mode === 'edit' ? t('timer.assistantTitleEdit', 'AI Edit Timer') : t('timer.assistantTitleCreate', 'AI Create Timer')}
              </h2>
              <p className="mt-1 text-[12px] leading-5 text-text-secondary/78">
                {t('timer.assistantDescription', 'Create or modify timers in natural language. A confirmation step is required before changes execute.')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearMessages}
                  disabled={isStreaming}
                  className="rounded-2xl border border-border-subtle/55 bg-surface-0/70 px-3 py-2 text-[11px] font-semibold text-text-secondary transition-colors hover:border-danger/18 hover:bg-danger/8 hover:text-danger disabled:opacity-45"
                >
                  {t('timer.assistantClear', 'Clear')}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border-subtle/55 bg-surface-0/70 text-text-muted transition-colors hover:border-accent/18 hover:bg-accent/10 hover:text-accent"
                aria-label={t('timer.assistantClose', 'Close timer assistant')}
                title={t('common.close', 'Close')}
              >
                <IconifyIcon name="ui-close" size={16} color="currentColor" />
              </button>
            </div>
          </div>
        </div>

        <div className="border-b border-border-subtle/55 px-5 py-4">
          <div className="mb-3">
            <label htmlFor="timer-assistant-model" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/45">
              {t('timer.assistantModelPicker', 'Assistant model')}
            </label>
            <select
              id="timer-assistant-model"
              aria-label={t('timer.assistantModelPicker', 'Assistant model')}
              value={session?.modelId ?? ''}
              onChange={handleSessionModelChange}
              disabled={isStreaming || selectableModels.length === 0}
              className="mt-2 w-full rounded-2xl border border-border-subtle/55 bg-surface-0/72 px-3 py-2 text-[12px] text-text-primary outline-none transition-colors focus:border-accent/30"
            >
              <option value="">{t('chat.selectModel', '-- Select Model --')}</option>
              {selectableModels.map((model) => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ContextChip label={t('timer.assistantMode', 'Mode')} value={mode === 'edit' ? t('timer.assistantModeEdit', 'Edit existing timer') : t('timer.assistantModeCreate', 'Create new timer')} />
            <ContextChip label={t('timer.assistantModel', 'Model')} value={sessionModel?.name || t('timer.assistantNoModelSelected', 'No model selected')} />
            <ContextChip label={t('timer.assistantConfirmation', 'Confirmation')} value={t('timer.assistantConfirmationHint', 'timer_add / timer_update / timer_remove will ask for confirmation')} />
            <ContextChip label={t('timer.assistantTarget', 'Target')} value={timer ? `${timer.name} (${timer.id})` : t('timer.assistantTargetDraft', 'New timer draft')} />
            {timer && <ContextChip label={t('timer.assistantCurrentSchedule', 'Current schedule')} value={describeVisibleSchedule(timer, locale, everyMinutesLabel)} />}
            {timer && <ContextChip label={t('timer.assistantCurrentAction', 'Current action')} value={describeVisibleAction(timer, actionLabels)} />}
          </div>
        </div>

        <div ref={messagesScrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-[26px] border border-border-subtle/55 bg-linear-to-br from-surface-1/94 via-surface-1/86 to-surface-2/72 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <IconifyIcon name="ui-sparkles" size={22} color="currentColor" />
                </div>
                <h3 className="mt-4 text-[18px] font-semibold text-text-primary">
                  {mode === 'edit'
                    ? t('timer.assistantHeroEdit', 'Tell me how you want to change this timer')
                    : t('timer.assistantHeroCreate', 'Describe the timer you want to create')}
                </h3>
                <p className="mt-2 text-[12px] leading-6 text-text-secondary/78">
                  {mode === 'edit'
                    ? t('timer.assistantHeroEditHint', 'You can change the schedule, pause it, switch actions, or rewrite the reminder content.')
                    : t('timer.assistantHeroCreateHint', 'Describe the cadence, time, message, or ask it to run a saved pipeline.')}
                </p>
              </div>

              <div className="space-y-2">
                {starterPrompts.map((prompt) => (
                  <SuggestionButton
                    key={prompt}
                    label={prompt}
                    disabled={isStreaming || !sessionModel}
                    onClick={() => handleSend(prompt)}
                  />
                ))}
              </div>

              {!sessionModel && (
                <div className="rounded-2xl border border-warning/18 bg-warning/10 px-4 py-3 text-[12px] leading-5 text-warning">
                  {t('timer.assistantNoModel', 'No active model is available yet. Select a model in Models before using the timer assistant.')}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onRetry={message.isError ? () => retryLastError() : undefined}
                  onDelete={() => deleteMessage(message.id)}
                  onRegenerate={message.role === 'assistant' && !message.isStreaming ? () => regenerateMessage(message.id) : undefined}
                />
              ))}

            </div>
          )}
        </div>

        <div className="border-t border-border-subtle/55 px-5 py-4">
          <ChatInput
            onSend={handleSend}
            disabled={isStreaming || !sessionModel}
            isStreaming={isStreaming}
            onStop={cancelStream}
            noModel={!sessionModel}
          />
        </div>
      </section>
    </div>
  )
}