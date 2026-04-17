import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/appStore'
import { generateId } from '@/utils/helpers'
import type { Session } from '@/types'
import { useAIChat } from '@/hooks/useAIChat'
import { AgentAvatar, IconifyIcon } from '@/components/icons/IconifyIcons'
import { useI18n } from '@/hooks/useI18n'
import { MessageBubble } from './ChatMessages'
import { ChatInput } from './ChatInput'
import { TodoProgress } from './TodoProgress'

// ─── Chat Tab Bar ──────────────────────────────────────────────────

function ChatTabBar() {
  const { sessions, activeSessionId, openSessionTabs, openSessionTab, closeSessionTab, agents, addSession, selectedModel, selectedAgent } = useAppStore()
  const { t } = useI18n()

  const handleNewTab = () => {
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
    <div className="flex items-center gap-1 px-3 h-12 border-b border-border-subtle/40 bg-surface-1/30 shrink-0 overflow-x-auto scrollbar-none">
      {openSessionTabs.map((tabId) => {
        const session = sessions.find((s) => s.id === tabId)
        if (!session) return null
        const isActive = activeSessionId === tabId
        const agent = session.agentId ? agents.find((a) => a.id === session.agentId) : null
        return (
          <div
            key={tabId}
            onClick={() => openSessionTab(tabId)}
            className={`group flex items-center gap-2 px-4 py-2 rounded-t-[14px] cursor-pointer text-[12.5px] max-w-52 shrink-0 transition-all duration-150 border border-b-0 ${
              isActive
                ? 'bg-surface-1/80 text-text-primary border-border-subtle/50'
                : 'bg-transparent text-text-muted hover:text-text-secondary hover:bg-surface-2/30 border-transparent'
            }`}
          >
            {agent && <span className="text-[10px]"><AgentAvatar avatar={agent.avatar} size={14} /></span>}
            <span className="truncate font-medium">{session.title}</span>
            <button
              type="button"
              title="Close tab"
              onClick={(e) => { e.stopPropagation(); closeSessionTab(tabId) }}
              className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger text-[11px] ml-1 rounded hover:bg-danger/10 w-5 h-5 flex items-center justify-center transition-all shrink-0"
            >
              <IconifyIcon name="ui-close" size={15} color="currentColor" />
            </button>
          </div>
        )
      })}
      <button
        type="button"
        onClick={handleNewTab}
        title="New chat tab"
        className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-3/30 transition-colors shrink-0 ml-1"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>
  )
}

// ─── Agent Dropdown (with icons) ───────────────────────────────────

function AgentDropdown({ agents, selectedAgentId, onSelect }: {
  agents: import('@/types').Agent[]
  selectedAgentId: string
  onSelect: (agent: import('@/types').Agent | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const enabledAgents = agents.filter((a) => a.enabled)
  const current = enabledAgents.find((a) => a.id === selectedAgentId) ?? enabledAgents[0] ?? null

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="flex items-center gap-2" ref={ref}>
      <span className="font-display text-[10px] text-text-muted/50 uppercase tracking-[0.14em] font-semibold">Agent</span>
      <div className="relative">
        <button
          type="button"
          aria-label="Select agent"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-3.5 py-2.5 text-[12.5px] rounded-xl bg-surface-2/50 border border-border-subtle/60 text-text-secondary hover:border-border/80 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
        >
          {current && <AgentAvatar avatar={current.avatar} size={18} />}
          <span className="max-w-32 truncate font-medium">{current?.name ?? 'Select'}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-40"><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-2 w-56 max-h-80 overflow-y-auto bg-surface-2/95 backdrop-blur-xl border border-border-subtle/70 rounded-[14px] shadow-2xl z-50 py-1.5 animate-fade-in-scale">
            {enabledAgents.map((a) => (
              <button
                type="button"
                key={a.id}
                onClick={() => { onSelect(a); setOpen(false) }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-[12.5px] text-left transition-colors hover:bg-surface-3/50 ${
                  a.id === selectedAgentId ? 'text-accent bg-accent/6' : 'text-text-secondary'
                }`}
              >
                <AgentAvatar avatar={a.avatar} size={18} />
                <span className="truncate font-medium">{a.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Chat Main Area ────────────────────────────────────────────────

export function ChatMain() {
  const { sessions, activeSessionId, openSessionTabs, updateSession, models, agents, selectedModel, selectedAgent, setSelectedModel, setSelectedAgent, providerConfigs, addSession, openSessionTab } = useAppStore()
  const { t } = useI18n()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const { sendMessage, cancelStream, retryLastError, deleteMessage, regenerateMessage, clearMessages, isLoading: isStreaming } = useAIChat()

  // Wrap sendMessage so that sending a new user message always re-pins the
  // scroll to the bottom (even if the user was scrolled up reading history).
  const handleSend = useCallback(
    (text: string, attachments?: Parameters<typeof sendMessage>[1]) => {
      isNearBottomRef.current = true
      return sendMessage(text, attachments)
    },
    [sendMessage],
  )

  // Cancel stream when active session changes while streaming
  useEffect(() => {
    return () => { cancelStream() }
  }, [activeSessionId, cancelStream])

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null
  const messages = activeSession?.messages ?? []

  // Determine current model and agent (for toolbar display only)
  const defaultAgent = agents.find((a) => a.id === 'default-assistant')
  const sessionAgent = activeSession?.agentId
    ? agents.find((a) => a.id === activeSession.agentId)
    : (selectedAgent ?? defaultAgent ?? null)
  const sessionModel = activeSession?.modelId
    ? models.find((m) => m.id === activeSession.modelId)
    : sessionAgent?.modelId
      ? models.find((m) => m.id === sessionAgent.modelId)
      : selectedModel

  // Reset auto-scroll when switching sessions so new session starts pinned.
  useEffect(() => {
    isNearBottomRef.current = true
  }, [activeSessionId])

  // Track whether the user is currently near the bottom of the message list.
  // Only auto-scroll on message changes when near bottom — this prevents
  // mid-stream token deltas from yanking the view while the user scrolls up.
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

  if (!activeSession) {
    const starterPrompts = [
      t('chat.starterPrompt1', 'Summarize a webpage or document'),
      t('chat.starterPrompt2', 'Write a Python script for...'),
      t('chat.starterPrompt3', 'Explain this code block to me'),
      t('chat.starterPrompt4', 'Draft an email about...'),
    ]
    const startWithPrompt = (prompt: string) => {
      const session: Session = {
        id: generateId('session'),
        title: prompt.slice(0, 40),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        agentId: selectedAgent?.id,
        modelId: selectedModel?.id,
        messages: [],
      }
      addSession(session)
      openSessionTab(session.id)
      // Defer sending until the new session is active so useAIChat picks it up.
      setTimeout(() => {
        handleSend(prompt)
      }, 0)
    }
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted">
        <div className="text-center animate-fade-in">
          <div className="w-24 h-24 rounded-[26px] bg-linear-to-br from-accent/15 via-accent/8 to-transparent flex items-center justify-center mx-auto mb-8 border border-accent/10 glow-accent">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent/80"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <p className="font-display text-3xl text-text-primary font-semibold tracking-tight">{t('chat.desktopAssistant', 'Suora')}</p>
          <p className="text-[15px] text-text-muted mt-3 max-w-sm mx-auto leading-relaxed">{t('chat.selectOrCreate', 'Select or create a conversation to begin')}</p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto px-4">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => startWithPrompt(prompt)}
                className="text-left text-[13px] px-4 py-3 rounded-xl border border-border-subtle/50 bg-surface-1/50 text-text-secondary hover:border-accent/30 hover:bg-accent/5 hover:text-text-primary transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Tab Bar */}
      {openSessionTabs.length > 1 && <ChatTabBar />}

      {/* Top Toolbar */}
      <div className="h-16 px-6 flex items-center gap-5 border-b border-border-subtle/40 shrink-0 bg-surface-1/40 backdrop-blur-xl">
        {/* Agent Selector */}
        <AgentDropdown
          agents={agents}
          selectedAgentId={sessionAgent?.id ?? defaultAgent?.id ?? ''}
          onSelect={(agent) => {
            setSelectedAgent(agent)
            if (activeSession) {
              updateSession(activeSession.id, { agentId: agent?.id })
            }
          }}
        />

        <div className="w-px h-5 bg-border-subtle/40" />

        {/* Model Selector */}
        <div className="flex items-center gap-2">
          <span className="font-display text-[10px] text-text-muted/50 uppercase tracking-[0.14em] font-semibold">{t('chat.model', 'Model')}</span>
          <select
            aria-label="Select model"
            value={sessionModel?.id ?? ''}
            onChange={(e) => {
              const model = models.find((m) => m.id === e.target.value) ?? null
              setSelectedModel(model)
              if (activeSession) {
                updateSession(activeSession.id, { modelId: model?.id })
              }
            }}
            className="px-3.5 py-2.5 text-[12.5px] rounded-xl bg-surface-2/50 border border-border-subtle/60 text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/20 hover:border-border/80 transition-all font-medium"
          >
            <option value="">{t('chat.selectModel', '-- Select Model --')}</option>
            {models.filter((m) => m.enabled).map((m) => {
              const providerName = providerConfigs.find((p) => p.id === m.provider)?.name || m.provider
              return <option key={m.id} value={m.id}>{providerName} / {m.name}</option>
            })}
          </select>
        </div>

        {/* Clear conversation */}
        {messages.length > 0 && (
          <>
            <div className="w-px h-5 bg-border-subtle/40 ml-auto" />
            <button
              type="button"
              onClick={clearMessages}
              disabled={isStreaming}
              title={t('chat.clearConversation', 'Clear conversation')}
              className="text-[12px] px-3.5 py-2 rounded-xl text-text-muted hover:text-danger hover:bg-danger/8 disabled:opacity-30 transition-all font-medium inline-flex items-center gap-2"
            >
              <IconifyIcon name="ui-trash" size={15} color="currentColor" /> {t('common.clear', 'Clear')}
            </button>
          </>
        )}
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        className="flex-1 overflow-y-auto px-10 py-10 relative"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted">
            <div className="text-center animate-fade-in max-w-2xl">
              <div className="w-20 h-20 rounded-[22px] bg-linear-to-br from-accent/15 via-accent/8 to-transparent flex items-center justify-center mx-auto mb-7 border border-accent/10 glow-accent">
                <AgentAvatar avatar={sessionAgent?.avatar ?? 'ui-sparkles'} size={32} />
              </div>
              {sessionAgent?.greeting ? (
                <>
                  <p className="font-display text-2xl text-text-primary font-semibold tracking-tight mb-3">{sessionAgent.name}</p>
                  <p className="text-[15px] text-text-secondary leading-relaxed max-w-xl mx-auto">{sessionAgent.greeting}</p>
                </>
              ) : (
                <>
                  <p className="font-display text-[32px] text-text-primary font-semibold tracking-tight leading-tight">{t('chat.howCanIHelp', 'How can I help you today?')}</p>
                  <p className="text-[15px] text-text-muted mt-3 max-w-lg mx-auto leading-relaxed">{t('chat.askAnything', 'Ask me anything, or try one of the suggestions below')}</p>
                </>
              )}
              {!sessionModel && (
                <p className="text-[12px] text-warning mt-4 bg-warning/8 px-4 py-2 rounded-xl inline-flex items-center gap-2 border border-warning/10"><IconifyIcon name="ui-warning" size={13} color="currentColor" /> {t('chat.selectModelToChat', 'Please select a model to start chatting')}</p>
              )}
              {/* Suggestion chips */}
              {sessionModel && (
                <div className="mt-10 flex flex-wrap justify-center gap-3">
                  {[
                    { icon: 'ui-lightbulb', label: 'Explain a concept', prompt: 'Please explain a concept to me. What topic would you like to learn about?' },
                    { icon: 'ui-memo', label: 'Help me write', prompt: 'I need help writing something. What kind of content would you like me to help with?' },
                    { icon: 'ui-search', label: 'Analyze code', prompt: 'I can help analyze code. Please share the code you would like me to review.' },
                    { icon: 'ui-clipboard', label: 'Create a todo list', prompt: 'Help me create a todo list for my current tasks. What project or area should I help you plan?' },
                  ].map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion.label}
                      onClick={() => handleSend(suggestion.prompt)}
                      disabled={isStreaming}
                      className="px-5 py-3.5 rounded-2xl bg-surface-2/40 border border-border-subtle/50 text-[14px] text-text-secondary hover:text-text-primary hover:bg-surface-3/40 hover:border-accent/15 hover:shadow-[0_2px_12px_rgba(var(--t-accent-rgb),0.06)] transition-all duration-200 flex items-center gap-2.5 disabled:opacity-40 font-medium"
                    >
                      <span className="text-text-muted"><IconifyIcon name={suggestion.icon} size={18} color="currentColor" /></span>
                      <span>{suggestion.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <TodoProgress />
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onRetry={msg.isError ? () => retryLastError() : undefined}
                onDelete={() => deleteMessage(msg.id)}
                onRegenerate={msg.role === 'assistant' && !msg.isStreaming ? () => regenerateMessage(msg.id) : undefined}
                onFeedback={msg.role === 'assistant' ? (fb) => {
                  const session = sessions.find((s) => s.id === activeSessionId)
                  if (!session) return
                  const updatedMessages = session.messages.map((m) =>
                    m.id === msg.id ? { ...m, feedback: fb } : m
                  )
                  updateSession(session.id, { messages: updatedMessages })
                } : undefined}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Streaming status strip — surfaces tool-call progress during generation */}
      <StreamingStatus isStreaming={isStreaming} messages={messages} />

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={isStreaming}
        isStreaming={isStreaming}
        onStop={cancelStream}
        noModel={!sessionModel}
      />
    </div>
  )
}

// ─── Streaming Status Strip ────────────────────────────────────────
// Shows a thin, unobtrusive indicator while the AI is generating. If the
// latest assistant message has a running/pending tool call, surface the tool
// name so users understand that the assistant is working, not frozen.

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
    <div
      role="status"
      aria-live="polite"
      className="px-4 py-1.5 text-[11.5px] text-text-muted flex items-center gap-2 border-t border-border-subtle/40 bg-surface-1/40"
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent/60 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>
      <span className="truncate">{label}</span>
    </div>
  )
}
