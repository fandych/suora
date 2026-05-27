import { delegateToAgent } from '@/services/agentCommunication'
import { hydrateTriggers, resolvePromptTemplate, startEventMonitor, stopEventMonitor } from '@/services/eventAutomation'
import { useAppStore } from '@/store/appStore'
import type { EventTrigger, Message, Session } from '@/types'
import { generateId } from '@/utils/helpers'

function buildEventContext(trigger: EventTrigger, context: Record<string, string>): Record<string, string> {
  return {
    event: trigger.type,
    trigger: trigger.name,
    ...context,
  }
}

function buildContextSummary(context: Record<string, string>): string {
  return Object.entries(context)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
}

export async function handleEventAutomationTrigger(trigger: EventTrigger, context: Record<string, string>): Promise<void> {
  const eventContext = buildEventContext(trigger, context)
  const prompt = resolvePromptTemplate(trigger.promptTemplate, eventContext).trim()
  if (!prompt) return

  const now = Date.now()
  const sessionId = generateId('session')
  const userMessage: Message = {
    id: generateId('msg'),
    role: 'user',
    content: prompt,
    timestamp: now,
    agentId: trigger.agentId,
    contextSummary: buildContextSummary(eventContext),
  }
  const session: Session = {
    id: sessionId,
    title: `Event: ${trigger.name}`,
    createdAt: now,
    updatedAt: now,
    surface: 'chat',
    agentId: trigger.agentId,
    messages: [userMessage],
    contextPrompt: 'This chat session was created by a Suora event automation trigger.',
  }

  const store = useAppStore.getState()
  store.addSession(session)
  store.addNotification({
    id: generateId('notif'),
    type: 'info',
    title: `Event trigger fired: ${trigger.name}`,
    message: prompt.slice(0, 160),
    timestamp: Date.now(),
    read: false,
    action: { module: 'chat', label: 'Open chat' },
  })

  const result = await delegateToAgent('event-automation', trigger.agentId, prompt, buildContextSummary(eventContext))
  const assistantMessage: Message = {
    id: generateId('msg'),
    role: 'assistant',
    content: result || '(empty response)',
    timestamp: Date.now(),
    agentId: trigger.agentId,
    isError: result.startsWith('Error'),
  }

  const latest = useAppStore.getState().sessions.find((item) => item.id === sessionId)
  if (!latest) return
  useAppStore.getState().updateSession(sessionId, {
    messages: [...latest.messages, assistantMessage],
  })
}

export function initEventAutomationRuntime(): () => void {
  let disposed = false

  void hydrateTriggers().finally(() => {
    if (disposed) return
    startEventMonitor((trigger, context) => {
      void handleEventAutomationTrigger(trigger, context).catch((error) => {
        useAppStore.getState().addNotification({
          id: generateId('notif'),
          type: 'error',
          title: `Event trigger failed: ${trigger.name}`,
          message: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
          read: false,
          action: { module: 'settings', label: 'Open event settings', path: '/settings/system' },
        })
      })
    })
  })

  return () => {
    disposed = true
    stopEventMonitor()
  }
}