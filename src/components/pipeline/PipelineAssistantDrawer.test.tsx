import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store/appStore'
import type { AgentPipeline, Message, Model, ToolCall } from '@/types'
import { PipelineAssistantDrawer } from './PipelineAssistantDrawer'

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

describe('PipelineAssistantDrawer', () => {
  const model: Model = {
    id: 'model-1',
    name: 'GPT Test',
    provider: 'openai',
    providerType: 'openai',
    modelId: 'gpt-4.1',
    enabled: true,
  }

  const pipeline: AgentPipeline = {
    id: 'pipeline-1',
    name: 'Launch Flow',
    steps: [{ agentId: 'agent-1', task: 'Draft launch notes' }],
    createdAt: 1,
    updatedAt: 2,
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
      agents: [{ id: 'agent-1', name: 'Writer', systemPrompt: '', modelId: 'model-1', enabled: true, skills: [], memories: [], autoLearn: false }],
    })
  })

  it('notifies once when a completed pipeline tool call is observed', async () => {
    const onPipelineMutated = vi.fn()

    render(
      <PipelineAssistantDrawer
        mode="edit"
        pipeline={pipeline}
        onClose={vi.fn()}
        onPipelineMutated={onPipelineMutated}
      />,
    )

    await waitFor(() => expect(useAppStore.getState().sessions).toHaveLength(1))
    expect(useAppStore.getState().activeSessionId).toBeNull()
    expect(useAppStore.getState().sessions[0]?.surface).toBe('pipeline-assistant')

    const sessionId = useAppStore.getState().sessions[0].id
    const completedToolCall: ToolCall = {
      id: 'tool-1',
      toolName: 'pipeline_update',
      input: { pipeline_id: pipeline.id },
      status: 'completed',
      startedAt: Date.now(),
      completedAt: Date.now(),
    }
    const assistantMessage: Message = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Updated pipeline',
      timestamp: Date.now(),
      toolCalls: [completedToolCall],
    }

    useAppStore.getState().updateSession(sessionId, {
      messages: [assistantMessage],
    })

    await waitFor(() => expect(onPipelineMutated).toHaveBeenCalledTimes(1))

    useAppStore.getState().updateSession(sessionId, {
      messages: [{
        ...assistantMessage,
        content: 'Updated pipeline successfully',
      }],
    })

    await waitFor(() => expect(onPipelineMutated).toHaveBeenCalledTimes(1))
  })
})