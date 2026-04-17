/**
 * Rotating file logger for Electron main process
 * Features:
 * - Daily log files with date prefix (2026-03-21.log)
 * - Automatic file rotation when size exceeds limit (2026-03-21.log.1, .2, etc.)
 * - Multiple log levels (debug, info, warn, error)
 * - Async file writes for better performance
 * - Auto-cleanup of old log files
 */

import fs from 'fs/promises'
import { existsSync, createWriteStream, type WriteStream } from 'fs'
import path from 'path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerConfig {
  logDir: string
  maxFileSize: number  // in bytes, default 10MB
  maxFiles: number     // max rotated files per day, default 5
  maxDays: number      // keep logs for N days, default 7
  minLevel: LogLevel   // minimum level to log, default 'info'
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

class RotatingLogger {
  private config: LoggerConfig
  private currentDate: string = ''
  private currentStream: WriteStream | null = null
  private currentFilePath: string = ''
  private currentFileSize: number = 0
  private writeQueue: string[] = []
  private isWriting: boolean = false

  constructor(config: Partial<LoggerConfig>) {
    this.config = {
      logDir: config.logDir || '',
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: config.maxFiles || 5,
      maxDays: config.maxDays || 7,
      minLevel: config.minLevel || 'info',
    }
  }

  async init(): Promise<void> {
    // Create log directory if it doesn't exist
    if (!existsSync(this.config.logDir)) {
      await fs.mkdir(this.config.logDir, { recursive: true })
    }

    // Initialize current date and file
    await this.rotateIfNeeded()

    // Clean up old logs
    await this.cleanupOldLogs()
  }

  private getToday(): string {
    const now = new Date()
    return now.toISOString().split('T')[0] // YYYY-MM-DD
  }

  private async rotateIfNeeded(): Promise<void> {
    const today = this.getToday()

    // Check if we need to rotate (new day or file too large)
    const needsDateRotation = today !== this.currentDate
    const needsSizeRotation = this.currentFileSize >= this.config.maxFileSize

    if (needsDateRotation || needsSizeRotation) {
      // Close current stream
      if (this.currentStream) {
        await this.closeStream()
      }

      // Ensure log directory exists
      if (!existsSync(this.config.logDir)) {
        await fs.mkdir(this.config.logDir, { recursive: true })
      }

      // Find next available file
      if (needsDateRotation) {
        this.currentDate = today
        this.currentFilePath = path.join(this.config.logDir, `${today}.log`)
        this.currentFileSize = 0
      } else {
        // Size rotation - find next number
        let rotateNumber = 1
        while (rotateNumber <= this.config.maxFiles) {
          const testPath = path.join(
            this.config.logDir,
            `${this.currentDate}.log.${rotateNumber}`
          )
          if (!existsSync(testPath)) {
            this.currentFilePath = testPath
            this.currentFileSize = 0
            break
          }
          rotateNumber++
        }

        // If we've hit max files, overwrite the oldest rotation
        if (rotateNumber > this.config.maxFiles) {
          this.currentFilePath = path.join(
            this.config.logDir,
            `${this.currentDate}.log.${this.config.maxFiles}`
          )
          this.currentFileSize = 0
        }
      }

      // Check existing file size
      if (existsSync(this.currentFilePath)) {
        const stats = await fs.stat(this.currentFilePath)
        this.currentFileSize = stats.size
      }

      // Create new stream
      this.currentStream = createWriteStream(this.currentFilePath, { flags: 'a' })
    }
  }

  private async closeStream(): Promise<void> {
    return new Promise((resolve) => {
      if (this.currentStream) {
        this.currentStream.end(() => {
          this.currentStream = null
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.logDir)
      const now = Date.now()
      const maxAge = this.config.maxDays * 24 * 60 * 60 * 1000

      for (const file of files) {
        if (!file.endsWith('.log') && !/\.log\.\d+$/.test(file)) continue

        const filePath = path.join(this.config.logDir, file)
        const stats = await fs.stat(filePath)
        const age = now - stats.mtimeMs

        if (age > maxAge) {
          await fs.unlink(filePath)
          console.log(`[Logger] Cleaned up old log file: ${file}`)
        }
      }
    } catch (error) {
      console.error('[Logger] Failed to cleanup old logs:', error)
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel]
  }

  private formatMessage(level: LogLevel, message: string, meta?: unknown): string {
    const timestamp = new Date().toISOString()
    const levelStr = level.toUpperCase().padEnd(5)
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : ''
    return `[${timestamp}] ${levelStr} ${message}${metaStr}\n`
  }

  private async writeToFile(content: string): Promise<void> {
    this.writeQueue.push(content)

    if (this.isWriting) return

    this.isWriting = true

    // Wait for init to complete before any file I/O
    if (loggerReady) {
      await loggerReady
    }

    while (this.writeQueue.length > 0) {
      const messages = this.writeQueue.splice(0, 10) // Process in batches
      const batch = messages.join('')

      try {
        await this.rotateIfNeeded()

        if (this.currentStream && !this.currentStream.destroyed) {
          const stream = this.currentStream
          await new Promise<void>((resolve, reject) => {
            stream.write(batch, (error) => {
              if (error) reject(error)
              else resolve()
            })
          })

          this.currentFileSize += Buffer.byteLength(batch, 'utf8')
        } else if (this.currentStream?.destroyed) {
          // Stream was destroyed, recreate it
          this.currentStream = null
          await this.rotateIfNeeded()
        }
      } catch (error) {
        console.error('[Logger] Failed to write log:', error)
        // If stream error, reset stream so next write recreates it
        if (this.currentStream) {
          try { this.currentStream.destroy() } catch { /* ignore */ }
          this.currentStream = null
        }
      }
    }

    this.isWriting = false
  }

  public debug(message: string, meta?: unknown): void {
    if (!this.shouldLog('debug')) return
    const formatted = this.formatMessage('debug', message, meta)
    console.debug(message, meta) // Also output to console
    this.writeToFile(formatted)
  }

  public info(message: string, meta?: unknown): void {
    if (!this.shouldLog('info')) return
    const formatted = this.formatMessage('info', message, meta)
    console.log(message, meta)
    this.writeToFile(formatted)
  }

  public warn(message: string, meta?: unknown): void {
    if (!this.shouldLog('warn')) return
    const formatted = this.formatMessage('warn', message, meta)
    console.warn(message, meta)
    this.writeToFile(formatted)
  }

  public error(message: string, meta?: unknown): void {
    if (!this.shouldLog('error')) return
    const formatted = this.formatMessage('error', message, meta)
    console.error(message, meta)
    this.writeToFile(formatted)
  }

  public async close(): Promise<void> {
    // Wait for queue to empty
    while (this.writeQueue.length > 0 || this.isWriting) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    await this.closeStream()
  }
}

// Singleton instance
let loggerInstance: RotatingLogger | null = null

let loggerReady: Promise<void> | null = null

export function initLogger(logDir: string, minLevel: LogLevel = 'info'): RotatingLogger {
  if (!loggerInstance) {
    loggerInstance = new RotatingLogger({
      logDir,
      minLevel,
    })
    loggerReady = loggerInstance.init().catch((err) => {
      console.error('[Logger] Failed to initialize logger:', err)
    })
  }
  return loggerInstance
}

export function waitForLogger(): Promise<void> {
  return loggerReady || Promise.resolve()
}

export function getLogger(): RotatingLogger {
  if (!loggerInstance) {
    throw new Error('Logger not initialized. Call initLogger() first.')
  }
  return loggerInstance
}

export async function closeLogger(): Promise<void> {
  if (loggerInstance) {
    await loggerInstance.close()
    loggerInstance = null
  }
}
