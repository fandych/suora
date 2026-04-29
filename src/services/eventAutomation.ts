// Event-Driven Automation — monitors file changes, clipboard changes,
// and app lifecycle events to automatically trigger agent actions.
//
// Keeps state in file-based storage to avoid circular deps with appStore.

import type { EventTrigger } from '@/types'
import { readCached, writeCached } from '@/services/fileStorage'
import { safeParse, safeStringify } from '@/utils/safeJson'

type ElectronBridge = { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> }

function getElectron(): ElectronBridge | undefined {
  return (window as unknown as { electron?: ElectronBridge }).electron
}

const STORE_KEY = 'suora-store'
const EVENTS_STORAGE_KEY = 'suora-event-triggers'

// ─── Persistence ────────────────────────────────────────────────────

export function loadTriggers(): EventTrigger[] {
  try {
    const raw = readCached(EVENTS_STORAGE_KEY)
    if (!raw) return []
    return safeParse<EventTrigger[]>(raw)
  } catch {
    return []
  }
}

export function saveTriggers(triggers: EventTrigger[]): void {
  writeCached(EVENTS_STORAGE_KEY, safeStringify(triggers))
}

export function addTrigger(trigger: EventTrigger): void {
  const triggers = loadTriggers()
  triggers.push(trigger)
  saveTriggers(triggers)
}

export function updateTrigger(id: string, updates: Partial<EventTrigger>): void {
  const triggers = loadTriggers()
  const idx = triggers.findIndex((t) => t.id === id)
  if (idx !== -1) {
    triggers[idx] = { ...triggers[idx], ...updates }
    saveTriggers(triggers)
  }
}

export function removeTrigger(id: string): void {
  saveTriggers(loadTriggers().filter((t) => t.id !== id))
}

// ─── Event monitoring ───────────────────────────────────────────────

let clipboardPollTimer: ReturnType<typeof setInterval> | null = null
let lastClipboardContent = ''
let eventHandler: ((trigger: EventTrigger, context: Record<string, string>) => void) | null = null

/**
 * Start the event monitoring system.
 * @param onEvent  Called when an event fires, with the trigger and context variables
 */
export function startEventMonitor(
  onEvent: (trigger: EventTrigger, context: Record<string, string>) => void,
): void {
  eventHandler = onEvent
  stopEventMonitor()

  // Fire app_start triggers
  const triggers = loadTriggers().filter((t) => t.enabled && t.type === 'app_start')
  for (const trigger of triggers) {
    fireEvent(trigger, { event: 'app_start' })
  }

  // Start clipboard monitoring
  clipboardPollTimer = setInterval(() => {
    void checkClipboard()
  }, 2000)
}

/**
 * Stop all event monitoring.
 */
export function stopEventMonitor(): void {
  if (clipboardPollTimer) {
    clearInterval(clipboardPollTimer)
    clipboardPollTimer = null
  }
  eventHandler = null
  lastClipboardContent = ''
}

async function checkClipboard(): Promise<void> {
  const electron = getElectron()
  if (!electron) return

  try {
    const result = (await electron.invoke('clipboard:read')) as { text?: string; error?: string }
    if (!result.text || result.error) return

    if (result.text !== lastClipboardContent) {
      const prev = lastClipboardContent
      lastClipboardContent = result.text

      // Don't fire on initial read
      if (!prev) return

      const triggers = loadTriggers().filter((t) => t.enabled && t.type === 'clipboard_change')
      for (const trigger of triggers) {
        fireEvent(trigger, { content: result.text, previous: prev })
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Manually fire a file_change event (called from the skill hot-reload watcher).
 */
export function fireFileChangeEvent(filePath: string, content?: string): void {
  const triggers = loadTriggers().filter((t) => t.enabled && t.type === 'file_change')
  for (const trigger of triggers) {
    if (trigger.pattern) {
      // Simple glob matching: support *.ext and *pattern* forms
      const pat = trigger.pattern
      if (pat.startsWith('*.')) {
        // Extension match: *.json → file must end with .json
        const ext = pat.slice(1) // ".json"
        if (!filePath.toLowerCase().endsWith(ext.toLowerCase())) continue
      } else if (pat.includes('*')) {
        // Convert glob to regex: escape dots, replace * with .*
        const regexStr = pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
        try {
          if (!new RegExp(regexStr, 'i').test(filePath)) continue
        } catch {
          continue
        }
      } else {
        // Literal substring match
        if (!filePath.toLowerCase().includes(pat.toLowerCase())) continue
      }
    }
    fireEvent(trigger, { file: filePath, content: content || '' })
  }
}

function fireEvent(trigger: EventTrigger, context: Record<string, string>): void {
  if (!eventHandler) return

  // Update lastTriggered
  updateTrigger(trigger.id, { lastTriggered: Date.now() })

  eventHandler(trigger, context)
}

/**
 * Resolve a prompt template with context variables.
 * Supports {{variable}} syntax.
 */
export function resolvePromptTemplate(template: string, context: Record<string, string>): string {
  let result = template
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  for (const [key, value] of Object.entries(context)) {
    result = result.replace(new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, 'g'), value)
  }
  return result
}

/** Read agent name from file-based store for display purposes. */
export function getAgentName(agentId: string): string {
  try {
    const raw = readCached(STORE_KEY)
    if (!raw) return agentId
    const parsed = safeParse<{ state?: { agents?: Array<{ id: string; name: string }> } }>(raw)
    const agent = parsed.state?.agents?.find((a) => a.id === agentId)
    return agent?.name ?? agentId
  } catch {
    return agentId
  }
}
