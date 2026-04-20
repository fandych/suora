import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAppStore } from '@/store/appStore'
import { generateId } from '@/utils/helpers'
import type { Agent, MessageAttachment, Model, Session } from '@/types'
import { useAIChat } from '@/hooks/useAIChat'
import { AgentAvatar, IconifyIcon } from '@/components/icons/IconifyIcons'
import { useI18n } from '@/hooks/useI18n'
import { toast } from '@/services/toast'
import { MessageBubble } from './ChatMessages'
import { ChatInput } from './ChatInput'
import { TodoProgress } from './TodoProgress'
import { AgentStateDebug } from '@/components/debug/AgentStateDebug'

function formatRelativeLabel(ts: number, locale = 'en'): string {
  const diffSeconds = Math.round((ts - Date.now()) / 1000)
  const absSeconds = Math.abs(diffSeconds)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (absSeconds < 45) return formatter.format(0, 'second')
  if (absSeconds < 3600) return formatter.format(Math.round(diffSeconds / 60), 'minute')
  if (absSeconds < 86400) return formatter.format(Math.round(diffSeconds / 3600), 'hour')
  if (absSeconds < 604800) return formatter.format(Math.round(diffSeconds / 86400), 'day')

  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(ts)
}

function SurfaceBadge({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: 'default' | 'accent' | 'warning' | 'success'
}) {
  const toneClass = tone === 'accent'
    ? 'border-accent/20 bg-accent/10 text-accent'
    : tone === 'warning'
      ? 'border-warning/20 bg-warning/10 text-warning'
      : tone === 'success'
        ? 'border-success/20 bg-success/10 text-success'
        : 'border-border-subtle/55 bg-surface-0/60 text-text-secondary'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium ${toneClass}`}>
      {children}
    </span>
  )
}

function HeaderStat({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className={`rounded-[22px] border px-4 py-3 ${accent ? 'border-accent/18 bg-accent/10' : 'border-border-subtle/45 bg-surface-0/60'}`}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{label}</div>
      <div className={`mt-2 text-lg font-semibold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</div>
    </div>
  )
}

function PromptActionCard({
  icon,
  title,
  detail,
  onClick,
  disabled,
}: {
  icon: string
  title: string
  detail: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group rounded-[26px] border border-border-subtle/55 bg-surface-0/48 p-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-all duration-200 hover:border-accent/18 hover:bg-surface-0/68 hover:shadow-[0_16px_36px_rgba(var(--t-accent-rgb),0.08)] disabled:opacity-45"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/80 text-accent shadow-sm transition-colors group-hover:border-accent/20 group-hover:bg-accent/10">
        <IconifyIcon name={icon} size={18} color="currentColor" />
      </div>
      <div className="mt-4 text-[15px] font-semibold text-text-primary">{title}</div>
      <p className="mt-2 text-[12px] leading-6 text-text-secondary/78">{detail}</p>
    </button>
  )
}

function ModelDropdown({
  models,
  providerNameById,
  value,
  onChange,
}: {
  models: Model[]
  providerNameById: Map<string, string>
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = models.find((model) => model.id === value) ?? null
  const currentProvider = current ? (providerNameById.get(current.provider) || current.provider) : null

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative min-w-0" ref={ref}>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/45">{t('chat.model', 'Model')}</div>
      <div className="relative">
        <button
          type="button"
          aria-label="Select model"
          onClick={() => setOpen(!open)}
          className="flex w-full min-w-60 items-center justify-between gap-3 rounded-3xl border border-border-subtle/55 bg-surface-0/60 px-4 py-3.5 text-left shadow-sm transition-all hover:border-accent/18 hover:bg-surface-0/82 focus:border-accent/24 focus:outline-none focus:ring-2 focus:ring-accent/20"
        >
          <div className="min-w-0 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/80 text-accent shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <rect x="9" y="9" width="6" height="6" rx="1.5" />
                <path d="M9 2v2M15 2v2M9 20v2M15 20v2M20 9h2M20 15h2M2 9h2M2 15h2" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-text-primary">{current?.name ?? t('chat.selectModel', '-- Select Model --')}</div>
              <div className="truncate text-[11px] text-text-muted/68">{current ? `${currentProvider} / ${current.modelId}` : `${models.length} ${t('chat.availableModels', 'available models')}`}</div>
            </div>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-text-muted/45"><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-3 w-76 max-h-96 overflow-y-auto rounded-[22px] border border-border-subtle/70 bg-surface-2/95 p-2 shadow-2xl backdrop-blur-xl animate-fade-in-scale">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className={`w-full rounded-[18px] px-3.5 py-3 text-left transition-colors ${
                !value ? 'bg-accent/8 text-accent' : 'text-text-secondary hover:bg-surface-3/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-0/70 text-accent shadow-sm">
                  <IconifyIcon name="ui-close" size={14} color="currentColor" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-text-primary">{t('chat.selectModel', '-- Select Model --')}</div>
                  <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-text-muted/72">{t('chat.modelFallbackHint', 'Clear the pinned model and fall back to the session or agent default.')}</div>
                </div>
              </div>
            </button>

            {models.map((model) => {
              const providerName = providerNameById.get(model.provider) || model.provider

              return (
                <button
                  type="button"
                  key={model.id}
                  onClick={() => { onChange(model.id); setOpen(false) }}
                  className={`w-full rounded-[18px] px-3.5 py-3 text-left transition-colors ${
                    model.id === value ? 'bg-accent/8 text-accent' : 'text-text-secondary hover:bg-surface-3/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-0/70 text-accent shadow-sm">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">{providerName.slice(0, 2)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-text-primary">{model.name}</div>
                      <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-text-muted/72">{providerName} / {model.modelId}</div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function ChatTabBar() {
  const { sessions, activeSessionId, openSessionTabs, openSessionTab, closeSessionTab, agents, addSession, selectedModel, selectedAgent } = useAppStore()
  const { t } = useI18n()

  const handleNewTab = () => {
    if (!selectedModel) {
      toast.warning(t('chat.noModelConfigured', 'No model configured'), t('chat.addModelFirst', 'Please add a model provider in Models settings first.'))
      return
    }
    const session: Session = {
      id: generateId('session'),
      title: t('chat.newChat', 'New Chat'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      agentId: selectedAgent?.id,
      modelId: selectedModel?.id,
      messages: [],
    }
    addSession(session)
  }

  return (
    <div className="px-6 pt-5 xl:px-8">
      <div className="flex items-center gap-2 overflow-x-auto rounded-3xl border border-border-subtle/55 bg-surface-1/55 p-2 shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        <span className="pl-2 pr-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">
          {t('chat.tabs', 'Tabs')}
        </span>

        {openSessionTabs.map((tabId) => {
          const session = sessions.find((item) => item.id === tabId)
          if (!session) return null
          const isActive = activeSessionId === tabId
          const agent = session.agentId ? agents.find((item) => item.id === session.agentId) : null

          return (
            <div
              key={tabId}
              className={`group flex max-w-60 shrink-0 items-center rounded-[18px] border transition-all duration-200 ${
                isActive
                  ? 'border-accent/22 bg-accent/10 text-text-primary shadow-[0_10px_24px_rgba(var(--t-accent-rgb),0.08)]'
                  : 'border-transparent bg-transparent text-text-muted hover:border-border-subtle/55 hover:bg-surface-0/48 hover:text-text-secondary'
              }`}
            >
              <button
                type="button"
                onClick={() => openSessionTab(tabId)}
                aria-current={isActive ? 'page' : undefined}
                className="min-w-0 flex flex-1 items-center gap-2 px-4 py-2.5 text-left focus:outline-none"
              >
                {agent && <span className="text-[10px]"><AgentAvatar avatar={agent.avatar} size={14} /></span>}
                <span className="truncate text-[12.5px] font-medium">{session.title}</span>
              </button>
              <button
                type="button"
                title={t('chat.closeTab', 'Close tab')}
                aria-label={`${t('chat.closeTab', 'Close tab')}: ${session.title}`}
                onClick={(e) => {
                  e.stopPropagation()
                  closeSessionTab(tabId)
                }}
                className="mr-2 flex h-7 w-7 items-center justify-center rounded-xl text-text-muted/60 transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <IconifyIcon name="ui-close" size={15} color="currentColor" />
              </button>
            </div>
          )
        })}

        <button
          type="button"
          onClick={handleNewTab}
          title={t('chat.newTab', 'New chat tab')}
          aria-label={t('chat.newTab', 'New chat tab')}
          className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border-subtle/50 bg-surface-0/55 text-text-muted transition-all hover:border-accent/18 hover:bg-accent/10 hover:text-accent"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
    </div>
  )
}

function AgentDropdown({ agents, selectedAgentId, onSelect }: {
  agents: Agent[]
  selectedAgentId: string
  onSelect: (agent: Agent | null) => void
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const enabledAgents = agents.filter((a) => a.enabled !== false)
  const current = enabledAgents.find((a) => a.id === selectedAgentId) ?? enabledAgents[0] ?? null
  const currentLabel = current?.id === 'default-assistant'
    ? t('chat.assistant', current.name || 'Assistant')
    : current?.name

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative min-w-0" ref={ref}>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/45">{t('chat.agent', 'Agent')}</div>
      <div className="relative">
        <button
          type="button"
          aria-label={t('chat.selectAgent', 'Select agent')}
          onClick={() => setOpen(!open)}
          className="flex w-full min-w-60 items-center justify-between gap-3 rounded-3xl border border-border-subtle/55 bg-surface-0/60 px-4 py-3.5 text-left shadow-sm transition-all hover:border-accent/18 hover:bg-surface-0/82 focus:border-accent/24 focus:outline-none focus:ring-2 focus:ring-accent/20"
        >
          <div className="min-w-0 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/80 text-accent shadow-sm">
              {current && <AgentAvatar avatar={current.avatar} size={18} />}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-text-primary">{currentLabel ?? t('common.select', 'Select')}</div>
              <div className="truncate text-[11px] text-text-muted/68">{current?.whenToUse || t('chat.agentReady', 'Routing and behavior')}</div>
            </div>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-text-muted/45"><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-3 w-76 max-h-96 overflow-y-auto rounded-[22px] border border-border-subtle/70 bg-surface-2/95 p-2 shadow-2xl backdrop-blur-xl animate-fade-in-scale">
            {enabledAgents.map((a) => (
              <button
                type="button"
                key={a.id}
                onClick={() => { onSelect(a); setOpen(false) }}
                className={`w-full rounded-[18px] px-3.5 py-3 text-left transition-colors ${
                  a.id === selectedAgentId ? 'bg-accent/8 text-accent' : 'text-text-secondary hover:bg-surface-3/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-0/70 shadow-sm">
                    <AgentAvatar avatar={a.avatar} size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-text-primary">{a.id === 'default-assistant' ? t('chat.assistant', a.name || 'Assistant') : a.name}</div>
                    <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-text-muted/72">{a.whenToUse || t('chat.agentReady', 'Routing and behavior')}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function ChatMain() {
  const { sessions, activeSessionId, openSessionTabs, updateSession, models, agents, selectedModel, selectedAgent, setSelectedModel, setSelectedAgent, providerConfigs, addSession, openSessionTab } = useAppStore()
  const { t, locale } = useI18n()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const [showDebug, setShowDebug] = useState(false)
  const { sendMessage, cancelStream, retryLastError, deleteMessage, regenerateMessage, clearMessages, isLoading: isStreaming } = useAIChat()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setShowDebug((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSend = useCallback(
    (text: string, attachments?: Parameters<typeof sendMessage>[1]) => {
      isNearBottomRef.current = true
      return sendMessage(text, attachments)
    },
    [sendMessage],
  )

  useEffect(() => {
    return () => { cancelStream() }
  }, [activeSessionId, cancelStream])

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null
  const messages = activeSession?.messages ?? []
  const enabledModels = useMemo(() => models.filter((model) => model.enabled), [models])
  const providerNameById = useMemo(
    () => new Map(providerConfigs.map((config) => [config.id, config.name])),
    [providerConfigs],
  )

  const defaultAgent = agents.find((a) => a.id === 'default-assistant')
  const sessionAgent = activeSession?.agentId
    ? agents.find((a) => a.id === activeSession.agentId)
    : (selectedAgent ?? defaultAgent ?? null)
  const sessionModel = activeSession?.modelId
    ? models.find((m) => m.id === activeSession.modelId)
    : sessionAgent?.modelId
      ? models.find((m) => m.id === sessionAgent.modelId)
      : selectedModel
  const displayAgentName = sessionAgent?.id === 'default-assistant'
    ? t('chat.assistant', sessionAgent.name || 'Assistant')
    : sessionAgent?.name
  const displayAgentGreeting = sessionAgent?.id === 'default-assistant'
    ? t('chat.defaultAssistantGreeting', sessionAgent.greeting || 'Hi! I\'m your Suora. How can I help you today?')
    : sessionAgent?.greeting
  const lastUpdated = activeSession ? formatRelativeLabel(activeSession.updatedAt, locale) : null

  useEffect(() => {
    isNearBottomRef.current = true
  }, [activeSessionId])

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isNearBottomRef.current = distanceFromBottom < 120
  }, [])

  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const starterPrompts = useMemo(() => ([
    {
      icon: 'ui-lightbulb',
      label: t('chat.explainConceptLabel', 'Explain a concept'),
      detail: t('chat.explainConceptDetail', 'Turn a vague topic into a clear, structured explanation.'),
      prompt: t('chat.explainConceptPrompt', 'Please explain a concept to me. What topic would you like to learn about?'),
    },
    {
      icon: 'ui-memo',
      label: t('chat.helpMeWriteLabel', 'Help me write'),
      detail: t('chat.helpMeWriteDetail', 'Draft, tighten, or rewrite something with a sharper voice.'),
      prompt: t('chat.helpMeWritePrompt', 'I need help writing something. What kind of content would you like me to help with?'),
    },
    {
      icon: 'ui-search',
      label: t('chat.analyzeCodeLabel', 'Analyze code'),
      detail: t('chat.analyzeCodeDetail', 'Review logic, surface issues, and propose fixes.'),
      prompt: t('chat.analyzeCodePrompt', 'I can help analyze code. Please share the code you would like me to review.'),
    },
    {
      icon: 'ui-clipboard',
      label: t('chat.todoListLabel', 'Create a todo list'),
      detail: t('chat.todoListDetail', 'Break a messy task into a concrete execution plan.'),
      prompt: t('chat.todoListPrompt', 'Help me create a todo list for my current tasks. What project or area should I help you plan?'),
    },
  ]), [t])

  const createSessionAndSend = useCallback((text: string, attachments?: MessageAttachment[]) => {
    if (!selectedModel) {
      toast.warning(
        t('chat.noModelConfigured', 'No model configured'),
        t('chat.addModelFirst', 'Please add a model provider in Models settings first.'),
      )
      return
    }

    const seedTitle = text.trim() || attachments?.[0]?.name || t('chat.newChat', 'New Chat')
    const session: Session = {
      id: generateId('session'),
      title: seedTitle.slice(0, 40),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      agentId: selectedAgent?.id,
      modelId: selectedModel?.id,
      messages: [],
    }

    addSession(session)
    openSessionTab(session.id)

    setTimeout(() => {
      handleSend(text, attachments)
    }, 0)
  }, [addSession, handleSend, openSessionTab, selectedAgent, selectedModel, t])

  const handleModelChange = useCallback((modelId: string) => {
    const model = models.find((item) => item.id === modelId) ?? null
    setSelectedModel(model)

    if (activeSession) {
      updateSession(activeSession.id, { modelId: model?.id })
    }
  }, [activeSession, models, setSelectedModel, updateSession])

  const handleAgentSelect = useCallback((agent: Agent | null) => {
    setSelectedAgent(agent)
    if (!activeSession) return

    const patch: Partial<Session> = { agentId: agent?.id }
    if (agent?.modelId) {
      const preferredModel = models.find((model) => model.id === agent.modelId && model.enabled)
      if (preferredModel) {
        patch.modelId = preferredModel.id
        setSelectedModel(preferredModel)
      } else {
        patch.modelId = undefined
      }
    } else {
      patch.modelId = undefined
    }

    updateSession(activeSession.id, patch)
  }, [activeSession, models, setSelectedAgent, setSelectedModel, updateSession])

  if (!activeSession) {
    return (
      <div className="flex min-h-0 flex-1 min-w-0 flex-col overflow-hidden">
        <div className="px-6 pt-6 xl:px-8">
          <div className="rounded-[34px] border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/94 to-surface-2/72 p-6 shadow-[0_24px_70px_rgba(var(--t-accent-rgb),0.08)] xl:p-7">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('chat.workbench', 'Chat workbench')}</div>
                <h1 className="mt-2 text-[32px] font-semibold tracking-tight text-text-primary">{t('chat.desktopAssistant', 'Suora')}</h1>
                <p className="mt-3 max-w-2xl text-[15px] leading-7 text-text-secondary/82">{t('chat.selectOrCreate', 'Select or create a conversation to begin')}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <SurfaceBadge tone="accent">{t('chat.pipelineCommandHint', 'Try /pipeline list, or say "run Morning Run pipeline"')}</SurfaceBadge>
                  <SurfaceBadge>{t('chat.multimodalWorkspace', 'Attachments, voice input, and agent routing in one place')}</SurfaceBadge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:w-136">
                <AgentDropdown
                  agents={agents}
                  selectedAgentId={sessionAgent?.id ?? selectedAgent?.id ?? defaultAgent?.id ?? ''}
                  onSelect={(agent) => {
                    setSelectedAgent(agent)
                  }}
                />
                <ModelDropdown
                  models={enabledModels}
                  providerNameById={providerNameById}
                  value={selectedModel?.id ?? ''}
                  onChange={handleModelChange}
                />
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3 xl:w-md">
              <HeaderStat label={t('sessions.title', 'Sessions')} value={String(sessions.length)} accent />
              <HeaderStat label={t('chat.agents', 'Agents')} value={String(agents.filter((agent) => agent.enabled !== false).length)} />
              <HeaderStat label={t('chat.models', 'Models')} value={String(enabledModels.length)} />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-6 xl:px-8">
          <div className="mx-auto grid max-w-384 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.82fr)]">
            <section className="chat-stage-panel relative overflow-hidden rounded-[34px] border border-border-subtle/55 bg-surface-0/42 shadow-[0_24px_70px_rgba(15,23,42,0.14)]">
              <div className="relative z-10 p-6 xl:p-8">
                <div className="flex h-22 w-22 items-center justify-center rounded-[28px] border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_18px_46px_rgba(var(--t-accent-rgb),0.16)]">
                  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <div className="mt-8 max-w-2xl">
                  <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('chat.startHere', 'Start here')}</div>
                  <h2 className="mt-2 text-[34px] font-semibold tracking-tight text-text-primary">{t('chat.mainPrompt', 'Pick a thread, or launch a fresh one from the composer below.')}</h2>
                  <p className="mt-3 text-[14px] leading-7 text-text-secondary/82">{t('chat.welcomeBody', 'The chat page now behaves like a workspace instead of a blank prompt. Choose an agent, lock in a model, then jump in with one of these higher-signal starting points.')}</p>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {starterPrompts.map((prompt) => (
                    <PromptActionCard
                      key={prompt.label}
                      icon={prompt.icon}
                      title={prompt.label}
                      detail={prompt.detail}
                      onClick={() => createSessionAndSend(prompt.prompt)}
                    />
                  ))}
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-[28px] border border-border-subtle/55 bg-surface-0/48 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.09)]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('chat.activeSetup', 'Active setup')}</div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-border-subtle/45 bg-surface-2/80 shadow-sm">
                    {sessionAgent ? <AgentAvatar avatar={sessionAgent.avatar} size={22} /> : <IconifyIcon name="ui-sparkles" size={18} color="currentColor" className="text-accent" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold text-text-primary">{displayAgentName ?? t('chat.assistant', 'Assistant')}</div>
                    <div className="truncate text-[12px] text-text-muted/72">{sessionModel?.name ?? t('chat.selectModel', '-- Select Model --')}</div>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-[12px] text-text-secondary/82">
                  <div className="flex items-center justify-between rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-3 py-2.5">
                    <span>{t('chat.voiceInput', 'Voice input')}</span>
                    <span className="text-text-muted/78">{t('common.on', 'On')}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-3 py-2.5">
                    <span>{t('chat.attachments', 'Attachments')}</span>
                    <span className="text-text-muted/78">{t('chat.imagesAudioText', 'Images, audio, and text')}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-border-subtle/55 bg-surface-0/48 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.09)]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('chat.readyCheck', 'Ready check')}</div>
                <div className="mt-3 text-[14px] font-semibold text-text-primary">{selectedModel ? t('chat.modelArmed', 'Model armed') : t('chat.modelMissing', 'Model required')}</div>
                <p className="mt-2 text-[12px] leading-6 text-text-muted/78">
                  {selectedModel
                    ? t('chat.modelArmedDetail', 'Send from the composer below and a new session will open automatically.')
                    : t('chat.selectModelToChat', 'Please select a model to start chatting')}
                </p>
                {!selectedModel && (
                  <div className="mt-4">
                    <SurfaceBadge tone="warning">
                      <IconifyIcon name="ui-warning" size={13} color="currentColor" />
                      {t('chat.selectModelToChat', 'Please select a model to start chatting')}
                    </SurfaceBadge>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>

        <div className="px-6 pb-6 xl:px-8">
          <ChatInput
            onSend={createSessionAndSend}
            disabled={false}
            noModel={!selectedModel}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 min-w-0 flex-col overflow-hidden">
      {openSessionTabs.length > 1 && <ChatTabBar />}

      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="px-6 pt-6 xl:px-8">
          <div className="mx-auto max-w-384 rounded-[34px] border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/94 to-surface-2/72 p-6 shadow-[0_24px_70px_rgba(var(--t-accent-rgb),0.08)] xl:p-7">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('chat.liveSession', 'Live session')}</div>
                <h1 className="mt-2 text-[32px] font-semibold tracking-tight text-text-primary">{activeSession.title}</h1>
                <p className="mt-3 max-w-2xl text-[15px] leading-7 text-text-secondary/82">{displayAgentGreeting || t('chat.askAnything', 'Ask me anything, or try one of the suggestions below')}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {displayAgentName && <SurfaceBadge tone="accent">{displayAgentName}</SurfaceBadge>}
                  <SurfaceBadge>{sessionModel?.name ?? t('chat.selectModel', '-- Select Model --')}</SurfaceBadge>
                  <SurfaceBadge>{messages.length} {t('sessions.msgs', 'msgs')}</SurfaceBadge>
                  {lastUpdated && <SurfaceBadge>{t('chat.updated', 'Updated')} {lastUpdated}</SurfaceBadge>}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:w-xl">
                <AgentDropdown
                  agents={agents}
                  selectedAgentId={sessionAgent?.id ?? selectedAgent?.id ?? defaultAgent?.id ?? ''}
                  onSelect={handleAgentSelect}
                />
                <ModelDropdown
                  models={enabledModels}
                  providerNameById={providerNameById}
                  value={sessionModel?.id ?? selectedModel?.id ?? ''}
                  onChange={handleModelChange}
                />
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={clearMessages}
                    disabled={isStreaming}
                    title={t('chat.clearConversation', 'Clear conversation')}
                    className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-3xl border border-border-subtle/55 bg-surface-0/58 px-4 py-3.5 text-[13px] font-semibold text-text-secondary transition-colors hover:border-danger/18 hover:bg-danger/8 hover:text-danger disabled:opacity-35"
                  >
                    <IconifyIcon name="ui-trash" size={15} color="currentColor" />
                    {t('common.clear', 'Clear')}
                  </button>
                )}
              </div>
            </div>

            {!sessionModel && (
              <div className="mt-6 border-t border-border-subtle/45 pt-4">
                <SurfaceBadge tone="warning">
                  <IconifyIcon name="ui-warning" size={13} color="currentColor" />
                  {t('chat.selectModelToChat', 'Please select a model to start chatting')}
                </SurfaceBadge>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-4 pt-6 xl:px-8">
          <div className="mx-auto max-w-384">
            {messages.length === 0 ? (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
                <section className="chat-stage-panel relative overflow-hidden rounded-[34px] border border-border-subtle/55 bg-surface-0/42 shadow-[0_24px_70px_rgba(15,23,42,0.14)]">
                  <div className="relative z-10 p-6 xl:p-8">
                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_18px_46px_rgba(var(--t-accent-rgb),0.16)]">
                      <AgentAvatar avatar={sessionAgent?.avatar ?? 'ui-sparkles'} size={32} />
                    </div>
                    <div className="mt-7 max-w-2xl">
                      <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('chat.readyWhenYouAre', 'Ready when you are')}</div>
                      <h2 className="mt-2 text-[34px] font-semibold tracking-tight text-text-primary">{displayAgentName || t('chat.howCanIHelp', 'How can I help you today?')}</h2>
                      <p className="mt-3 text-[15px] leading-7 text-text-secondary/82">{displayAgentGreeting || t('chat.askAnything', 'Ask me anything, or try one of the suggestions below')}</p>
                    </div>

                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                      {starterPrompts.map((suggestion) => (
                        <PromptActionCard
                          key={suggestion.label}
                          icon={suggestion.icon}
                          title={suggestion.label}
                          detail={suggestion.detail}
                          onClick={() => handleSend(suggestion.prompt)}
                          disabled={isStreaming}
                        />
                      ))}
                    </div>
                  </div>
                </section>

                <aside className="hidden xl:block">
                  <div className="sticky top-4 space-y-4">
                    <div className="rounded-[28px] border border-border-subtle/55 bg-surface-0/48 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.09)]">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('chat.context', 'Context')}</div>
                      <div className="mt-4 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-border-subtle/45 bg-surface-2/80 shadow-sm">
                          {sessionAgent ? <AgentAvatar avatar={sessionAgent.avatar} size={20} /> : <IconifyIcon name="ui-sparkles" size={16} color="currentColor" className="text-accent" />}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-semibold text-text-primary">{displayAgentName ?? t('chat.assistant', 'Assistant')}</div>
                          <div className="truncate text-[12px] text-text-muted/72">{sessionModel?.name ?? t('chat.selectModel', '-- Select Model --')}</div>
                        </div>
                      </div>
                      {!sessionModel && (
                        <div className="mt-4">
                          <SurfaceBadge tone="warning">
                            <IconifyIcon name="ui-warning" size={13} color="currentColor" />
                            {t('chat.selectModelToChat', 'Please select a model to start chatting')}
                          </SurfaceBadge>
                        </div>
                      )}
                    </div>

                    <div className="rounded-[28px] border border-border-subtle/55 bg-surface-0/48 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.09)]">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('chat.hints', 'Hints')}</div>
                      <div className="mt-3 space-y-2 text-[12px] leading-6 text-text-secondary/82">
                        <div className="rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-3 py-2.5">{t('chat.pipelineCommandHint', 'Try /pipeline list, or say "run Morning Run pipeline"')}</div>
                        <div className="rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-3 py-2.5">{t('chat.pasteHint', 'Paste screenshots, drag files, or dictate directly from the composer.')}</div>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            ) : (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
                <section className="chat-stage-panel relative overflow-hidden rounded-[34px] border border-border-subtle/55 bg-surface-0/42 shadow-[0_24px_70px_rgba(15,23,42,0.14)]">
                  <div className="relative z-10 p-4 sm:p-6 xl:p-8">
                    <TodoProgress />
                    <div className="space-y-1">
                      {messages.map((msg) => (
                        <MessageBubble
                          key={msg.id}
                          message={msg}
                          onRetry={msg.isError ? () => retryLastError() : undefined}
                          onDelete={() => deleteMessage(msg.id)}
                          onRegenerate={msg.role === 'assistant' && !msg.isStreaming ? () => regenerateMessage(msg.id) : undefined}
                          onFeedback={msg.role === 'assistant' ? (fb) => {
                            const session = sessions.find((item) => item.id === activeSessionId)
                            if (!session) return
                            const updatedMessages = session.messages.map((message) =>
                              message.id === msg.id ? { ...message, feedback: fb } : message,
                            )
                            updateSession(session.id, { messages: updatedMessages })
                          } : undefined}
                        />
                      ))}
                    </div>
                    <div ref={messagesEndRef} />
                  </div>
                </section>

                <aside className="hidden xl:block">
                  <div className="sticky top-4 space-y-4">
                    <div className="rounded-[28px] border border-border-subtle/55 bg-surface-0/48 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.09)]">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('chat.sessionStatus', 'Session status')}</div>
                      <div className="mt-4 space-y-3 text-[12px]">
                        <div className="flex items-center justify-between rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-3 py-2.5">
                          <span className="text-text-muted">{t('chat.messages', 'Messages')}</span>
                          <span className="font-semibold text-text-primary">{messages.length}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-3 py-2.5">
                          <span className="text-text-muted">{t('chat.agent', 'Agent')}</span>
                          <span className="truncate pl-3 text-right font-semibold text-text-primary">{displayAgentName ?? t('chat.assistant', 'Assistant')}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-3 py-2.5">
                          <span className="text-text-muted">{t('chat.model', 'Model')}</span>
                          <span className="truncate pl-3 text-right font-semibold text-text-primary">{sessionModel?.name ?? '—'}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-3 py-2.5">
                          <span className="text-text-muted">{t('chat.updated', 'Updated')}</span>
                          <span className="font-semibold text-text-primary">{lastUpdated ?? '—'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-border-subtle/55 bg-surface-0/48 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.09)]">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('chat.runtime', 'Runtime')}</div>
                      <div className="mt-3 space-y-2 text-[12px] leading-6 text-text-secondary/82">
                        <div className="rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-3 py-2.5">{isStreaming ? t('chat.thinking', 'Thinking…') : t('chat.aiDisclaimer', 'AI can make mistakes. Please verify important information.')}</div>
                        <div className="rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-3 py-2.5">{t('chat.pipelineCommandHint', 'Try /pipeline list, or say "run Morning Run pipeline"')}</div>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            )}
          </div>
        </div>
      </div>

      <StreamingStatus isStreaming={isStreaming} messages={messages} />

      <div className="px-6 pb-6 xl:px-8">
        <ChatInput
          onSend={handleSend}
          disabled={isStreaming}
          isStreaming={isStreaming}
          onStop={cancelStream}
          noModel={!sessionModel}
        />
      </div>

      {showDebug && <AgentStateDebug />}
    </div>
  )
}

function StreamingStatus({
  isStreaming,
  messages,
}: {
  isStreaming: boolean
  messages: import('@/types').Message[]
}) {
  const { t } = useI18n()
  if (!isStreaming) return null

  const last = [...messages].reverse().find((m) => m.role === 'assistant')
  const activeTool = last?.toolCalls?.find(
    (tc) => tc.status === 'running' || tc.status === 'pending',
  )

  const label = activeTool
    ? `${t('chat.callingTool', 'Calling tool')}: ${activeTool.toolName}`
    : t('chat.thinking', 'AI is thinking…')

  return (
    <div className="px-6 pb-3 pt-2 xl:px-8">
      <div className="mx-auto max-w-384">
        <div
          role="status"
          aria-live="polite"
          className="inline-flex max-w-full items-center gap-3 rounded-full border border-accent/18 bg-surface-0/72 px-4 py-2 text-[11.5px] text-text-secondary shadow-[0_12px_30px_rgba(var(--t-accent-rgb),0.08)] backdrop-blur-xl"
        >
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          <span className="truncate">{label}</span>
        </div>
      </div>
    </div>
  )
}
