import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DOCUMENT_EDITOR_AGENT_ID, useAppStore } from '@/store/appStore'
import type { Agent, Message, Model, ToolCall } from '@/types'
import { createDocument, createDocumentGroup } from '@/services/documents'
import { DocumentsAssistantDrawer } from './DocumentsAssistantDrawer'

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

describe('DocumentsAssistantDrawer', () => {
  const model: Model = {
    id: 'model-1',
    name: 'GPT Test',
    provider: 'openai',
    providerType: 'openai',
    modelId: 'gpt-4.1',
    enabled: true,
  }
  const documentEditor: Agent = {
    id: DOCUMENT_EDITOR_AGENT_ID,
    name: 'Document editor',
    avatar: 'agent-writer',
    color: '#2563EB',
    whenToUse: 'Use inside the Documents module to create new documents, rewrite existing ones, and keep the work focused on saved document content instead of only replying in chat.',
    systemPrompt: '',
    modelId: '',
    skills: [],
    temperature: 0.35,
    maxTokens: 4096,
    maxTurns: 24,
    enabled: true,
    greeting: 'Ready to edit documents.',
    responseStyle: 'balanced',
    allowedTools: ['list_documents', 'read_document', 'create_document', 'update_document'],
    disallowedTools: [],
    permissionMode: 'acceptEdits',
    memories: [],
    autoLearn: true,
  }
  const group = createDocumentGroup('Docs')
  const document = createDocument(group.id, null, 'Launch Brief')

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
      agents: [documentEditor],
    })
    useAppStore.getState().setLocale('en')
  })

  it('binds the drawer session to the dedicated document editor agent', async () => {
    render(
      <DocumentsAssistantDrawer
        mode="create"
        group={group}
        onClose={vi.fn()}
      />,
    )

    await waitFor(() => expect(useAppStore.getState().sessions).toHaveLength(1))
    expect(useAppStore.getState().sessions[0]?.agentId).toBe(DOCUMENT_EDITOR_AGENT_ID)
    expect(useAppStore.getState().sessions[0]?.contextPrompt).toContain('create_document')
  })

  it('renders the drawer in Chinese when locale is zh', async () => {
    useAppStore.getState().setLocale('zh')

    render(
      <DocumentsAssistantDrawer
        mode="create"
        group={group}
        onClose={vi.fn()}
      />,
    )

    await waitFor(() => expect(useAppStore.getState().sessions).toHaveLength(1))
    expect(screen.getByRole('dialog', { name: '文档助手' })).toBeInTheDocument()
    expect(screen.getByText('AI 创建文档')).toBeInTheDocument()
    expect(screen.getByText('使用自然语言创建或修改已保存文档。执行更改前需要先确认。')).toBeInTheDocument()
    expect(screen.getByText('描述你想创建的文档')).toBeInTheDocument()
  })

  it('notifies once when a completed document tool call is observed', async () => {
    const onDocumentMutated = vi.fn()

    render(
      <DocumentsAssistantDrawer
        mode="edit"
        document={document}
        group={group}
        onClose={vi.fn()}
        onDocumentMutated={onDocumentMutated}
      />,
    )

    await waitFor(() => expect(useAppStore.getState().sessions).toHaveLength(1))
    expect(useAppStore.getState().activeSessionId).toBeNull()
    expect(useAppStore.getState().sessions[0]?.surface).toBe('documents-assistant')

    const sessionId = useAppStore.getState().sessions[0].id
    const completedToolCall: ToolCall = {
      id: 'tool-1',
      toolName: 'update_document',
      input: { document_id: document.id },
      status: 'completed',
      startedAt: Date.now(),
      completedAt: Date.now(),
    }
    const assistantMessage: Message = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Updated document',
      timestamp: Date.now(),
      toolCalls: [completedToolCall],
    }

    useAppStore.getState().updateSession(sessionId, {
      messages: [assistantMessage],
    })

    await waitFor(() => expect(onDocumentMutated).toHaveBeenCalledTimes(1))

    useAppStore.getState().updateSession(sessionId, {
      messages: [{
        ...assistantMessage,
        content: 'Updated document successfully',
      }],
    })

    await waitFor(() => expect(onDocumentMutated).toHaveBeenCalledTimes(1))
  })
})
