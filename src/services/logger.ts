/**
 * Renderer-side logger that forwards logs to main process
 * Usage:
 *   import { logger } from '@/services/logger'
 *   logger.info('Something happened', { userId: 123 })
 *   logger.error('Error occurred', error)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

class RendererLogger {
  private async writeLog(level: LogLevel, message: string, meta?: unknown): Promise<void> {
    const electron = (window as { electron?: { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> } }).electron
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
    console.debug(message, meta)
    this.writeLog('debug', message, meta)
  }

  public info(message: string, meta?: unknown): void {
    console.log(message, meta)
    this.writeLog('info', message, meta)
  }

  public warn(message: string, meta?: unknown): void {
    console.warn(message, meta)
    this.writeLog('warn', message, meta)
  }

  public error(message: string, meta?: unknown): void {
    console.error(message, meta)
    this.writeLog('error', message, meta)
  }
}

export const logger = new RendererLogger()
