import { delegateToAgent } from '@/services/agentCommunication'
import { fireFileChangeEvent, hydrateTriggers, resolvePromptTemplate, startEventMonitor, stopEventMonitor } from '@/services/eventAutomation'
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

let resyncEventAutomationWatchers: (() => Promise<void>) | null = null

export async function refreshEventAutomationWatchers(): Promise<void> {
  if (!resyncEventAutomationWatchers) return
  await resyncEventAutomationWatchers()
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
  const electron = window.electron
  const fileWatchRoots = new Set<string>()

  const syncFileWatchers = async (): Promise<void> => {
    if (!electron?.invoke) return
    const enabledFileTriggers = hydrateTriggers ? (await hydrateTriggers()).filter((trigger) => trigger.enabled && trigger.type === 'file_change' && trigger.pattern?.trim()) : []
    const requestedRoots = new Set<string>()
    for (const trigger of enabledFileTriggers) {
      const pattern = trigger.pattern?.trim() ?? ''
      const normalized = pattern.replace(/\\/g, '/')
      if (!normalized.includes('/')) continue
      const wildcardIndex = normalized.search(/[\*\?]/)
      const base = wildcardIndex >= 0 ? normalized.slice(0, Math.max(0, normalized.lastIndexOf('/', wildcardIndex))) : normalized.slice(0, normalized.lastIndexOf('/'))
      if (base.trim()) requestedRoots.add(base)
    }

    for (const existing of fileWatchRoots) {
      if (!requestedRoots.has(existing)) {
        await electron.invoke('fs:watch:stop', existing).catch(() => {})
        fileWatchRoots.delete(existing)
      }
    }

    for (const root of requestedRoots) {
      if (fileWatchRoots.has(root)) continue
      await electron.invoke('fs:watch:start', root).catch(() => {})
      fileWatchRoots.add(root)
    }
  }
  resyncEventAutomationWatchers = syncFileWatchers

  const handleFileWatchChanged = (...args: unknown[]) => {
    const payload = args[0] as { dir?: string; filename?: string }
    if (!payload?.dir || !payload?.filename) return
    const normalizedDir = payload.dir.replace(/\\/g, '/')
    const normalizedFile = payload.filename.replace(/\\/g, '/')
    fireFileChangeEvent(`${normalizedDir}/${normalizedFile}`)
  }

  void hydrateTriggers().finally(() => {
    if (disposed) return
    void syncFileWatchers()
    if (electron?.on) {
      electron.on('fs:watch:changed', handleFileWatchChanged)
    }
    startEventMonitor((trigger, context) => {
      void handleEventAutomationTrigger(trigger, context).catch((error) => {
        useAppStore.getState().addNotification({
          id: generateId('notif'),
          type: 'error',
          title: `Event trigger failed: ${trigger.name}`,
          message: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
          read: false,
          action: { module: 'settings', label: 'Open event settings', path: '/settings/events' },
        })
      })
    })
  })

  return () => {
    disposed = true
    if (resyncEventAutomationWatchers === syncFileWatchers) {
      resyncEventAutomationWatchers = null
    }
    if (electron?.off) {
      electron.off('fs:watch:changed', handleFileWatchChanged)
    }
    if (electron?.invoke) {
      for (const root of fileWatchRoots) {
        void electron.invoke('fs:watch:stop', root).catch(() => {})
      }
    }
    fileWatchRoots.clear()
    stopEventMonitor()
  }
}