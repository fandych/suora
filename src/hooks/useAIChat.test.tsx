import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAIChat } from './useAIChat'
import { useAppStore } from '@/store/appStore'
import type { Model, Session } from '@/types'

const streamResponseWithTools = vi.fn()

vi.mock('@/services/aiService', () => ({
  initializeProvider: vi.fn(),
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

describe('useAIChat', () => {
  beforeEach(() => {
    vi.useRealTimers()
    streamResponseWithTools.mockReset()
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
})
