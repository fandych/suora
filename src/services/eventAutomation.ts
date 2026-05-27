// Event-Driven Automation — monitors file changes, clipboard changes,
// and app lifecycle events to automatically trigger agent actions.
//
// Keeps state in file-based storage to avoid circular deps with appStore.

import type { EventTrigger } from '@/types'
import { fileStateStorage, readCached, writeCached } from '@/services/fileStorage'
import { safeParse, safeStringify } from '@/utils/safeJson'
import { CronExpressionParser } from 'cron-parser'

type ElectronBridge = { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> }

function getElectron(): ElectronBridge | undefined {
  return (window as unknown as { electron?: ElectronBridge }).electron
}

const STORE_KEY = 'suora-store'
const EVENTS_STORAGE_KEY = 'suora-event-triggers'
const CLIPBOARD_POLL_INTERVAL_MS = 2000
const SCHEDULE_CHECK_INTERVAL_MS = 30_000

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

export async function hydrateTriggers(): Promise<EventTrigger[]> {
  await fileStateStorage.getItem(EVENTS_STORAGE_KEY)
  return loadTriggers()
}

// ─── Event monitoring ───────────────────────────────────────────────

let clipboardPollTimer: ReturnType<typeof setInterval> | null = null
let scheduleCheckTimer: ReturnType<typeof setInterval> | null = null
let lastClipboardContent = ''
let eventHandler: ((trigger: EventTrigger, context: Record<string, string>) => void) | null = null

/**
 * Start the event monitoring system.
 * @param onEvent  Called when an event fires, with the trigger and context variables
 */
export function startEventMonitor(
  onEvent: (trigger: EventTrigger, context: Record<string, string>) => void,
): void {
  stopEventMonitor()
  eventHandler = onEvent

  // Fire app_start triggers
  const triggers = loadTriggers().filter((t) => t.enabled && t.type === 'app_start')
  for (const trigger of triggers) {
    fireEvent(trigger, { event: 'app_start' })
  }

  // Start clipboard monitoring
  clipboardPollTimer = setInterval(() => {
    void checkClipboard()
  }, CLIPBOARD_POLL_INTERVAL_MS)

  scheduleCheckTimer = setInterval(() => {
    checkSchedules()
  }, SCHEDULE_CHECK_INTERVAL_MS)
}

/**
 * Stop all event monitoring.
 */
export function stopEventMonitor(): void {
  if (clipboardPollTimer) {
    clearInterval(clipboardPollTimer)
    clipboardPollTimer = null
  }
  if (scheduleCheckTimer) {
    clearInterval(scheduleCheckTimer)
    scheduleCheckTimer = null
  }
  eventHandler = null
  lastClipboardContent = ''
}

function isScheduleDue(trigger: EventTrigger, now: number): boolean {
  if (!trigger.pattern?.trim()) return false

  try {
    const baseTime = trigger.lastTriggered ?? trigger.createdAt
    const interval = CronExpressionParser.parse(trigger.pattern, { currentDate: new Date(baseTime) })
    return interval.next().getTime() <= now
  } catch {
    return false
  }
}

function checkSchedules(): void {
  const now = Date.now()
  const triggers = loadTriggers().filter((trigger) => trigger.enabled && trigger.type === 'schedule')
  for (const trigger of triggers) {
    if (isScheduleDue(trigger, now)) {
      fireEvent(trigger, {
        event: 'schedule',
        schedule: trigger.pattern ?? '',
        firedAt: new Date(now).toISOString(),
      })
    }
  }
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

function matchesFilePattern(filePath: string, pattern: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const normalizedPattern = pattern.replace(/\\/g, '/')

  if (!normalizedPattern.includes('*') && !normalizedPattern.includes('?')) {
    return normalizedPath.toLowerCase().includes(normalizedPattern.toLowerCase())
  }

  const target = normalizedPattern.includes('/')
    ? normalizedPath
    : normalizedPath.split('/').pop() ?? normalizedPath

  let source = ''
  for (let index = 0; index < normalizedPattern.length; index += 1) {
    const char = normalizedPattern[index]
    const next = normalizedPattern[index + 1]

    if (char === '*' && next === '*') {
      if (normalizedPattern[index + 2] === '/') {
        source += '(?:.*/)?'
        index += 2
      } else {
        source += '.*'
        index += 1
      }
    } else if (char === '*') {
      source += '[^/]*'
    } else if (char === '?') {
      source += '[^/]'
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }
  }

  try {
    return new RegExp(`^${source}$`, 'i').test(target)
  } catch {
    return false
  }
}

/**
 * Manually fire a file_change event (called from the skill hot-reload watcher).
 */
export function fireFileChangeEvent(filePath: string, content?: string): void {
  const triggers = loadTriggers().filter((t) => t.enabled && t.type === 'file_change')
  for (const trigger of triggers) {
    if (trigger.pattern) {
      if (!matchesFilePattern(filePath, trigger.pattern)) continue
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
  const escapeRegex = (s: string) => s.replace(/[-.*+?^${}()|[\]\\]/g, '\\$&')
  for (const [key, value] of Object.entries(context)) {
    // Use function replacer to avoid $-substitution in replacement string
    result = result.replace(new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, 'g'), () => value)
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
