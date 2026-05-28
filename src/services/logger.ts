/**
 * Renderer-side logger that forwards logs to main process
 * Usage:
 *   import { logger } from '@/services/logger'
 *   logger.info('Something happened', { userId: 123 })
 *   logger.error('Error occurred', error)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type ElectronLoggerBridge = {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
}

const MAX_LOG_MESSAGE_LENGTH = 10_000

function getElectron(): ElectronLoggerBridge | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as { electron?: ElectronLoggerBridge }).electron
}

function truncateMessage(message: string): string {
  if (message.length <= MAX_LOG_MESSAGE_LENGTH) return message
  return `${message.slice(0, MAX_LOG_MESSAGE_LENGTH)}…[truncated]`
}

function stringifyUnknown(value: unknown): string {
  if (value instanceof Error) return value.message
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function normalizeError(reason: unknown, fallback: string): Error {
  if (reason instanceof Error) return reason
  const message = typeof reason === 'string' && reason.trim() ? reason : fallback
  return new Error(message)
}

class RendererLogger {
  private async writeLog(level: LogLevel, message: string, meta?: unknown): Promise<void> {
    const electron = getElectron()
    if (!electron) {
      // Fallback to console if electron not available
      console[level](message, meta)
      return
    }

    try {
      await electron.invoke('log:write', level, message, meta)
    } catch (error) {
      console.error('[Logger] Failed to write log:', error)
    }
  }

  public debug(message: string, meta?: unknown): void {
    const normalized = truncateMessage(message)
    console.debug(normalized, meta)
    this.writeLog('debug', normalized, meta)
  }

  public info(message: string, meta?: unknown): void {
    const normalized = truncateMessage(message)
    console.log(normalized, meta)
    this.writeLog('info', normalized, meta)
  }

  public warn(message: string, meta?: unknown): void {
    const normalized = truncateMessage(message)
    console.warn(normalized, meta)
    this.writeLog('warn', normalized, meta)
  }

  public error(message: string, meta?: unknown): void {
    const normalized = truncateMessage(message)
    console.error(normalized, meta)
    this.writeLog('error', normalized, meta)
  }
}

export const logger = new RendererLogger()

export async function reportRendererCrash(error: Error, source: string, extra?: Record<string, unknown>): Promise<void> {
  const electron = getElectron()
  if (!electron) return

  try {
    await electron.invoke('crash:report', {
      message: truncateMessage(error.message || 'Unknown renderer error'),
      stack: error.stack,
      source,
      ...extra,
    })
  } catch (reportError) {
    console.error('[Logger] Failed to report renderer crash:', reportError)
  }
}

let runtimeLoggingCleanup: (() => void) | null = null

export function initRendererRuntimeLogging(): () => void {
  if (typeof window === 'undefined') return () => {}
  if (runtimeLoggingCleanup) return runtimeLoggingCleanup

  const handleError = (event: ErrorEvent) => {
    const error = normalizeError(event.error, event.message || 'Unhandled renderer error')
    const meta = {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: error.stack,
    }
    logger.error('Unhandled renderer error', meta)
    void reportRendererCrash(error, 'window:error', meta)
  }

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const error = normalizeError(event.reason, 'Unhandled promise rejection')
    const meta = {
      reason: stringifyUnknown(event.reason),
      stack: error.stack,
    }
    logger.error('Unhandled renderer promise rejection', meta)
    void reportRendererCrash(error, 'window:unhandledrejection', meta)
  }

  window.addEventListener('error', handleError)
  window.addEventListener('unhandledrejection', handleUnhandledRejection)

  runtimeLoggingCleanup = () => {
    window.removeEventListener('error', handleError)
    window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    runtimeLoggingCleanup = null
  }

  return runtimeLoggingCleanup
}
