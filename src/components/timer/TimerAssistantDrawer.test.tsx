import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TIMER_BUILDER_AGENT_ID, useAppStore } from '@/store/appStore'
import type { Agent, Message, Model, ToolCall } from '@/types'
import { TimerAssistantDrawer } from './TimerAssistantDrawer'

const mockAIChat = {
  sendMessage: vi.fn(),
  cancelStream: vi.fn(),
  retryLastError: vi.fn(),
  deleteMessage: vi.fn(),
  regenerateMessage: vi.fn(),
  clearMessages: vi.fn(),
  isLoading: false,
}

vi.mock('@/hooks/useAIChat', () => ({
  useAIChat: () => mockAIChat,
}))

vi.mock('@/components/chat/ChatInput', () => ({
  ChatInput: () => <div>chat-input</div>,
}))

vi.mock('@/components/chat/ChatMessages', () => ({
  MessageBubble: ({ message }: { message: Message }) => <div>{message.content}</div>,
}))

describe('TimerAssistantDrawer', () => {
  const model: Model = {
    id: 'model-1',
    name: 'GPT Test',
    provider: 'openai',
    providerType: 'openai',
    modelId: 'gpt-4.1',
    enabled: true,
  }
  const timerBuilder: Agent = {
    id: TIMER_BUILDER_AGENT_ID,
    name: 'Timer builder',
    avatar: 'agent-devops',
    color: '#F97316',
    whenToUse: 'Use inside the Timer module to turn natural-language scheduling requests into saved timers, update existing timers, and keep the work focused on timer structure instead of completing the end task directly.',
    systemPrompt: '',
    modelId: '',
    skills: [],
    temperature: 0.2,
    maxTokens: 4096,
    maxTurns: 24,
    enabled: true,
    greeting: 'Ready to build timers.',
    responseStyle: 'balanced',
    allowedTools: ['timer_list', 'timer_add', 'timer_update', 'timer_remove', 'pipeline_list'],
    disallowedTools: [],
    permissionMode: 'acceptEdits',
    memories: [],
    autoLearn: true,
  }

  beforeEach(() => {
    localStorage.clear()
    mockAIChat.sendMessage.mockReset()
    mockAIChat.cancelStream.mockReset()
    mockAIChat.retryLastError.mockReset()
    mockAIChat.deleteMessage.mockReset()
    mockAIChat.regenerateMessage.mockReset()
    mockAIChat.clearMessages.mockReset()
    useAppStore.setState({
      sessions: [],
      activeSessionId: null,
      openSessionTabs: [],
      models: [model],
      selectedModel: model,
      selectedAgent: null,
      agents: [timerBuilder],
    })
    useAppStore.getState().setLocale('en')
  })

  it('binds the drawer session to the dedicated timer builder agent and includes cron guidance', async () => {
    render(
      <TimerAssistantDrawer
        mode="create"
        onClose={vi.fn()}
      />,
    )

    await waitFor(() => expect(useAppStore.getState().sessions).toHaveLength(1))
    expect(useAppStore.getState().sessions[0]?.agentId).toBe(TIMER_BUILDER_AGENT_ID)
    expect(useAppStore.getState().sessions[0]?.contextPrompt).toContain('"cron"')
  })

  it('notifies once when a completed timer tool call is observed', async () => {
    const onTimerMutated = vi.fn()

    render(
      <TimerAssistantDrawer
        mode="create"
        onClose={vi.fn()}
        onTimerMutated={onTimerMutated}
      />,
    )

    await waitFor(() => expect(useAppStore.getState().sessions).toHaveLength(1))
    expect(useAppStore.getState().activeSessionId).toBeNull()
    expect(useAppStore.getState().sessions[0]?.surface).toBe('timer-assistant')

    const sessionId = useAppStore.getState().sessions[0].id
    const completedToolCall: ToolCall = {
      id: 'tool-1',
      toolName: 'timer_add',
      input: { name: 'Morning report' },
      status: 'completed',
      startedAt: Date.now(),
      completedAt: Date.now(),
    }
    const assistantMessage: Message = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Created timer',
      timestamp: Date.now(),
      toolCalls: [completedToolCall],
    }

    useAppStore.getState().updateSession(sessionId, {
      messages: [assistantMessage],
    })

    await waitFor(() => expect(onTimerMutated).toHaveBeenCalledTimes(1))

    useAppStore.getState().updateSession(sessionId, {
      messages: [{
        ...assistantMessage,
        content: 'Created timer successfully',
      }],
    })

    await waitFor(() => expect(onTimerMutated).toHaveBeenCalledTimes(1))
  })
})