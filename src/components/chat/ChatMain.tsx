import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAppStore } from '@/store/appStore'
import { generateId } from '@/utils/helpers'
import type { Agent, MessageAttachment, Model, Session } from '@/types'
import { useAIChat } from '@/hooks/useAIChat'
import { AgentAvatar, IconifyIcon } from '@/components/icons/IconifyIcons'
import { useI18n } from '@/hooks/useI18n'
import { toast } from '@/services/toast'
import { isMainChatSession } from '@/utils/chatSessions'
import { MessageBubble } from './ChatMessages'
import { ChatInput } from './ChatInput'
import { TodoProgress } from './TodoProgress'
import { AgentStateDebug } from '@/components/debug/AgentStateDebug'
import { exportChat, type ExportFormat } from '@/services/exportUtils'

const MAX_RENDERED_MESSAGES = 120
const BROWSER_STATE_POLL_INTERVAL_MS = 4000

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
      className="group rounded-md border border-border-subtle/45 bg-surface-0/42 p-3 text-left transition-all duration-200 hover:border-accent/24 hover:bg-surface-0/70 disabled:opacity-45"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent transition-colors group-hover:bg-accent/14">
        <IconifyIcon name={icon} size={16} color="currentColor" />
      </div>
      <div className="mt-2.5 text-[13px] font-semibold text-text-primary">{title}</div>
      <p className="mt-1 text-[12px] leading-5 text-text-secondary/72">{detail}</p>
    </button>
  )
}

interface BrowserWorkbenchState {
  available: boolean
  visible: boolean
  loading: boolean
  title: string
  url: string
}

function getBrowserWorkbenchStatus({
  hasBrowserWindow,
  isLoading,
  isReady,
  isVisible,
  t,
}: {
  hasBrowserWindow: boolean
  isLoading: boolean
  isReady: boolean
  isVisible: boolean
  t: ReturnType<typeof useI18n>['t']
}) {
  if (isLoading) return t('chat.browserLoading', 'Loading')
  if (isReady) return t('chat.browserReady', 'Ready')
  if (isVisible) return t('chat.browserOpen', 'Open')
  if (hasBrowserWindow) return t('chat.browserHidden', 'Hidden')
  return t('chat.browserIdle', 'Idle')
}

function BrowserWorkbenchCard({ className = '', density = 'card' }: { className?: string; density?: 'card' | 'bar' }) {
  const { t } = useI18n()
  const [state, setState] = useState<BrowserWorkbenchState | null>(null)
  const [busy, setBusy] = useState(false)
  const hasElectron = typeof window !== 'undefined' && typeof window.electron?.invoke === 'function'

  const refreshState = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!hasElectron) return
    if (!silent) setBusy(true)
    try {
      const result = await window.electron.invoke('browser:getState') as BrowserWorkbenchState & { error?: string }
      if (result.error) throw new Error(result.error)
      setState(result)
    } catch (error) {
      if (!silent) {
        toast.error(t('chat.browserUnavailable', 'Browser unavailable'), error instanceof Error ? error.message : String(error))
      }
    } finally {
      if (!silent) setBusy(false)
    }
  }, [hasElectron, t])

  const runBrowserAction = useCallback(async (channel: 'browser:show' | 'browser:hide') => {
    if (!hasElectron) return
    setBusy(true)
    try {
      const result = await window.electron.invoke(channel) as BrowserWorkbenchState & { error?: string }
      if (result.error) throw new Error(result.error)
      setState(result)
    } catch (error) {
      toast.error(t('chat.browserUnavailable', 'Browser unavailable'), error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }, [hasElectron, t])

  const openBrowser = useCallback(async () => {
    await runBrowserAction('browser:show')
  }, [runBrowserAction])

  const hideBrowser = useCallback(async () => {
    await runBrowserAction('browser:hide')
  }, [runBrowserAction])

  useEffect(() => {
    const refresh = () => void refreshState({ silent: true })
    refresh()
    const intervalId = window.setInterval(refresh, BROWSER_STATE_POLL_INTERVAL_MS)
    const handleVisibilityChange = () => {
      if (!document.hidden) refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshState])

  if (!hasElectron) return null

  const hasBrowserWindow = Boolean(state?.available)
  const isVisible = Boolean(state?.visible)
  const hasPage = Boolean(state?.url)
  const isReady = isVisible && hasPage
  const isLoading = busy || Boolean(state?.loading)
  const shouldShowBrowserWorkbench = isLoading || hasBrowserWindow || hasPage

  if (!shouldShowBrowserWorkbench) return null

  const actionLabel = isVisible ? t('chat.focusBrowser', 'Focus browser') : t('chat.openBrowser', 'Open browser')
  const statusLabel = getBrowserWorkbenchStatus({ hasBrowserWindow, isLoading, isReady, isVisible, t })
  const statusClass = isReady
    ? 'border-success/20 bg-success/10 text-success'
    : isLoading
      ? 'border-warning/20 bg-warning/10 text-warning'
      : 'border-border-subtle/60 bg-surface-0/45 text-text-muted'
  const dotClass = isLoading
    ? 'bg-warning animate-pulse'
    : isReady
      ? 'bg-success'
      : hasBrowserWindow
        ? 'bg-accent'
        : 'bg-text-muted/55'

  if (density === 'bar') {
    return (
      <div className={`overflow-hidden rounded-md border border-border-subtle/55 bg-surface-0/72 text-left shadow-sm backdrop-blur-xl ${className}`}>
        <div className="flex min-w-0 flex-col gap-2.5 p-2.5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-accent/18 bg-accent/10 text-accent shadow-sm">
              <IconifyIcon name="ui-computer" size={16} color="currentColor" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h3 className="truncate text-[12.5px] font-semibold text-text-primary">{t('chat.browserCollabTitle', 'Collaborative Browser')}</h3>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                  {statusLabel}
                </span>
              </div>
              <div className="mt-0.5 truncate font-(--font-code) text-[10.5px] text-text-muted/72">
                {state?.url || t('chat.browserNoPageYet', 'No page loaded yet')}
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:min-w-96">
            <div className="min-w-0 flex-1 rounded-md border border-border-subtle/42 bg-surface-1/54 px-3 py-1.5">
              <div className="truncate text-[12px] font-semibold text-text-primary">
                {state?.title || t('chat.browserAwaitingPage', 'Waiting for AI to open a page')}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => void openBrowser()}
                disabled={busy}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-accent/24 bg-accent/10 px-3 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/15 disabled:opacity-50"
              >
                <IconifyIcon name="ui-export" size={14} color="currentColor" />
                {actionLabel}
              </button>
              {isVisible && (
                <button
                  type="button"
                  onClick={() => void hideBrowser()}
                  disabled={busy}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border-subtle/50 bg-surface-1/58 px-3 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-surface-2/70 hover:text-text-primary disabled:opacity-50"
                >
                  <IconifyIcon name="ui-close" size={13} color="currentColor" />
                  {t('chat.hideBrowser', 'Hide browser')}
                </button>
              )}
              <button
                type="button"
                title={t('common.refresh', 'Refresh')}
                aria-label={t('common.refresh', 'Refresh')}
                onClick={() => void refreshState()}
                disabled={busy}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle/50 bg-surface-1/58 text-text-secondary transition-colors hover:bg-surface-2/70 hover:text-text-primary disabled:opacity-50"
              >
                <IconifyIcon name="ui-refresh" size={14} color="currentColor" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`h-full overflow-hidden rounded-md border border-border-subtle/55 bg-surface-0/58 text-left shadow-sm backdrop-blur-xl ${className}`}>
      <div className="flex h-full flex-col gap-2.5 p-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-accent/18 bg-accent/10 text-accent shadow-sm">
            <IconifyIcon name="ui-computer" size={17} color="currentColor" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="truncate text-[13px] font-semibold text-text-primary">{t('chat.browserCollabTitle', 'Collaborative Browser')}</h3>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                {statusLabel}
              </span>
            </div>
            <div className="mt-1 min-w-0 truncate font-(--font-code) text-[11px] text-text-muted/72">
              {state?.url || t('chat.browserNoPageYet', 'No page loaded yet')}
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0 rounded-md border border-border-subtle/42 bg-surface-1/54 px-3 py-2">
            <div className="truncate text-[12.5px] font-semibold text-text-primary">
              {state?.title || t('chat.browserAwaitingPage', 'Waiting for AI to open a page')}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => void openBrowser()}
              disabled={busy}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-accent/24 bg-accent/10 px-3 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/15 disabled:opacity-50"
            >
              <IconifyIcon name="ui-export" size={14} color="currentColor" />
              {actionLabel}
            </button>
            {isVisible && (
              <button
                type="button"
                onClick={() => void hideBrowser()}
                disabled={busy}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border-subtle/50 bg-surface-1/58 px-3 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-surface-2/70 hover:text-text-primary disabled:opacity-50"
              >
                <IconifyIcon name="ui-close" size={13} color="currentColor" />
                {t('chat.hideBrowser', 'Hide browser')}
              </button>
            )}
            <button
              type="button"
              title={t('common.refresh', 'Refresh')}
              aria-label={t('common.refresh', 'Refresh')}
              onClick={() => void refreshState()}
              disabled={busy}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle/50 bg-surface-1/58 text-text-secondary transition-colors hover:bg-surface-2/70 hover:text-text-primary disabled:opacity-50"
            >
              <IconifyIcon name="ui-refresh" size={14} color="currentColor" />
            </button>
          </div>
        </div>
      </div>
    </div>
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
          aria-label={t('chat.selectModelAria', 'Select model')}
          onClick={() => setOpen(!open)}
          className="flex w-full min-w-56 items-center justify-between gap-3 rounded-2xl border border-border-subtle/55 bg-surface-0/70 px-3.5 py-3 text-left shadow-sm transition-all hover:border-accent/18 hover:bg-surface-0/90 focus:border-accent/24 focus:outline-none focus:ring-2 focus:ring-accent/20"
        >
          <div className="min-w-0 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-subtle/45 bg-surface-2/80 text-accent shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <rect x="9" y="9" width="6" height="6" rx="1.5" />
                <path d="M9 2v2M15 2v2M9 20v2M15 20v2M20 9h2M20 15h2M2 9h2M2 15h2" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-text-primary">{current?.name ?? t('chat.selectModel', '-- Select Model --')}</div>
              <div className="truncate text-[11px] text-text-muted/68">{currentProvider || t('chat.availableModelsCount', '{count} available models').replace('{count}', String(models.length))}</div>
            </div>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-text-muted/45"><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-2 w-76 max-h-96 overflow-y-auto rounded-2xl border border-border-subtle/70 bg-surface-2/95 p-2 shadow-2xl backdrop-blur-xl animate-fade-in-scale">
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
  const chatSessions = useMemo(() => sessions.filter(isMainChatSession), [sessions])
  const chatSessionIds = useMemo(() => new Set(chatSessions.map((session) => session.id)), [chatSessions])

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
    <div className="px-5 pt-4 xl:px-6">
      <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-border-subtle/55 bg-surface-1/72 p-1.5 shadow-sm backdrop-blur-xl">
        <span className="pl-2 pr-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">
          {t('chat.tabs', 'Tabs')}
        </span>

        {openSessionTabs.filter((tabId) => chatSessionIds.has(tabId)).map((tabId) => {
          const session = chatSessions.find((item) => item.id === tabId)
          if (!session) return null
          const isActive = activeSessionId === tabId
          const agent = session.agentId ? agents.find((item) => item.id === session.agentId) : null

          return (
            <div
              key={tabId}
              className={`group flex max-w-60 shrink-0 items-center rounded-xl border transition-all duration-200 ${
                isActive
                  ? 'border-accent/22 bg-accent/10 text-text-primary shadow-[0_10px_24px_rgba(var(--t-accent-rgb),0.08)]'
                  : 'border-transparent bg-transparent text-text-muted hover:border-border-subtle/55 hover:bg-surface-0/48 hover:text-text-secondary'
              }`}
            >
              <button
                type="button"
                onClick={() => openSessionTab(tabId)}
                aria-current={isActive ? 'page' : undefined}
                className="min-w-0 flex flex-1 items-center gap-2 px-3 py-2 text-left focus:outline-none"
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
                className="mr-1.5 flex h-7 w-7 items-center justify-center rounded-lg text-text-muted/60 transition-colors hover:bg-danger/10 hover:text-danger"
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
          className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-subtle/50 bg-surface-0/55 text-text-muted transition-all hover:border-accent/18 hover:bg-accent/10 hover:text-accent"
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
          className="flex w-full min-w-56 items-center justify-between gap-3 rounded-2xl border border-border-subtle/55 bg-surface-0/70 px-3.5 py-3 text-left shadow-sm transition-all hover:border-accent/18 hover:bg-surface-0/90 focus:border-accent/24 focus:outline-none focus:ring-2 focus:ring-accent/20"
        >
          <div className="min-w-0 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-subtle/45 bg-surface-2/80 text-accent shadow-sm">
              {current && <AgentAvatar avatar={current.avatar} size={18} />}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-text-primary">{currentLabel ?? t('common.select', 'Select')}</div>
              <div className="truncate text-[11px] text-text-muted/68">{t('chat.agentReady', 'Routing and behavior')}</div>
            </div>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-text-muted/45"><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-2 w-76 max-h-96 overflow-y-auto rounded-2xl border border-border-subtle/70 bg-surface-2/95 p-2 shadow-2xl backdrop-blur-xl animate-fade-in-scale">
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

const ChatMessageRow = memo(function ChatMessageRow({
  message,
  retryLastError,
  resumeFromMessage,
  deleteMessage,
  regenerateMessage,
  updateMessage,
  branchFromMessage,
  setMessageFeedback,
}: {
  message: import('@/types').Message
  retryLastError: () => void
  resumeFromMessage: (messageId: string) => void
  deleteMessage: (messageId: string) => void
  regenerateMessage: (messageId: string) => void
  updateMessage: (messageId: string, patch: Partial<import('@/types').Message>) => void
  branchFromMessage: (messageId: string) => void
  setMessageFeedback: (messageId: string, feedback: 'positive' | 'negative' | undefined) => void
}) {
  const handleRetry = useCallback(() => retryLastError(), [retryLastError])
  const handleResume = useCallback(() => resumeFromMessage(message.id), [message.id, resumeFromMessage])
  const handleDelete = useCallback(() => deleteMessage(message.id), [deleteMessage, message.id])
  const handleRegenerate = useCallback(() => regenerateMessage(message.id), [message.id, regenerateMessage])
  const handleEdit = useCallback((content: string) => updateMessage(message.id, { content }), [message.id, updateMessage])
  const handleTogglePin = useCallback(() => updateMessage(message.id, { pinned: !message.pinned }), [message.id, message.pinned, updateMessage])
  const handleBranch = useCallback(() => branchFromMessage(message.id), [branchFromMessage, message.id])
  const handleFeedback = useCallback((feedback: 'positive' | 'negative' | undefined) => setMessageFeedback(message.id, feedback), [message.id, setMessageFeedback])

  return (
    <MessageBubble
      message={message}
      onRetry={message.isError || message.failedMidStream ? handleRetry : undefined}
      onResume={message.failedMidStream ? handleResume : undefined}
      onDelete={handleDelete}
      onRegenerate={message.role === 'assistant' && !message.isStreaming && !message.failedMidStream ? handleRegenerate : undefined}
      onEdit={message.role === 'user' && !message.isStreaming ? handleEdit : undefined}
      onTogglePin={!message.isStreaming ? handleTogglePin : undefined}
      onBranch={!message.isStreaming ? handleBranch : undefined}
      onFeedback={message.role === 'assistant' ? handleFeedback : undefined}
    />
  )
}, (prevProps, nextProps) => (
  prevProps.message === nextProps.message
  && prevProps.retryLastError === nextProps.retryLastError
  && prevProps.resumeFromMessage === nextProps.resumeFromMessage
  && prevProps.deleteMessage === nextProps.deleteMessage
  && prevProps.regenerateMessage === nextProps.regenerateMessage
  && prevProps.updateMessage === nextProps.updateMessage
  && prevProps.branchFromMessage === nextProps.branchFromMessage
  && prevProps.setMessageFeedback === nextProps.setMessageFeedback
))

function getCurrentChatSession() {
  const state = useAppStore.getState()
  if (!state.activeSessionId) return null
  return state.sessions.find((session) => session.id === state.activeSessionId) ?? null
}

export function ChatMain() {
  const { sessions, activeSessionId, openSessionTabs, updateSession, models, agents, selectedModel, selectedAgent, setSelectedModel, setSelectedAgent, setActiveSession, providerConfigs, addSession, openSessionTab, recordAgentSelectionPreference } = useAppStore()
  const { t, locale } = useI18n()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const [showDebug, setShowDebug] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [isExportingChat, setIsExportingChat] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const { sendMessage, cancelStream, retryLastError, resumeFromMessage, deleteMessage, regenerateMessage, clearMessages, isLoading: isStreaming } = useAIChat()
  const chatSessions = useMemo(() => sessions.filter(isMainChatSession), [sessions])
  const chatSessionIds = useMemo(() => new Set(chatSessions.map((session) => session.id)), [chatSessions])

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
  }, [cancelStream])

  useEffect(() => {
    if (!activeSessionId || chatSessionIds.has(activeSessionId)) return
    setActiveSession(chatSessions[0]?.id ?? null)
  }, [activeSessionId, chatSessionIds, chatSessions, setActiveSession])

  const activeSession = chatSessions.find((s) => s.id === activeSessionId) ?? null
  const messages = activeSession?.messages ?? []
  const hiddenMessageCount = Math.max(0, messages.length - MAX_RENDERED_MESSAGES)
  const visibleMessages = hiddenMessageCount > 0
    ? messages.slice(-MAX_RENDERED_MESSAGES)
    : messages
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
      messagesEndRef.current?.scrollIntoView({ behavior: isStreaming ? 'auto' : 'smooth' })
    }
  }, [isStreaming, messages])

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

  const updateMessage = useCallback((messageId: string, patch: Partial<import('@/types').Message>) => {
    const session = getCurrentChatSession()
    if (!session) return
    useAppStore.getState().updateSession(session.id, {
      messages: session.messages.map((message) => message.id === messageId ? { ...message, ...patch } : message),
      pinnedMessageIds: patch.pinned === undefined
        ? session.pinnedMessageIds
        : patch.pinned
          ? Array.from(new Set([...(session.pinnedMessageIds ?? []), messageId]))
          : (session.pinnedMessageIds ?? []).filter((id) => id !== messageId),
    })
  }, [])

  const branchFromMessage = useCallback((messageId: string) => {
    const session = getCurrentChatSession()
    if (!session) return
    const index = session.messages.findIndex((message) => message.id === messageId)
    if (index < 0) return
    const branchSession: Session = {
      ...session,
      id: generateId('session'),
      title: `${session.title}${t('chat.branchSuffix', ' · branch')}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      parentSessionId: session.id,
      branchOfMessageId: messageId,
      messages: session.messages.slice(0, index + 1).map((message) => ({
        ...message,
        branchRootSessionId: session.id,
      })),
    }
    addSession(branchSession)
    openSessionTab(branchSession.id)
  }, [addSession, openSessionTab, t])

  const setMessageFeedback = useCallback((messageId: string, feedback: 'positive' | 'negative' | undefined) => {
    const session = getCurrentChatSession()
    if (!session) return
    useAppStore.getState().updateSession(session.id, {
      messages: session.messages.map((message) =>
        message.id === messageId ? { ...message, feedback } : message,
      ),
    })
  }, [])

  const handleAgentSelect = useCallback((agent: Agent | null) => {
    setSelectedAgent(agent)
    if (!activeSession) return
    const lastUserMessage = [...activeSession.messages].reverse().find((message) => message.role === 'user' && message.content.trim())
    if (agent && lastUserMessage) recordAgentSelectionPreference(agent.id, lastUserMessage.content)

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
  }, [activeSession, models, recordAgentSelectionPreference, setSelectedAgent, setSelectedModel, updateSession])

  const handleExportChat = useCallback(async (format: ExportFormat, scope: 'all' | 'single', singleMessageId?: string) => {
    if (!activeSession) return
    setShowExportMenu(false)
    setIsExportingChat(true)
    try {
      const result = await exportChat({
        session: activeSession,
        messages: activeSession.messages,
        format,
        scope,
        singleMessageId,
      })
      if (!result.success && result.message) {
        toast.error(t('chat.exportFailed', 'Export failed'), result.message)
      }
    } catch (err) {
      toast.error(t('chat.exportFailed', 'Export failed'), err instanceof Error ? err.message : String(err))
    } finally {
      setIsExportingChat(false)
    }
  }, [activeSession, t])

  useEffect(() => {
    if (!showExportMenu) return
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showExportMenu])

  if (!activeSession) {
    return (
      <div className="module-workspace flex min-h-0 flex-1 min-w-0 flex-col overflow-hidden">
        <div className="module-canvas min-h-0 flex-1 overflow-y-auto px-5 py-5 xl:px-6">
          <div className="mx-auto max-w-384 space-y-4">
            <section className="chat-stage-panel relative overflow-hidden rounded-md border border-border-subtle/45 bg-surface-1/42">
              <div className="relative z-10 grid gap-5 p-4 xl:grid-cols-[minmax(0,1.12fr)_20rem] xl:p-6">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <SurfaceBadge tone="accent">{t('chat.workbench', '企业 AI 工作台')}</SurfaceBadge>
                    <SurfaceBadge>{t('chat.multimodalWorkspace', '文件、语音和智能体路由集中处理')}</SurfaceBadge>
                  </div>

                  <div className="mt-4 max-w-3xl">
                    <h1 className="text-[28px] font-semibold leading-tight text-text-primary xl:text-[32px]">{t('chat.desktopAssistant', 'Suora 内部助手')}</h1>
                    <p className="mt-2 max-w-2xl text-[13px] leading-6 text-text-secondary/80">{t('chat.selectOrCreate', '选择会话或创建新任务，开始处理内部知识问答、流程执行和文档分析。')}</p>
                  </div>

                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
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

                <aside className="space-y-3">
                  <div className="rounded-md border border-border-subtle/40 bg-surface-0/38 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/45">{t('chat.context', '上下文')}</div>
                    <div className="mt-3 grid gap-3">
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
                    {!selectedModel && (
                      <div className="mt-3">
                        <SurfaceBadge tone="warning">
                          <IconifyIcon name="ui-warning" size={13} color="currentColor" />
                          {t('chat.selectModelToChat', 'Please select a model to start chatting')}
                        </SurfaceBadge>
                      </div>
                    )}
                  </div>

                  <BrowserWorkbenchCard />

                  <div className="rounded-md border border-border-subtle/40 bg-surface-0/32 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/45">{t('chat.hints', '提示')}</div>
                    <div className="mt-2 space-y-1.5 text-[12px] leading-5 text-text-secondary/78">
                      <div>{t('chat.pipelineCommandHint', 'Try /pipeline list, or /pipeline run Morning Run')}</div>
                      <div>{t('chat.pasteHint', 'Paste screenshots, drag files, or dictate directly from the composer.')}</div>
                    </div>
                  </div>
                </aside>
              </div>
            </section>

            <section className="rounded-md border border-border-subtle/45 bg-surface-1/38 p-3 xl:p-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <div className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/45">{t('chat.startHere', '开始处理')}</div>
                  <h2 className="mt-1 text-[18px] font-semibold text-text-primary">{t('chat.mainPrompt', '选择一个会话，或从下方输入框发起新的内部任务。')}</h2>
                  <p className="mt-1 text-[12.5px] leading-5 text-text-secondary/78">{t('chat.welcomeBody', '选择智能体与模型后，可以进行知识解释、文档撰写、代码分析或任务拆解，所有上下文都保留在当前工作区。')}</p>
                </div>
                <SurfaceBadge>{t('chat.multimodalWorkspace', '文件、语音和智能体路由集中处理')}</SurfaceBadge>
              </div>

              <div className="mt-3">
                <ChatInput
                  onSend={createSessionAndSend}
                  disabled={false}
                  noModel={!selectedModel}
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="module-workspace flex min-h-0 flex-1 min-w-0 flex-col overflow-hidden">
      {openSessionTabs.length > 1 && <ChatTabBar />}

      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        aria-label={t('chat.messagesAria', 'Chat messages')}
        aria-live="polite"
        className="module-canvas min-h-0 flex-1 overflow-y-auto"
      >
        <div className="sticky top-0 z-20 border-b border-border-subtle/45 bg-surface-0/94 px-5 py-3 xl:px-6">
          <div className="mx-auto max-w-384">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 max-w-3xl">
                <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('chat.liveSession', '当前会话')}</div>
                <h1 className="mt-1 truncate text-[20px] font-semibold text-text-primary">{activeSession.title}</h1>
                <p className="mt-1 line-clamp-1 max-w-2xl text-[12px] leading-5 text-text-secondary/76">{displayAgentGreeting || t('chat.askAnything', 'Ask me anything, or try one of the suggestions below')}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {displayAgentName && <SurfaceBadge tone="accent">{displayAgentName}</SurfaceBadge>}
                  <SurfaceBadge>{sessionModel?.name ?? t('chat.selectModel', '-- Select Model --')}</SurfaceBadge>
                  <SurfaceBadge>{messages.length} {t('sessions.msgs', 'msgs')}</SurfaceBadge>
                  {lastUpdated && <SurfaceBadge>{t('chat.updated', 'Updated')} {lastUpdated}</SurfaceBadge>}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:w-136">
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
                    className="sm:col-span-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border-subtle/45 bg-surface-0/42 px-3 text-[12px] font-semibold text-text-secondary transition-colors hover:border-danger/18 hover:bg-danger/8 hover:text-danger disabled:opacity-35"
                  >
                    <IconifyIcon name="ui-trash" size={15} color="currentColor" />
                    {t('common.clear', 'Clear')}
                  </button>
                )}
                {messages.length > 0 && (
                  <div className="relative sm:col-span-2" ref={exportMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowExportMenu((v) => !v)}
                      disabled={isExportingChat}
                      className="inline-flex w-full min-h-10 items-center justify-center gap-2 rounded-md border border-border-subtle/45 bg-surface-0/42 px-3 text-[12px] font-semibold text-text-secondary transition-colors hover:border-accent/18 hover:bg-accent/8 hover:text-accent disabled:opacity-35"
                    >
                      <IconifyIcon name="ui-export" size={15} color="currentColor" />
                      {isExportingChat ? t('common.exporting', 'Exporting…') : t('chat.exportConversation', 'Export')}
                    </button>
                    {showExportMenu && (
                      <div className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-2xl border border-border-subtle/70 bg-surface-2/95 py-1 shadow-2xl backdrop-blur-xl">
                        <div className="px-3.5 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted/55">{t('chat.exportAllMessages', '完整对话')}</div>
                        {([
                          { format: 'markdown' as ExportFormat, label: 'Markdown (.md)' },
                          { format: 'pdf' as ExportFormat, label: 'PDF (.pdf)' },
                          { format: 'docx' as ExportFormat, label: 'Word (.docx)' },
                        ]).map(({ format, label }) => (
                          <button
                            key={format}
                            type="button"
                            onClick={() => void handleExportChat(format, 'all')}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[12px] text-text-secondary hover:bg-surface-3/55 hover:text-text-primary"
                          >
                            <IconifyIcon name="ui-file" size={13} color="currentColor" />
                            {label}
                          </button>
                        ))}
                        {(() => {
                          const lastAiMsg = [...messages].reverse().find((m) => m.role === 'assistant' && !m.isStreaming && m.content.trim())
                          if (!lastAiMsg) return null
                          return (
                            <>
                              <div className="mx-3 my-1.5 border-t border-border-subtle/40" />
                              <div className="px-3.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted/55">{t('chat.exportLastReply', '最后一条回复')}</div>
                              {([
                                { format: 'markdown' as ExportFormat, label: 'Markdown (.md)' },
                                { format: 'pdf' as ExportFormat, label: 'PDF (.pdf)' },
                                { format: 'docx' as ExportFormat, label: 'Word (.docx)' },
                              ]).map(({ format, label }) => (
                                <button
                                  key={`single-${format}`}
                                  type="button"
                                  onClick={() => void handleExportChat(format, 'single', lastAiMsg.id)}
                                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[12px] text-text-secondary hover:bg-surface-3/55 hover:text-text-primary"
                                >
                                  <IconifyIcon name="ui-file" size={13} color="currentColor" />
                                  {label}
                                </button>
                              ))}
                            </>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {!sessionModel && (
              <div className="mt-3">
                <SurfaceBadge tone="warning">
                  <IconifyIcon name="ui-warning" size={13} color="currentColor" />
                  {t('chat.selectModelToChat', 'Please select a model to start chatting')}
                </SurfaceBadge>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-4 pt-4 xl:px-6">
          <div className="mx-auto max-w-384">
            {messages.length === 0 ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
                <section className="chat-stage-panel relative overflow-hidden rounded-md border border-border-subtle/45 bg-surface-1/42">
                  <div className="relative z-10 p-4 xl:p-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-accent/10 text-accent">
                      <AgentAvatar avatar={sessionAgent?.avatar ?? 'ui-sparkles'} size={32} />
                    </div>
                    <div className="mt-4 max-w-2xl">
                      <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('chat.readyWhenYouAre', '就绪')}</div>
                      <h2 className="mt-1.5 text-[22px] font-semibold text-text-primary">{displayAgentName || t('chat.howCanIHelp', 'How can I help you today?')}</h2>
                      <p className="mt-2 text-[13px] leading-5 text-text-secondary/78">{displayAgentGreeting || t('chat.askAnything', 'Ask me anything, or try one of the suggestions below')}</p>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
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

                <aside>
                  <div className="space-y-3 xl:sticky xl:top-4">
                    <div className="rounded-md border border-border-subtle/35 bg-surface-1/34 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('chat.context', '上下文')}</div>
                      <div className="mt-3 flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-2/70">
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

                    <BrowserWorkbenchCard />

                    <div className="rounded-md border border-border-subtle/35 bg-surface-1/34 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('chat.hints', '提示')}</div>
                      <div className="mt-2 space-y-1.5 text-[12px] leading-5 text-text-secondary/78">
                        <div>{t('chat.pipelineCommandHint', 'Try /pipeline list, or /pipeline run Morning Run')}</div>
                        <div>{t('chat.pasteHint', 'Paste screenshots, drag files, or dictate directly from the composer.')}</div>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            ) : (
              <div>
                <section className="relative overflow-visible">
                  <div className="relative z-10 px-1 py-1 sm:px-2 xl:px-3">
                    <TodoProgress />
                    {hiddenMessageCount > 0 && (
                      <div className="mb-3 rounded-2xl border border-amber-500/18 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-200">
                        {t('chat.hiddenOlderMessages', '{count} older messages are hidden to keep long chats responsive.').replace('{count}', hiddenMessageCount.toLocaleString())}
                      </div>
                    )}
                    <div className="space-y-0.5">
                      {visibleMessages.map((msg) => (
                        <ChatMessageRow
                          key={msg.id}
                          message={msg}
                          retryLastError={retryLastError}
                          resumeFromMessage={resumeFromMessage}
                          deleteMessage={deleteMessage}
                          regenerateMessage={regenerateMessage}
                          updateMessage={updateMessage}
                          branchFromMessage={branchFromMessage}
                          setMessageFeedback={setMessageFeedback}
                        />
                      ))}
                    </div>
                    <div ref={messagesEndRef} />
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>

      <StreamingStatus isStreaming={isStreaming} messages={messages} />

      {messages.length > 0 && (
        <div className="px-5 pb-2 xl:px-6">
          <div className="mx-auto max-w-384">
            <BrowserWorkbenchCard density="bar" />
          </div>
        </div>
      )}

      <div className="px-5 pb-5 xl:px-6">
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
