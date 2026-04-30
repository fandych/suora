import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store/appStore'
import type { ScheduledTask } from '@/types'

vi.mock('@/services/agentPipelineService', () => ({
  executePipelineById: vi.fn(),
}))

import { executePipelineById } from '@/services/agentPipelineService'
import { handleTimerFired, initTimerRuntimeListener } from './timerRuntime'

const promptTimer: ScheduledTask = {
  id: 'timer-prompt',
  name: 'Daily Prompt',
  type: 'once',
  schedule: new Date().toISOString(),
  action: 'prompt',
  prompt: 'Summarize today',
  agentId: 'agent-1',
  enabled: true,
  createdAt: 1,
  updatedAt: 1,
}

const pipelineTimer: ScheduledTask = {
  id: 'timer-pipeline',
  name: 'Pipeline Trigger',
  type: 'interval',
  schedule: '30',
  action: 'pipeline',
  pipelineId: 'pipeline-1',
  enabled: true,
  createdAt: 1,
  updatedAt: 1,
  lastRun: 101,
}

describe('timerRuntime', () => {
  beforeEach(() => {
    vi.mocked(executePipelineById).mockReset()
    vi.mocked(window.electron.invoke).mockReset()
    vi.mocked(window.electron.on).mockReset()
    vi.mocked(window.electron.off).mockReset()

    useAppStore.setState({
      sessions: [],
      activeSessionId: null,
      activeModule: 'timer',
      selectedAgent: null,
      notifications: [],
      agents: [
        {
          id: 'agent-1',
          name: 'Scheduler',
          systemPrompt: 'Handle scheduled prompts',
          modelId: 'model-1',
          skills: [],
          enabled: true,
          memories: [],
          autoLearn: false,
        },
      ],
    })
  })

  it('creates a chat session for prompt timers', async () => {
    await handleTimerFired(promptTimer)

    const state = useAppStore.getState()
    expect(state.sessions).toHaveLength(1)
    expect(state.sessions[0].title).toBe('Timer: Daily Prompt')
    expect(state.sessions[0].messages[0].content).toBe('Summarize today')
    expect(state.activeSessionId).toBe(state.sessions[0].id)
    expect(state.activeModule).toBe('chat')
    expect(state.selectedAgent?.id).toBe('agent-1')
    expect(state.notifications).toHaveLength(1)
  })

  it('runs saved pipelines for pipeline timers and posts completion notifications', async () => {
    vi.mocked(executePipelineById).mockResolvedValue({
      id: 'exec-1',
      pipelineId: 'pipeline-1',
      pipelineName: 'Morning Run',
      trigger: 'timer',
      timerId: 'timer-pipeline',
      startedAt: 10,
      completedAt: 20,
      status: 'success',
      steps: [],
      finalOutput: 'done',
    })

    await handleTimerFired(pipelineTimer)

    expect(executePipelineById).toHaveBeenCalledWith('pipeline-1', {
      trigger: 'timer',
      timerId: 'timer-pipeline',
      persistExecution: true,
      persistLastRun: true,
    })
    expect(window.electron.invoke).toHaveBeenCalledWith('timer:updateExecution', {
      timerId: 'timer-pipeline',
      firedAt: 101,
      status: 'success',
      error: undefined,
      pipelineExecutionId: 'exec-1',
    })

    const state = useAppStore.getState()
    expect(state.notifications).toHaveLength(2)
    expect(state.notifications[0].title).toBe('Pipeline completed: Morning Run')
    expect(state.notifications[1].title).toBe('Timer fired: Pipeline Trigger')
  })

  it('registers and disposes the global timer listener', async () => {
    vi.mocked(executePipelineById).mockResolvedValue({
      id: 'exec-2',
      pipelineId: 'pipeline-1',
      pipelineName: 'Morning Run',
      trigger: 'timer',
      timerId: 'timer-pipeline',
      startedAt: 10,
      completedAt: 20,
      status: 'success',
      steps: [],
      finalOutput: 'done',
    })

    let handler: ((...args: unknown[]) => void) | undefined
    vi.mocked(window.electron.on).mockImplementation((channel: string, listener: (...args: unknown[]) => void) => {
      if (channel === 'timer:fired') {
        handler = listener
      }
    })

    const dispose = initTimerRuntimeListener()
    expect(window.electron.on).toHaveBeenCalledTimes(1)
    expect(handler).toBeDefined()

    handler?.({ sender: 'ipc' }, pipelineTimer)
    await Promise.resolve()
    await Promise.resolve()

    expect(executePipelineById).toHaveBeenCalledTimes(1)

    dispose()
    expect(window.electron.off).toHaveBeenCalledTimes(1)
    expect(window.electron.off).toHaveBeenCalledWith('timer:fired', handler)
  })
})
