import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAIChat } from './useAIChat'
import { useAppStore } from '@/store/appStore'
import type { Agent, Model, Session } from '@/types'

const streamResponseWithTools = vi.fn()
const initializeProvider = vi.fn()

vi.mock('@/services/aiService', () => ({
  initializeProvider: (...args: unknown[]) => initializeProvider(...args),
  validateModelConfig: vi.fn(() => ({ valid: true })),
  streamResponseWithTools: (...args: unknown[]) => streamResponseWithTools(...args),
}))

vi.mock('@/services/agentSelection', () => ({
  selectBestAgentForTask: vi.fn(() => null),
}))

function model(): Model {
  return {
    id: 'model-1',
    name: 'GPT Test',
    provider: 'openai',
    providerType: 'openai',
    modelId: 'gpt-test',
    apiKey: 'test-key',
    enabled: true,
  }
}

function session(id: string): Session {
  return {
    id,
    title: id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    modelId: 'model-1',
    messages: [],
  }
}

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'default-assistant',
    name: 'Assistant',
    systemPrompt: 'Be helpful',
    modelId: '',
    skills: [],
    enabled: true,
    memories: [],
    autoLearn: false,
    maxTurns: 6,
    ...overrides,
  }
}

describe('useAIChat', () => {
  beforeEach(() => {
    vi.useRealTimers()
    streamResponseWithTools.mockReset()
    initializeProvider.mockReset()
    localStorage.clear()
    const testModel = model()
    useAppStore.setState({
      sessions: [session('session-1'), session('session-2')],
      activeSessionId: 'session-1',
      openSessionTabs: ['session-1', 'session-2'],
      models: [testModel],
      selectedModel: testModel,
      selectedAgent: null,
      agents: [],
      skills: [],
    })
  })

  it('allows separate chat sessions to stream in parallel', async () => {
    const releaseStream: Array<() => void> = []
    streamResponseWithTools.mockImplementation(async function* () {
      await new Promise<void>((resolve) => releaseStream.push(resolve))
      yield { type: 'text-delta', text: 'done' }
    })

    const { result, rerender } = renderHook(() => useAIChat())

    await act(async () => {
      void result.current.sendMessage('first')
    })

    await waitFor(() => expect(streamResponseWithTools).toHaveBeenCalledTimes(1))
    expect(result.current.isLoading).toBe(true)

    act(() => {
      useAppStore.setState({ activeSessionId: 'session-2' })
    })
    rerender()
    expect(result.current.isLoading).toBe(false)

    await act(async () => {
      void result.current.sendMessage('second')
    })

    await waitFor(() => expect(streamResponseWithTools).toHaveBeenCalledTimes(2))

    act(() => {
      for (const release of releaseStream) release()
    })

    await waitFor(() => {
      const sessions = useAppStore.getState().sessions
      expect(sessions.find((item) => item.id === 'session-1')?.messages.at(-1)?.isStreaming).toBe(false)
      expect(sessions.find((item) => item.id === 'session-2')?.messages.at(-1)?.isStreaming).toBe(false)
    })
  })

  it('preserves session updates that happen while preparing a send', async () => {
    initializeProvider.mockImplementationOnce(() => {
      const current = useAppStore.getState()
      const target = current.sessions.find((item) => item.id === 'session-1')
      if (!target) return
      useAppStore.setState({
        sessions: current.sessions.map((item) => item.id === target.id
          ? {
              ...item,
              messages: [
                ...item.messages,
                {
                  id: 'external-message',
                  role: 'assistant',
                  content: 'external update',
                  timestamp: Date.now(),
                },
              ],
            }
          : item),
      })
    })
    streamResponseWithTools.mockImplementation(async function* () {
      yield { type: 'text-delta', text: 'reply' }
    })

    const { result } = renderHook(() => useAIChat())

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    const messages = useAppStore.getState().sessions[0]?.messages ?? []
    expect(messages.map((message) => message.id)).toContain('external-message')
    expect(messages.at(-2)?.role).toBe('user')
    expect(messages.at(-1)?.content).toBe('reply')
  })

  it('stops writing stream updates when the assistant message is removed', async () => {
    let releaseSecondDelta: (() => void) | undefined
    streamResponseWithTools.mockImplementation(async function* () {
      yield { type: 'text-delta', text: 'first' }
      await new Promise<void>((resolve) => { releaseSecondDelta = resolve })
      yield { type: 'text-delta', text: 'second' }
    })

    const { result } = renderHook(() => useAIChat())

    await act(async () => {
      void result.current.sendMessage('hello')
    })

    await waitFor(() => {
      expect(useAppStore.getState().sessions[0]?.messages.at(-1)?.content).toBe('first')
    })
    const assistantId = useAppStore.getState().sessions[0]?.messages.at(-1)?.id
    expect(assistantId).toBeDefined()

    act(() => {
      const current = useAppStore.getState()
      const target = current.sessions[0]
      if (!target || !assistantId) return
      useAppStore.setState({
        sessions: current.sessions.map((item) => item.id === target.id
          ? { ...item, messages: item.messages.filter((message) => message.id !== assistantId) }
          : item),
      })
    })

    await act(async () => {
      releaseSecondDelta?.()
    })

    await waitFor(() => {
      const messages = useAppStore.getState().sessions[0]?.messages ?? []
      expect(messages.some((message) => message.id === assistantId)).toBe(false)
      expect(messages.some((message) => message.content.includes('second'))).toBe(false)
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('clears the streaming message when a response times out', async () => {
    vi.useFakeTimers()
    streamResponseWithTools.mockImplementation(async function* () {
      await new Promise<void>(() => {})
    })

    const { result, unmount } = renderHook(() => useAIChat())

    await act(async () => {
      void result.current.sendMessage('will timeout')
      await Promise.resolve()
    })

    expect(streamResponseWithTools).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState().sessions[0]?.messages.at(-1)?.isStreaming).toBe(true)

    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000)
    })

    expect(useAppStore.getState().sessions[0]?.messages.at(-1)?.isStreaming).toBe(false)
    expect(useAppStore.getState().sessions[0]?.messages.at(-1)?.cancellation?.cancelReason).toContain('Response timed out')
    unmount()
  })

  it('adds one reply step of headroom on top of the agent tool-turn budget', async () => {
    const selectedAgent = agent({ id: 'agent-tools', maxTurns: 3 })
    useAppStore.setState({
      agents: [selectedAgent],
      selectedAgent,
    })

    streamResponseWithTools.mockImplementation(async function* () {
      yield { type: 'finish-step', finishReason: 'stop' }
    })

    const { result } = renderHook(() => useAIChat())

    await act(async () => {
      await result.current.sendMessage('please use tools')
    })

    expect(streamResponseWithTools).toHaveBeenCalledTimes(1)
    expect(streamResponseWithTools.mock.calls[0]?.[2]).toMatchObject({ maxSteps: 4 })
  })

  it('routes natural-language pipeline requests through the model instead of executing directly', async () => {
    streamResponseWithTools.mockImplementation(async function* () {
      yield { type: 'text-delta', text: 'I can help plan that pipeline run.' }
    })

    const { result } = renderHook(() => useAIChat())

    await act(async () => {
      await result.current.sendMessage('Please run pipeline Morning Run for me')
    })

    expect(streamResponseWithTools).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      const messages = useAppStore.getState().sessions[0]?.messages ?? []
      expect(messages).toHaveLength(2)
      expect(messages.at(-1)?.content).toBe('I can help plan that pipeline run.')
    })
  })

  it('marks error-shaped tool results as failed tool calls', async () => {
    const selectedAgent = agent({ id: 'agent-tools', maxTurns: 3 })
    useAppStore.setState({
      agents: [selectedAgent],
      selectedAgent,
    })

    streamResponseWithTools.mockImplementation(async function* () {
      yield {
        type: 'tool-call',
        toolCallId: 'tool-1',
        toolName: 'shell',
        input: { command: 'Get-ChildItem' },
      }
      yield {
        type: 'tool-result',
        toolCallId: 'tool-1',
        toolName: 'shell',
        output: 'Error: Command blocked by sandbox policy: format\nStdout: \nStderr: ',
      }
      yield { type: 'finish-step', finishReason: 'stop' }
    })

    const { result } = renderHook(() => useAIChat())

    await act(async () => {
      await result.current.sendMessage('please check the workspace')
    })

    await waitFor(() => {
      const assistantMessage = useAppStore.getState().sessions[0]?.messages.at(-1)
      expect(assistantMessage?.isStreaming).toBe(false)
      expect(assistantMessage?.toolCalls?.[0]?.status).toBe('error')
      expect(assistantMessage?.toolCalls?.[0]?.outputEnvelope?.status).toBe('error')
    })
  })

  it('ignores empty input with no attachments', async () => {
    const { result } = renderHook(() => useAIChat())

    await act(async () => {
      await result.current.sendMessage('')
    })
    await act(async () => {
      await result.current.sendMessage('   \n\t  ')
    })

    expect(streamResponseWithTools).not.toHaveBeenCalled()
    expect(useAppStore.getState().sessions[0]?.messages).toHaveLength(0)
  })

  it('retryLastError replays the previous user message and skips streaming errors', async () => {
    streamResponseWithTools.mockImplementationOnce(async function* () {
      throw new Error('boom')
    })

    const { result } = renderHook(() => useAIChat())

    await act(async () => {
      await result.current.sendMessage('first attempt')
    })

    await waitFor(() => {
      const last = useAppStore.getState().sessions[0]?.messages.at(-1)
      expect(last?.isError).toBe(true)
      expect(last?.isStreaming).toBeFalsy()
    })

    // Simulate that the error message is still marked as streaming — retry should bail out.
    act(() => {
      const sessions = useAppStore.getState().sessions
      const target = sessions[0]
      if (!target) return
      useAppStore.setState({
        sessions: sessions.map((session) => session.id === target.id
          ? {
              ...session,
              messages: session.messages.map((message, index) => index === session.messages.length - 1
                ? { ...message, isStreaming: true }
                : message),
            }
          : session),
      })
    })

    act(() => {
      result.current.retryLastError()
    })

    expect(streamResponseWithTools).toHaveBeenCalledTimes(1)

    // Clear the streaming flag so retryLastError now proceeds.
    act(() => {
      const sessions = useAppStore.getState().sessions
      const target = sessions[0]
      if (!target) return
      useAppStore.setState({
        sessions: sessions.map((session) => session.id === target.id
          ? {
              ...session,
              messages: session.messages.map((message, index) => index === session.messages.length - 1
                ? { ...message, isStreaming: false }
                : message),
            }
          : session),
      })
    })

    streamResponseWithTools.mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'retry-ok' }
    })

    await act(async () => {
      result.current.retryLastError()
    })

    await waitFor(() => expect(streamResponseWithTools).toHaveBeenCalledTimes(2))
    await waitFor(() => {
      const last = useAppStore.getState().sessions[0]?.messages.at(-1)
      expect(last?.role).toBe('assistant')
      expect(last?.content).toBe('retry-ok')
      expect(last?.isError).toBeFalsy()
    })
  })

  it('regenerateMessage ignores non-assistant message ids', async () => {
    streamResponseWithTools.mockImplementation(async function* () {
      yield { type: 'text-delta', text: 'first' }
    })

    const { result } = renderHook(() => useAIChat())

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    await waitFor(() => expect(streamResponseWithTools).toHaveBeenCalledTimes(1))

    const beforeMessages = useAppStore.getState().sessions[0]?.messages ?? []
    const userMsg = beforeMessages.find((message) => message.role === 'user')
    expect(userMsg).toBeDefined()
    if (!userMsg) return

    act(() => {
      result.current.regenerateMessage(userMsg.id)
    })

    // No additional stream should have been triggered, and the conversation
    // history should be untouched.
    expect(streamResponseWithTools).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState().sessions[0]?.messages).toHaveLength(beforeMessages.length)
  })

  it('clearMessages and deleteMessage update the active session', async () => {
    streamResponseWithTools.mockImplementation(async function* () {
      yield { type: 'text-delta', text: 'reply' }
    })

    const { result } = renderHook(() => useAIChat())

    await act(async () => {
      await result.current.sendMessage('hi')
    })

    await waitFor(() => {
      expect(useAppStore.getState().sessions[0]?.messages).toHaveLength(2)
    })

    const userId = useAppStore.getState().sessions[0]?.messages[0]?.id as string
    act(() => {
      result.current.deleteMessage(userId)
    })
    expect(useAppStore.getState().sessions[0]?.messages.some((message) => message.id === userId)).toBe(false)

    act(() => {
      result.current.clearMessages()
    })
    expect(useAppStore.getState().sessions[0]?.messages).toHaveLength(0)
  })
})
