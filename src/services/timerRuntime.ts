import type { Agent, Message, Model, ScheduledTask, Session, Skill } from '@/types'
import type { ModelMessage, UserModelMessage } from 'ai'
import { initializeProvider, streamResponseWithTools, validateModelConfig } from '@/services/aiService'
import { executePipelineById } from '@/services/agentPipelineService'
import { buildSystemPrompt, getSkillSystemPrompts, getToolsForAgent, mergeSkillsWithBuiltins } from '@/services/tools'
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

function updateSessionMessage(sessionId: string, messageId: string, patch: Partial<Message>): void {
  const state = useAppStore.getState()
  const session = state.sessions.find((item) => item.id === sessionId)
  if (!session) return

  state.updateSession(sessionId, {
    messages: session.messages.map((message) => message.id === messageId ? { ...message, ...patch } : message),
  })
}

function resolveTimerAgent(timerData: ScheduledTask): Agent {
  const state = useAppStore.getState()
  const requestedAgentId = timerData.agentId || 'default-assistant'
  const agent = state.agents.find((item) => item.id === requestedAgentId && item.enabled !== false)
    ?? state.agents.find((item) => item.enabled !== false)

  if (!agent) {
    throw new Error('No enabled agent is available for this timer.')
  }

  return agent
}

function resolveTimerModel(state: ReturnType<typeof useAppStore.getState>, agent: Agent): Model {
  const model = (agent.modelId
    ? state.models.find((item) => item.id === agent.modelId && item.enabled !== false)
    : undefined)
    ?? (state.selectedModel && state.selectedModel.enabled !== false ? state.selectedModel : undefined)
    ?? state.models.find((item) => item.isDefault && item.enabled !== false)
    ?? state.models.find((item) => item.enabled !== false)

  if (!model) {
    throw new Error(`No runnable model is configured for agent "${agent.name}".`)
  }

  return model
}

async function executePromptTimer(timerData: ScheduledTask, firedAt: number): Promise<void> {
  const state = useAppStore.getState()
  if (!timerData.prompt?.trim()) {
    throw new Error('Prompt timers require non-empty prompt content.')
  }

  const agent = resolveTimerAgent(timerData)
  const model = resolveTimerModel(state, agent)
  const validation = validateModelConfig(model)
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Selected model is not configured correctly.')
  }

  initializeProvider(model.providerType, model.apiKey || 'ollama', model.baseUrl, model.provider)

  const now = Date.now()
  const userMessage: Message = {
    id: generateId('msg'),
    role: 'user',
    content: timerData.prompt,
    timestamp: now,
    agentId: agent.id,
  }
  const assistantMessageId = generateId('msg')
  const sessionId = generateId('session')
  const session: Session = {
    id: sessionId,
    title: `Timer: ${timerData.name}`,
    createdAt: now,
    updatedAt: now,
    agentId: agent.id,
    modelId: model.id,
    messages: [
      userMessage,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: now,
        agentId: agent.id,
        modelUsed: model.id,
        isStreaming: true,
      },
    ],
  }

  state.addSession(session)
  state.setSelectedAgent(agent)
  state.setActiveSession(sessionId)
  state.setActiveModule('chat')

  const mergedSkills = mergeSkillsWithBuiltins((state.skills ?? []) as Skill[])
  const tools = getToolsForAgent(agent.skills, mergedSkills, {
    allowedTools: agent.allowedTools,
    disallowedTools: agent.disallowedTools,
    permissionMode: agent.permissionMode,
  })
  const skillPrompts = await getSkillSystemPrompts(agent.skills, mergedSkills)
  const systemPrompt = buildSystemPrompt({
    agentPrompt: agent.systemPrompt,
    responseStyle: agent.responseStyle,
    memories: agent.memories,
    skillPrompts,
    toolNames: Object.keys(tools),
    permissionMode: agent.permissionMode,
  })

  const modelIdentifier = `${model.provider}:${model.modelId}`
  const modelMessages: ModelMessage[] = [
    { role: 'user', content: timerData.prompt } satisfies UserModelMessage,
  ]

  let fullContent = ''
  let runError: string | undefined

  try {
    for await (const event of streamResponseWithTools(modelIdentifier, modelMessages, {
      systemPrompt,
      tools,
      maxSteps: Math.max(2, Math.min(agent.maxTurns ?? 5, 30)),
      apiKey: model.apiKey,
      baseUrl: model.baseUrl,
    })) {
      if (event.type === 'text-delta') {
        fullContent += event.text
        updateSessionMessage(sessionId, assistantMessageId, { content: fullContent })
      } else if (event.type === 'error') {
        runError = event.error
        fullContent = fullContent ? `${fullContent}\n${event.error}` : event.error
        updateSessionMessage(sessionId, assistantMessageId, {
          content: fullContent,
          isError: true,
        })
      }
    }
  } catch (error) {
    runError = error instanceof Error ? error.message : String(error)
    fullContent = fullContent ? `${fullContent}\n${runError}` : runError
  }

  const finalContent = fullContent || '(empty response)'
  updateSessionMessage(sessionId, assistantMessageId, {
    content: finalContent,
    isStreaming: false,
    ...(runError ? { isError: true } : {}),
  })

  await updateTimerExecutionRecord({
    timerId: timerData.id,
    firedAt,
    status: runError ? 'error' : 'success',
    error: runError,
    sessionId,
  })

  state.addNotification({
    id: generateId('notif'),
    type: runError ? 'error' : 'success',
    title: runError ? `Prompt failed: ${timerData.name}` : `Prompt completed: ${timerData.name}`,
    message: runError || finalContent.slice(0, 120) || undefined,
    timestamp: Date.now(),
    read: false,
    action: { module: 'chat', label: 'Open chat' },
  })
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
    await executePromptTimer(timerData, timerData.lastRun ?? Date.now())
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
