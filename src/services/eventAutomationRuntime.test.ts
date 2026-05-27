import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventTrigger } from '@/types'
import { useAppStore } from '@/store/appStore'
import { delegateToAgent } from '@/services/agentCommunication'
import { handleEventAutomationTrigger } from './eventAutomationRuntime'

vi.mock('@/services/agentCommunication', () => ({
  delegateToAgent: vi.fn().mockResolvedValue('Delegated result'),
}))

function trigger(overrides: Partial<EventTrigger> = {}): EventTrigger {
  return {
    id: 'evt-1',
    name: 'Daily note',
    type: 'app_start',
    agentId: 'agent-1',
    promptTemplate: 'Summarize {{event}} for {{trigger}}',
    enabled: true,
    createdAt: 1,
    ...overrides,
  }
}

describe('eventAutomationRuntime', () => {
  beforeEach(() => {
    vi.mocked(delegateToAgent).mockClear()
    useAppStore.setState({
      sessions: [],
      activeSessionId: null,
      openSessionTabs: [],
      notifications: [],
    })
  })

  it('creates a chat session and appends the delegated agent result', async () => {
    await handleEventAutomationTrigger(trigger(), { event: 'app_start' })

    const state = useAppStore.getState()
    expect(delegateToAgent).toHaveBeenCalledWith('event-automation', 'agent-1', 'Summarize app_start for Daily note', expect.stringContaining('event: app_start'))
    expect(state.sessions).toHaveLength(1)
    expect(state.sessions[0]).toMatchObject({
      title: 'Event: Daily note',
      agentId: 'agent-1',
      surface: 'chat',
    })
    expect(state.sessions[0]?.messages.map((message) => message.role)).toEqual(['user', 'assistant'])
    expect(state.sessions[0]?.messages[1]?.content).toBe('Delegated result')
    expect(state.notifications[0]?.title).toBe('Event trigger fired: Daily note')
  })
})