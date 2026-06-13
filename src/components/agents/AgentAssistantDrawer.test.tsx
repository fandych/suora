import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AGENT_BUILDER_AGENT_ID, useAppStore } from '@/store/appStore'
import type { Agent, Message, Model, ToolCall } from '@/types'
import { AgentAssistantDrawer } from './AgentAssistantDrawer'

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

describe('AgentAssistantDrawer', () => {
  const model: Model = {
    id: 'model-1',
    name: 'GPT Test',
    provider: 'openai',
    providerType: 'openai',
    modelId: 'gpt-4.1',
    enabled: true,
  }

  const agent: Agent = {
    id: 'agent-1',
    name: 'Launch Planner',
    systemPrompt: 'Plan launches with explicit milestones.',
    modelId: 'model-1',
    skills: ['skill-1'],
    enabled: true,
    allowedTools: ['agent_list'],
    memories: [],
    autoLearn: false,
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
      skills: [{ id: 'skill-1', name: 'Launch Skill', description: 'Help with launches.', enabled: true, source: 'local', content: 'Help with launches.', frontmatter: { name: 'Launch Skill', description: 'Help with launches.' }, context: 'inline' }],
      agents: [
        { id: AGENT_BUILDER_AGENT_ID, name: 'Agent builder', systemPrompt: '', modelId: 'model-1', enabled: true, skills: [], memories: [], autoLearn: false, allowedTools: ['agent_list', 'agent_add', 'agent_update', 'agent_remove'] },
        agent,
      ],
    })
    useAppStore.getState().setLocale('en')
  })

  it('binds the drawer session to the dedicated agent builder agent', async () => {
    render(
      <AgentAssistantDrawer
        mode="create"
        onClose={vi.fn()}
      />,
    )

    await waitFor(() => expect(useAppStore.getState().sessions).toHaveLength(1))
    expect(useAppStore.getState().sessions[0]?.agentId).toBe(AGENT_BUILDER_AGENT_ID)
  })

  it('renders the create drawer in Chinese when locale is zh', async () => {
    useAppStore.getState().setLocale('zh')

    render(
      <AgentAssistantDrawer
        mode="create"
        onClose={vi.fn()}
      />,
    )

    await waitFor(() => expect(useAppStore.getState().sessions).toHaveLength(1))
    expect(screen.getByRole('dialog', { name: '智能体助手' })).toBeInTheDocument()
    expect(screen.getByText('AI 创建智能体')).toBeInTheDocument()
    expect(screen.getByText('使用自然语言创建或修改已保存智能体。执行更改前需要先确认。')).toBeInTheDocument()
    expect(screen.getByText('描述你想创建的智能体')).toBeInTheDocument()
  })

  it('notifies once when a completed agent tool call is observed', async () => {
    const onAgentMutated = vi.fn()

    render(
      <AgentAssistantDrawer
        mode="edit"
        agent={agent}
        onClose={vi.fn()}
        onAgentMutated={onAgentMutated}
      />,
    )

    await waitFor(() => expect(useAppStore.getState().sessions).toHaveLength(1))
    expect(useAppStore.getState().sessions[0]?.surface).toBe('agents-assistant')

    const sessionId = useAppStore.getState().sessions[0].id
    const completedToolCall: ToolCall = {
      id: 'tool-1',
      toolName: 'agent_update',
      input: { agent_id: agent.id },
      status: 'completed',
      startedAt: Date.now(),
      completedAt: Date.now(),
    }
    const assistantMessage: Message = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Updated agent',
      timestamp: Date.now(),
      toolCalls: [completedToolCall],
    }

    useAppStore.getState().updateSession(sessionId, {
      messages: [assistantMessage],
    })

    await waitFor(() => expect(onAgentMutated).toHaveBeenCalledTimes(1))

    useAppStore.getState().updateSession(sessionId, {
      messages: [{
        ...assistantMessage,
        content: 'Updated agent successfully',
      }],
    })

    await waitFor(() => expect(onAgentMutated).toHaveBeenCalledTimes(1))
  })

  it('allows selecting a different model for the current agent assistant session', async () => {
    const alternateModel: Model = {
      id: 'model-2',
      name: 'GPT Alt',
      provider: 'openai',
      providerType: 'openai',
      modelId: 'gpt-4.1-mini',
      enabled: true,
    }

    useAppStore.setState((state) => ({
      ...state,
      models: [model, alternateModel],
    }))

    render(
      <AgentAssistantDrawer
        mode="create"
        onClose={vi.fn()}
      />,
    )

    await waitFor(() => expect(useAppStore.getState().sessions).toHaveLength(1))
    expect(useAppStore.getState().sessions[0]?.modelId).toBe('model-1')

    fireEvent.change(screen.getByLabelText('Assistant model'), { target: { value: 'model-2' } })

    await waitFor(() => expect(useAppStore.getState().sessions[0]?.modelId).toBe('model-2'))
  })
})