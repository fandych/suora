import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatMain } from './ChatMain'
import { useAppStore } from '@/store/appStore'
import type { Agent, Model, Session } from '@/types'

vi.mock('@/hooks/useAIChat', () => ({
  useAIChat: () => ({
    sendMessage: vi.fn(),
    cancelStream: vi.fn(),
    retryLastError: vi.fn(),
    deleteMessage: vi.fn(),
    regenerateMessage: vi.fn(),
    clearMessages: vi.fn(),
    isLoading: false,
  }),
}))

vi.mock('./ChatMessages', () => ({
  MessageBubble: () => <div>message</div>,
}))

vi.mock('./ChatInput', () => ({
  ChatInput: () => <div>input</div>,
}))

vi.mock('./TodoProgress', () => ({
  TodoProgress: () => null,
}))

describe('ChatMain', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppStore.setState({
      sessions: [],
      activeSessionId: null,
      openSessionTabs: [],
      models: [],
      agents: [],
      selectedModel: null,
      selectedAgent: null,
      providerConfigs: [],
    })
  })

  it('allows switching to a legacy agent without an enabled flag', async () => {
    const user = userEvent.setup()
    const model: Model = {
      id: 'model-1',
      name: 'GPT Test',
      provider: 'openai',
      providerType: 'openai',
      modelId: 'gpt-4.1',
      enabled: true,
    }

    const defaultAgent: Agent = {
      id: 'default-assistant',
      name: 'Assistant',
      systemPrompt: 'Default agent',
      modelId: 'model-1',
      skills: [],
      enabled: true,
      memories: [],
      autoLearn: true,
    }

    const legacyAgent = {
      id: 'agent-legacy',
      name: 'Legacy Writer',
      systemPrompt: 'Write clearly',
      modelId: 'model-1',
      skills: [],
      memories: [],
      autoLearn: false,
    } as unknown as Agent

    const session: Session = {
      id: 'session-1',
      title: 'Test chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      agentId: defaultAgent.id,
      modelId: model.id,
      messages: [],
    }

    useAppStore.setState({
      sessions: [session],
      activeSessionId: session.id,
      openSessionTabs: [session.id],
      models: [model],
      agents: [defaultAgent, legacyAgent],
      selectedModel: model,
      selectedAgent: defaultAgent,
    })

    render(<ChatMain />)

    await user.click(screen.getByRole('button', { name: 'Select agent' }))
    await user.click(screen.getByRole('button', { name: /Legacy Writer/i }))

    expect(useAppStore.getState().selectedAgent?.id).toBe('agent-legacy')
    expect(useAppStore.getState().sessions[0]?.agentId).toBe('agent-legacy')
    expect(screen.getByRole('button', { name: 'Select agent' })).toHaveTextContent('Legacy Writer')
  })

  it('clears session.modelId when switching to agent without preferred model', async () => {
    const user = userEvent.setup()
    const model: Model = {
      id: 'model-1',
      name: 'GPT Test',
      provider: 'openai',
      providerType: 'openai',
      modelId: 'gpt-4.1',
      enabled: true,
    }

    const defaultAgent: Agent = {
      id: 'default-assistant',
      name: 'Assistant',
      systemPrompt: 'Default agent',
      modelId: 'model-1',
      skills: [],
      enabled: true,
      memories: [],
      autoLearn: true,
    }

    // Agent without modelId
    const noModelAgent = {
      id: 'agent-no-model',
      name: 'Generic Agent',
      systemPrompt: 'Generic',
      modelId: '',
      skills: [],
      memories: [],
      autoLearn: false,
      enabled: true,
    } as Agent

    const session: Session = {
      id: 'session-1',
      title: 'Test chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      agentId: defaultAgent.id,
      modelId: model.id,
      messages: [],
    }

    useAppStore.setState({
      sessions: [session],
      activeSessionId: session.id,
      openSessionTabs: [session.id],
      models: [model],
      agents: [defaultAgent, noModelAgent],
      selectedModel: model,
      selectedAgent: defaultAgent,
    })

    render(<ChatMain />)

    await user.click(screen.getByRole('button', { name: 'Select agent' }))
    await user.click(screen.getByRole('button', { name: /Generic Agent/i }))

    // After switching to agent without modelId, session.modelId should be undefined
    expect(useAppStore.getState().sessions[0]?.modelId).toBeUndefined()
    expect(useAppStore.getState().selectedAgent?.id).toBe('agent-no-model')
  })

  it('switches model when agent has different modelId', async () => {
    const user = userEvent.setup()
    const model1: Model = {
      id: 'model-1',
      name: 'GPT-4',
      provider: 'openai',
      providerType: 'openai',
      modelId: 'gpt-4',
      enabled: true,
    }
    const model2: Model = {
      id: 'model-2',
      name: 'Claude 3',
      provider: 'anthropic',
      providerType: 'anthropic',
      modelId: 'claude-3-opus',
      enabled: true,
    }

    const agent1: Agent = {
      id: 'agent-1',
      name: 'GPT Agent',
      systemPrompt: 'Uses GPT',
      modelId: 'model-1',
      skills: [],
      enabled: true,
      memories: [],
      autoLearn: false,
    }

    const agent2: Agent = {
      id: 'agent-2',
      name: 'Claude Agent',
      systemPrompt: 'Uses Claude',
      modelId: 'model-2',
      skills: [],
      enabled: true,
      memories: [],
      autoLearn: false,
    }

    const session: Session = {
      id: 'session-1',
      title: 'Test chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      agentId: agent1.id,
      modelId: model1.id,
      messages: [],
    }

    useAppStore.setState({
      sessions: [session],
      activeSessionId: session.id,
      openSessionTabs: [session.id],
      models: [model1, model2],
      agents: [agent1, agent2],
      selectedModel: model1,
      selectedAgent: agent1,
    })

    render(<ChatMain />)

    // Initially using agent-1 with model-1
    expect(useAppStore.getState().sessions[0]?.modelId).toBe('model-1')

    // Switch to agent-2 which prefers model-2
    await user.click(screen.getByRole('button', { name: 'Select agent' }))
    await user.click(screen.getByRole('button', { name: /Claude Agent/i }))

    // Session should now have model-2
    expect(useAppStore.getState().sessions[0]?.modelId).toBe('model-2')
    expect(useAppStore.getState().sessions[0]?.agentId).toBe('agent-2')
    expect(useAppStore.getState().selectedAgent?.id).toBe('agent-2')
  })

  it('shows agent and model selectors on welcome screen without a session', () => {
    // When there's no active session, the welcome screen should still display
    // the toolbar with agent/model selectors so user can configure before starting
    const model: Model = {
      id: 'model-1',
      name: 'GPT-4',
      provider: 'openai',
      providerType: 'openai',
      modelId: 'gpt-4',
      enabled: true,
    }

    const agent1: Agent = {
      id: 'agent-1',
      name: 'Agent Alpha',
      systemPrompt: 'Alpha',
      modelId: 'model-1',
      skills: [],
      enabled: true,
      memories: [],
      autoLearn: false,
    }

    useAppStore.setState({
      sessions: [],
      activeSessionId: null,
      openSessionTabs: [],
      models: [model],
      agents: [agent1],
      selectedModel: model,
      selectedAgent: agent1,
    })

    render(<ChatMain />)

    // Agent selector button should be visible
    expect(screen.getByRole('button', { name: /Select agent/i })).toBeInTheDocument()
    
    // Agent label and Model label should be visible in toolbar
    // These are in the toolbar, verifying toolbar is rendered
    const agentLabel = screen.getAllByText(/agent/i).find(el => el.textContent?.toLowerCase() === 'agent')
    const modelLabel = screen.getAllByText(/model/i).find(el => el.textContent?.toLowerCase() === 'model')
    expect(agentLabel).toBeInTheDocument()
    expect(modelLabel).toBeInTheDocument()

    // Welcome screen content should still be visible
    expect(screen.getByText(/Select or create a conversation/i)).toBeInTheDocument()
  })
})