import { CronExpressionParser } from 'cron-parser'

// ─── IPC helpers ────────────────────────────────────────────────────

export function electronInvoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const electron = (window as unknown as { electron?: { invoke: (ch: string, ...a: unknown[]) => Promise<unknown> } }).electron
  if (!electron?.invoke) return Promise.reject(new Error('Electron IPC not available'))
  return electron.invoke(channel, ...args)
}

export function electronOn(channel: string, listener: (...args: unknown[]) => void) {
  const electron = (window as unknown as { electron?: { on: (ch: string, fn: (...a: unknown[]) => void) => void } }).electron
  electron?.on(channel, listener)
}

export function electronOff(channel: string, listener: (...args: unknown[]) => void) {
  const electron = (window as unknown as { electron?: { off: (ch: string, fn: (...a: unknown[]) => void) => void } }).electron
  electron?.off(channel, listener)
}

export const TIMER_REFRESH_INTERVAL_MS = 30_000

// ─── Time formatting helpers ────────────────────────────────────────

/** Convert an ISO date string to a local datetime-local input value (YYYY-MM-DDTHH:MM) */
export function toLocalDatetimeValue(isoStr: string): string {
  const d = new Date(isoStr)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatRelative(ts?: number): string {
  if (!ts) return '—'
  const now = Date.now()
  const diff = ts - now
  if (diff < 0) return 'overdue'
  if (diff < 60_000) return 'less than a minute'
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h`
  return `${Math.round(diff / 86_400_000)}d`
}

export function formatDateTime(ts?: number): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}

/**
 * Validate cron expression and return next execution times
 */
export function getNextCronExecutions(cronExpr: string, count: number = 5): Date[] {
  try {
    const interval = CronExpressionParser.parse(cronExpr)
    const executions: Date[] = []
    for (let i = 0; i < count; i++) {
      executions.push(interval.next().toDate())
    }
    return executions
  } catch {
    return []
  }
}

// ─── Shared types ───────────────────────────────────────────────────

export interface TimerFormData {
  name: string
  type: import('@/types').TimerType
  schedule: string
  action: 'notify' | 'prompt' | 'pipeline'
  prompt: string
  agentId: string
  pipelineId: string
}
