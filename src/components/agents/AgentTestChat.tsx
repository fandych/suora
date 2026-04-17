import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'
import { generateId } from '@/utils/helpers'
import { getToolsForAgent, getSkillSystemPrompts, mergeSkillsWithBuiltins, buildSystemPrompt } from '@/services/tools'
import { streamResponseWithTools, initializeProvider, validateModelConfig } from '@/services/aiService'
import { AgentAvatar, IconifyIcon } from '@/components/icons/IconifyIcons'
import type { Agent, Message } from '@/types'
import type { ModelMessage, UserModelMessage, AssistantModelMessage } from 'ai'

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

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    const model = agent.modelId
      ? models.find((m) => m.id === agent.modelId)
      : models.find((m) => m.isDefault) ?? models[0]

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
  }, [input, isStreaming, messages, agent, models, skills])

  return (
    <div className="flex flex-col h-full border-l border-border bg-surface-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface-1/50">
        <div className="flex items-center gap-2">
          <AgentAvatar avatar={agent.avatar} size={20} />
          <span className="text-sm font-medium text-text-primary">{t('common.test', 'Test')}: {agent.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMessages([])} title={t('agents.clearMessages', 'Clear messages')} className="text-text-muted hover:text-text-secondary text-xs px-2 py-1 rounded-lg hover:bg-surface-3 transition-colors">{t('common.clear', 'Clear')}</button>
          <button onClick={onClose} title={t('agents.closeTestPanel', 'Close test panel')} className="text-text-muted hover:text-danger text-xs px-2 py-1 rounded-lg hover:bg-surface-3 transition-colors"><IconifyIcon name="ui-close" size={14} color="currentColor" /></button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {agent.greeting && messages.length === 0 && (
          <div className="px-3 py-2 rounded-xl bg-surface-2 text-sm text-text-secondary">{agent.greeting}</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-accent/15 text-text-primary'
                : m.isError
                  ? 'bg-danger/10 text-danger'
                  : 'bg-surface-2 text-text-secondary'
            }`}>
              {m.content || (m.isStreaming ? <span className="inline-block w-2 h-4 bg-accent/60 animate-pulse rounded-sm" /> : '')}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border-subtle">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); sendMessage() } }}
            placeholder={t('agents.testMessage', 'Type a test message...')}
            disabled={isStreaming}
            className="flex-1 px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
            className="px-3 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {isStreaming ? '...' : '→'}
          </button>
        </div>
      </div>
    </div>
  )
}
