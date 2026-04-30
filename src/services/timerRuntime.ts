import type { ScheduledTask, Session } from '@/types'
import { executePipelineById } from '@/services/agentPipelineService'
import { useAppStore } from '@/store/appStore'
import { generateId } from '@/utils/helpers'

type ElectronBridge = {
  invoke?: (channel: string, ...args: unknown[]) => Promise<unknown>
  on: (channel: string, listener: (...args: unknown[]) => void) => void
  off: (channel: string, listener: (...args: unknown[]) => void) => void
}

function getElectron(): ElectronBridge | undefined {
  return (window as unknown as { electron?: ElectronBridge }).electron
}

function extractTimerPayload(args: unknown[]): ScheduledTask | null {
  if (args.length === 0) return null
  if (args.length >= 2 && typeof args[1] === 'object' && args[1] !== null && 'id' in (args[1] as Record<string, unknown>)) {
    return args[1] as ScheduledTask
  }
  if (typeof args[0] === 'object' && args[0] !== null && 'id' in (args[0] as Record<string, unknown>)) {
    return args[0] as ScheduledTask
  }
  return null
}

async function updateTimerExecutionRecord(data: {
  timerId: string
  firedAt: number
  status: 'success' | 'error'
  error?: string
  pipelineExecutionId?: string
  sessionId?: string
}): Promise<void> {
  const electron = getElectron()
  if (!electron?.invoke) return

  try {
    await electron.invoke('timer:updateExecution', data)
  } catch {
    // Ignore timer history update failures so the main task still completes.
  }
}

export async function handleTimerFired(timerData: ScheduledTask): Promise<void> {
  const state = useAppStore.getState()

  state.addNotification({
    id: generateId('notif'),
    type: 'info',
    title: `Timer fired: ${timerData.name}`,
    message:
      timerData.action === 'pipeline'
        ? 'Pipeline execution started'
        : timerData.action === 'prompt'
          ? timerData.prompt?.slice(0, 100)
          : 'Notification sent',
    timestamp: Date.now(),
    read: false,
    action:
      timerData.action === 'prompt'
        ? { module: 'chat', label: 'Open chat' }
        : timerData.action === 'pipeline'
          ? { module: 'pipeline', label: 'Open pipelines' }
          : undefined,
  })

  if (timerData.action === 'prompt' && timerData.prompt) {
    const agentId = timerData.agentId || 'default-assistant'
    const agent = state.agents.find((item) => item.id === agentId) ?? state.agents[0]
    if (!agent) return

    const sessionId = generateId('session')
    const session: Session = {
      id: sessionId,
      title: `Timer: ${timerData.name}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      agentId: agent.id,
      modelId: agent.modelId || undefined,
      messages: [
        {
          id: generateId('msg'),
          role: 'user',
          content: timerData.prompt,
          timestamp: Date.now(),
          agentId: agent.id,
        },
      ],
    }

    state.addSession(session)
    state.setSelectedAgent(agent)
    state.setActiveSession(sessionId)
    state.setActiveModule('chat')
    return
  }

  if (timerData.action === 'pipeline' && timerData.pipelineId) {
    const firedAt = timerData.lastRun ?? Date.now()

    try {
      const execution = await executePipelineById(timerData.pipelineId, {
        trigger: 'timer',
        timerId: timerData.id,
        persistExecution: true,
        persistLastRun: true,
      })

      await updateTimerExecutionRecord({
        timerId: timerData.id,
        firedAt,
        status: execution.status,
        error: execution.error,
        pipelineExecutionId: execution.id,
      })

      state.addNotification({
        id: generateId('notif'),
        type: execution.status === 'success' ? 'success' : 'error',
        title: execution.status === 'success' ? `Pipeline completed: ${execution.pipelineName}` : `Pipeline failed: ${execution.pipelineName}`,
        message: execution.error || execution.finalOutput?.slice(0, 120) || undefined,
        timestamp: Date.now(),
        read: false,
        action: { module: 'pipeline', label: 'View pipeline history' },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await updateTimerExecutionRecord({
        timerId: timerData.id,
        firedAt,
        status: 'error',
        error: message,
      })
      throw error
    }
  }
}

export function initTimerRuntimeListener(): () => void {
  const electron = getElectron()
  if (!electron) return () => {}

  const handler = (...args: unknown[]) => {
    const timerData = extractTimerPayload(args)
    if (!timerData) return
    handleTimerFired(timerData).catch((error) => {
      useAppStore.getState().addNotification({
        id: generateId('notif'),
        type: 'error',
        title: `Timer handling failed: ${timerData.name}`,
        message: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        read: false,
        action: { module: 'timer', label: 'Open timer' },
      })
    })
  }

  electron.on('timer:fired', handler)
  return () => {
    electron.off('timer:fired', handler)
  }
}
