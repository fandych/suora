import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'
import { generateId } from '@/utils/helpers'
import { getToolsForAgent, getSkillSystemPrompts, mergeSkillsWithBuiltins, buildSystemPrompt } from '@/services/tools'
import { streamResponseWithTools, initializeProvider, validateModelConfig } from '@/services/aiService'
import { AgentAvatar, IconifyIcon } from '@/components/icons/IconifyIcons'
import type { Agent, Message } from '@/types'
import type { ModelMessage, UserModelMessage, AssistantModelMessage } from 'ai'

function HarnessStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-3xl border px-4 py-3 ${accent ? 'border-accent/18 bg-accent/10' : 'border-border-subtle/55 bg-surface-0/65'}`}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{label}</div>
      <div className={`mt-2 text-lg font-semibold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</div>
    </div>
  )
}

export function AgentTestChat({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const { t } = useI18n()
  const { models, skills } = useAppStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const activeModel = useMemo(() => {
    return agent.modelId
      ? models.find((model) => model.id === agent.modelId)
      : models.find((model) => model.isDefault) ?? models[0]
  }, [agent.modelId, models])

  const userMessages = useMemo(() => messages.filter((message) => message.role === 'user').length, [messages])
  const toolCount = agent.skills.length

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    const model = activeModel

    if (!model) {
      setMessages((prev) => [...prev, { id: generateId('msg'), role: 'assistant', content: t('agents.noModelConfigured', 'No model configured. Please select a model for this agent.'), timestamp: Date.now(), isError: true }])
      return
    }

    const validation = validateModelConfig(model)
    if (!validation.valid) {
      setMessages((prev) => [...prev, { id: generateId('msg'), role: 'assistant', content: `${validation.error}`, timestamp: Date.now(), isError: true }])
      return
    }

    const userMsg: Message = { id: generateId('msg'), role: 'user', content: text, timestamp: Date.now() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      initializeProvider(model.providerType, model.apiKey || 'ollama', model.baseUrl, model.provider)
    } catch {
      setMessages((prev) => [...prev, { id: generateId('msg'), role: 'assistant', content: t('agents.providerFailed', 'Failed to initialize provider.'), timestamp: Date.now(), isError: true }])
      setIsStreaming(false)
      return
    }

    const modelIdentifier = `${model.provider}:${model.modelId}`
    const allMsgs: Message[] = [...messages, userMsg]
    const modelMessages: ModelMessage[] = allMsgs.map((m) =>
      m.role === 'user'
        ? { role: 'user', content: m.content } satisfies UserModelMessage
        : { role: 'assistant', content: m.content } satisfies AssistantModelMessage
    )

    const mergedSkills = mergeSkillsWithBuiltins(skills)
    const filteredTools = getToolsForAgent(agent.skills, mergedSkills, {
      allowedTools: agent.allowedTools,
      disallowedTools: agent.disallowedTools,
      permissionMode: agent.permissionMode,
    })

    const skillPrompts = await getSkillSystemPrompts(agent.skills, mergedSkills)
    const systemPrompt = buildSystemPrompt({
      agentPrompt: agent.systemPrompt,
      responseStyle: agent.responseStyle,
      memories: agent.memories,
      skillPrompts,
      toolNames: Object.keys(filteredTools),
      permissionMode: agent.permissionMode,
    })

    const assistantId = generateId('msg')
    let fullContent = ''
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true }])

    try {
      for await (const event of streamResponseWithTools(modelIdentifier, modelMessages, {
        systemPrompt,
        tools: filteredTools,
        maxSteps: Math.max(2, Math.min(agent.maxTurns ?? 5, 30)),
        abortSignal: abortController.signal,
        apiKey: model.apiKey,
        baseUrl: model.baseUrl,
      })) {
        if (event.type === 'text-delta') {
          fullContent += event.text
          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: fullContent } : m))
        } else if (event.type === 'error') {
          fullContent += `\n${event.error}`
          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: fullContent, isError: true } : m))
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        fullContent += `\n${(err as Error).message}`
      }
    }

    setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: fullContent || '(empty response)', isStreaming: false } : m))
    setIsStreaming(false)
    abortRef.current = null
  }, [activeModel, input, isStreaming, messages, agent, skills, t])

  return (
    <div className="flex h-full flex-col border-l border-border-subtle/60 bg-linear-to-b from-surface-1/96 via-surface-1/88 to-surface-0">
      <div className="border-b border-border-subtle/60 px-4 py-3">
        <div className="rounded-4xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/94 to-surface-2/72 p-5 shadow-[0_20px_54px_rgba(var(--t-accent-rgb),0.08)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl border border-accent/12 bg-surface-0/72 shadow-sm">
                <AgentAvatar avatar={agent.avatar} size={28} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('common.test', 'Test')}</div>
                <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-text-primary">{agent.name}</h2>
                <p className="mt-2 text-[13px] leading-6 text-text-secondary/82">{agent.greeting || t('agents.testHarnessHint', 'Run quick prompts against this agent using its configured tools, prompt, and model selection.')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMessages([])}
                title={t('agents.clearMessages', 'Clear messages')}
                className="rounded-2xl border border-border-subtle/55 bg-surface-0/72 px-3 py-2 text-[11px] font-semibold text-text-secondary transition-colors hover:bg-surface-2"
              >
                {t('common.clear', 'Clear')}
              </button>
              {isStreaming && (
                <button
                  type="button"
                  onClick={stopStreaming}
                  className="rounded-2xl border border-amber-500/18 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-400 transition-colors hover:bg-amber-500/16"
                >
                  {t('common.stop', 'Stop')}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                title={t('agents.closeTestPanel', 'Close test panel')}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border-subtle/55 bg-surface-0/72 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
              >
                <IconifyIcon name="ui-close" size={16} color="currentColor" />
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <HarnessStat label={t('common.model', 'Model')} value={activeModel?.name || t('common.none', 'None')} accent />
            <HarnessStat label={t('common.messages', 'Messages')} value={String(messages.length)} />
            <HarnessStat label={t('skills.title', 'Skills')} value={String(toolCount)} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div ref={scrollRef} className="space-y-4">
          {messages.length === 0 ? (
            <div className="rounded-4xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-5 py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-3xl border border-border-subtle/45 bg-surface-2/65 text-text-muted/60">
                <IconifyIcon name="action-chat" size={18} color="currentColor" />
              </div>
              <h3 className="text-[15px] font-semibold text-text-primary">{t('agents.beginSimulation', 'Begin a simulation')}</h3>
              <p className="mt-2 text-[12px] leading-6 text-text-muted">{agent.greeting || t('agents.beginSimulationHint', 'Type a prompt below to test system prompt behavior, tool access, and response style before using this agent in a real session.')}</p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] rounded-3xl border px-4 py-3 text-[13px] leading-6 whitespace-pre-wrap wrap-break-word shadow-[0_10px_24px_rgba(15,23,42,0.05)] ${
                  message.role === 'user'
                    ? 'border-accent/18 bg-accent/10 text-text-primary'
                    : message.isError
                      ? 'border-red-500/18 bg-red-500/8 text-red-400'
                      : 'border-border-subtle/55 bg-surface-0/55 text-text-secondary'
                }`}>
                  {message.content || (message.isStreaming ? <span className="inline-block h-4 w-2 rounded-sm bg-accent/60 animate-pulse" /> : '')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="border-t border-border-subtle/60 px-4 py-4">
        <div className="rounded-4xl border border-border-subtle/55 bg-surface-0/72 p-4 shadow-[0_16px_38px_rgba(15,23,42,0.08)]">
          <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-text-muted/75">
            <span>{t('common.ready', 'Ready')}: {activeModel ? activeModel.name : t('common.none', 'None')}</span>
            <span>{t('common.messages', 'Messages')}: {messages.length}</span>
            <span>{t('common.user', 'User')}: {userMessages}</span>
          </div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  void sendMessage()
                }
              }}
              placeholder={t('agents.testMessage', 'Type a test message...')}
              disabled={isStreaming}
              className="flex-1 rounded-2xl border border-border-subtle/55 bg-surface-2/80 px-3.5 py-3 text-sm text-text-primary placeholder-text-muted/55 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={isStreaming || !input.trim()}
              className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(var(--t-accent-rgb),0.22)] transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              {isStreaming ? t('common.waiting', 'Working…') : t('common.send', 'Send')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
