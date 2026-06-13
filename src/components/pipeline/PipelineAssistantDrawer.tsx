import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { ChatInput } from '@/components/chat/ChatInput'
import { MessageBubble } from '@/components/chat/ChatMessages'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { useAIChat } from '@/hooks/useAIChat'
import { useI18n } from '@/hooks/useI18n'
import { PIPELINE_BUILDER_AGENT_ID, useAppStore } from '@/store/appStore'
import type { AgentPipeline, MessageAttachment, Session } from '@/types'
import { generateId } from '@/utils/helpers'

type PipelineAssistantMode = 'create' | 'edit'
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

function truncateValue(value: string, maxLength = 160): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}...`
}

function summarizeVariables(pipeline: AgentPipeline, t: Translate): string {
  if (!pipeline.variables || pipeline.variables.length === 0) {
    return t('common.none', 'None')
  }

  return pipeline.variables
    .map((variable) => {
      const label = variable.label?.trim()
      const defaultValue = variable.defaultValue?.trim()
      return `${variable.name}${label ? ` (${label})` : ''}${defaultValue ? `=${defaultValue}` : ''}`
    })
    .join(', ')
}

function summarizeBudget(pipeline: AgentPipeline, t: Translate): string {
  if (!pipeline.budget) return t('common.none', 'None')

  const entries = [
    pipeline.budget.maxTotalDurationMs ? `${t('agents.pipelineBudgetMaxDuration', 'Max duration (ms)')}: ${pipeline.budget.maxTotalDurationMs}` : null,
    pipeline.budget.maxTotalTokens ? `${t('agents.pipelineBudgetMaxTokens', 'Max total tokens')}: ${pipeline.budget.maxTotalTokens}` : null,
    pipeline.budget.maxStepCount ? `${t('agents.pipelineBudgetMaxSteps', 'Max steps')}: ${pipeline.budget.maxStepCount}` : null,
  ].filter(Boolean)

  return entries.length > 0 ? entries.join(' · ') : t('common.none', 'None')
}

function buildContextPrompt({
  mode,
  pipeline,
  t,
  enabledAgentSummary,
}: {
  mode: PipelineAssistantMode
  pipeline?: AgentPipeline | null
  t: Translate
  enabledAgentSummary: string
}) {
  const lines = [
    t('agents.pipelineAssistantContextIntro', "You are operating inside Suora's Pipeline module as the pipeline assistant."),
    t('agents.pipelineAssistantContextTools', 'Use pipeline_list, pipeline_add, pipeline_update, and pipeline_remove to help the user create or modify saved pipelines.'),
    mode === 'edit' && pipeline
      ? t('agents.pipelineAssistantContextEditTarget', 'When the user says "this pipeline" or "current pipeline", it refers to the target pipeline below. Unless the user explicitly asks to create a new pipeline or delete it, prefer pipeline_update with this id.')
      : t('agents.pipelineAssistantContextCreateTarget', 'The default goal in this session is to create a new saved pipeline. If the user wants to edit an existing pipeline, list or identify the target pipeline first.'),
    t('agents.pipelineAssistantContextConfirm', 'Before executing an add, update, or remove action, first summarize the structured pipeline fields you plan to apply. The tool layer will ask for a final confirmation.'),
    `${t('agents.pipelineAssistantAgents', 'Available agents')}: ${enabledAgentSummary}`,
    `${t('timer.assistantMode', 'Mode')}: ${mode === 'edit' ? t('agents.pipelineAssistantModeEdit', 'Edit saved pipeline') : t('agents.pipelineAssistantModeCreate', 'Create saved pipeline')}`,
  ]

  if (mode === 'edit' && pipeline) {
    const noneLabel = t('common.none', 'None')
    lines.push(
      `${t('agents.pipelineAssistantTargetPipelineId', 'Target pipeline id')}: ${pipeline.id}`,
      `${t('agents.pipelineAssistantCurrentName', 'Current name')}: ${pipeline.name}`,
      `${t('agents.pipelineAssistantCurrentDescription', 'Current description')}: ${pipeline.description || noneLabel}`,
      `${t('agents.pipelineAssistantCurrentVariables', 'Current variables')}: ${summarizeVariables(pipeline, t)}`,
      `${t('agents.pipelineAssistantCurrentBudget', 'Current budget')}: ${summarizeBudget(pipeline, t)}`,
      `${t('agents.pipelineAssistantCurrentSteps', 'Current steps')}: ${pipeline.steps.length}`,
    )

    pipeline.steps.forEach((step, index) => {
      const stepName = step.name?.trim() || `${t('agents.pipelineStepFallback', 'Step {number}').replace('{number}', String(index + 1))}`
      lines.push(
        `Step ${index + 1}: name=${stepName}; agentId=${step.agentId}; task=${truncateValue(step.task, 180)}`,
      )
    })
  }

  return lines.join('\n')
}

function buildSessionTitle(mode: PipelineAssistantMode, pipeline: AgentPipeline | null | undefined, t: Translate) {
  if (mode === 'edit' && pipeline) {
    return `${t('agents.pipelineAssistantLabel', 'Pipeline assistant')} · ${pipeline.name}`
  }
  return `${t('agents.pipelineAssistantLabel', 'Pipeline assistant')} · ${t('agents.pipelineDraft', 'Draft pipeline')}`
}

export function PipelineAssistantDrawer({
  mode,
  pipeline,
  onClose,
  onPipelineMutated,
}: {
  mode: PipelineAssistantMode
  pipeline?: AgentPipeline | null
  onClose: () => void
  onPipelineMutated?: () => void
}) {
  const {
    sessions,
    addSession,
    updateSession,
    selectedModel,
    models,
    agents,
  } = useAppStore()
  const { t } = useI18n()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const contextKeyRef = useRef<string | null>(null)
  const processedToolCallsRef = useRef<Set<string>>(new Set())
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const { sendMessage, cancelStream, retryLastError, deleteMessage, regenerateMessage, clearMessages, isLoading: isStreaming } = useAIChat({ sessionId })
  const cancelStreamRef = useRef<() => void>(() => {})

  const contextKey = `${mode}:${pipeline?.id ?? 'create'}`
  const enabledAgentSummary = useMemo(() => {
    const enabledAgents = agents.filter((agent) => agent.enabled !== false)
    if (enabledAgents.length === 0) return t('common.none', 'None')
    return enabledAgents
      .map((agent) => `${agent.name} (${agent.id})`)
      .join(', ')
  }, [agents, t])
  const contextPrompt = useMemo(
    () => buildContextPrompt({ mode, pipeline, t, enabledAgentSummary }),
    [enabledAgentSummary, mode, pipeline, t],
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
      title: buildSessionTitle(mode, pipeline, t),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      surface: 'pipeline-assistant',
      agentId: PIPELINE_BUILDER_AGENT_ID,
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
      title: buildSessionTitle(mode, pipeline, t),
      agentId: PIPELINE_BUILDER_AGENT_ID,
      modelId: selectedModel?.id,
      contextPrompt,
      ...(contextChanged ? { messages: [] } : {}),
    })
  }, [cancelStream, contextKey, contextPrompt, mode, pipeline, selectedModel?.id, sessionId, t, updateSession])

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
        t('agents.pipelineAssistantPromptEditTighten', 'Add an approval step after the current first step and save the pipeline.'),
        t('agents.pipelineAssistantPromptEditVariables', 'Rename the input variable to audience and update the affected steps.'),
        t('agents.pipelineAssistantPromptEditRetries', 'Increase retry safety for the final step and add a timeout.'),
      ]
    }

    return [
      t('agents.pipelineAssistantPromptCreateLaunch', 'Create a release pipeline with three steps: draft launch notes, review them, then publish a summary.'),
      t('agents.pipelineAssistantPromptCreateResearch', 'Create a research pipeline that gathers findings, checks risks, and writes an executive summary.'),
      t('agents.pipelineAssistantPromptCreateSupport', 'Create a customer support pipeline that classifies the issue, drafts a reply, and produces an escalation note.'),
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
    if (!onPipelineMutated) return

    let hasMutation = false
    for (const message of messages) {
      for (const toolCall of message.toolCalls ?? []) {
        if (!['pipeline_add', 'pipeline_update', 'pipeline_remove'].includes(toolCall.toolName)) continue
        if (toolCall.status !== 'completed' || processedToolCallsRef.current.has(toolCall.id)) continue
        processedToolCallsRef.current.add(toolCall.id)
        hasMutation = true
      }
    }

    if (hasMutation) onPipelineMutated()
  }, [messages, onPipelineMutated])

  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-40 flex w-full justify-end pl-16">
      <section
        role="dialog"
        aria-label={t('agents.pipelineAssistantLabel', 'Pipeline assistant')}
        className="pointer-events-auto flex h-full w-full max-w-136 flex-col border-l border-border-subtle/55 bg-surface-0/94 shadow-[-24px_0_60px_rgba(15,23,42,0.22)] backdrop-blur-xl"
      >
        <div className="border-b border-border-subtle/55 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('timer.assistantSection', 'Side chat')}</div>
              <h2 className="mt-1 text-[20px] font-semibold text-text-primary">
                {mode === 'edit' ? t('agents.pipelineAssistantTitleEdit', 'AI Edit Pipeline') : t('agents.pipelineAssistantTitleCreate', 'AI Create Pipeline')}
              </h2>
              <p className="mt-1 text-[12px] leading-5 text-text-secondary/78">
                {t('agents.pipelineAssistantDescription', 'Create or modify saved pipelines in natural language. A confirmation step is required before changes execute.')}
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
                aria-label={t('agents.pipelineAssistantClose', 'Close pipeline assistant')}
                title={t('common.close', 'Close')}
              >
                <IconifyIcon name="ui-close" size={16} color="currentColor" />
              </button>
            </div>
          </div>
        </div>

        <div className="border-b border-border-subtle/55 px-5 py-4">
          <div className="mb-3">
            <label htmlFor="pipeline-assistant-model" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/45">
              {t('agents.pipelineAssistantModelPicker', 'Assistant model')}
            </label>
            <select
              id="pipeline-assistant-model"
              aria-label={t('agents.pipelineAssistantModelPicker', 'Assistant model')}
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
            <ContextChip label={t('timer.assistantMode', 'Mode')} value={mode === 'edit' ? t('agents.pipelineAssistantModeEdit', 'Edit saved pipeline') : t('agents.pipelineAssistantModeCreate', 'Create saved pipeline')} />
            <ContextChip label={t('timer.assistantModel', 'Model')} value={sessionModel?.name || t('timer.assistantNoModelSelected', 'No model selected')} />
            <ContextChip label={t('timer.assistantConfirmation', 'Confirmation')} value={t('agents.pipelineAssistantConfirmationHint', 'pipeline_add / pipeline_update / pipeline_remove will ask for confirmation')} />
            <ContextChip label={t('timer.assistantTarget', 'Target')} value={pipeline ? `${pipeline.name} (${pipeline.id})` : t('agents.pipelineAssistantTargetDraft', 'New saved pipeline')} />
            {pipeline && <ContextChip label={t('agents.pipelineAssistantCurrentSteps', 'Current steps')} value={String(pipeline.steps.length)} />}
            {pipeline && <ContextChip label={t('agents.pipelineAssistantCurrentVariables', 'Current variables')} value={summarizeVariables(pipeline, t)} />}
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
                    ? t('agents.pipelineAssistantHeroEdit', 'Tell me how you want to change this pipeline')
                    : t('agents.pipelineAssistantHeroCreate', 'Describe the pipeline you want to create')}
                </h3>
                <p className="mt-2 text-[12px] leading-6 text-text-secondary/78">
                  {mode === 'edit'
                    ? t('agents.pipelineAssistantHeroEditHint', 'You can add, reorder, or rewrite steps, adjust variables, and change retry or budget settings.')
                    : t('agents.pipelineAssistantHeroCreateHint', 'Describe the handoff sequence, which agents should be used, any variables, and any retry or budget rules.')}
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
                  {t('agents.pipelineAssistantNoModel', 'No active model is available yet. Select a model in Models before using the pipeline assistant.')}
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
