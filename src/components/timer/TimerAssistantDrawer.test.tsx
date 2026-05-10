import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store/appStore'
import type { Message, Model, ToolCall } from '@/types'
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
    })
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