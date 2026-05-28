import { afterEach, describe, expect, it, vi } from 'vitest'
import { initRendererRuntimeLogging, logger, reportRendererCrash } from './logger'

function getElectronInvoke() {
  const electron = (window as unknown as { electron: { invoke: ReturnType<typeof vi.fn> } }).electron
  return electron.invoke
}

describe('renderer logger', () => {
  let cleanupRuntimeLogging: (() => void) | null = null

  afterEach(() => {
    cleanupRuntimeLogging?.()
    cleanupRuntimeLogging = null
    vi.clearAllMocks()
  })

  it('forwards truncated renderer log messages to Electron', () => {
    const invoke = getElectronInvoke()
    const message = 'x'.repeat(10_050)

    logger.info(message)

    expect(invoke).toHaveBeenCalledWith(
      'log:write',
      'info',
      `${'x'.repeat(10_000)}…[truncated]`,
      undefined,
    )
  })

  it('reports React and renderer crash details through the crash IPC channel', async () => {
    const invoke = getElectronInvoke()
    const error = new Error('renderer failed')

    await reportRendererCrash(error, 'react:error-boundary', { errorId: 'err-test' })

    expect(invoke).toHaveBeenCalledWith('crash:report', expect.objectContaining({
      message: 'renderer failed',
      stack: error.stack,
      source: 'react:error-boundary',
      errorId: 'err-test',
    }))
  })

  it('captures unhandled renderer errors and promise rejections', () => {
    const invoke = getElectronInvoke()
    cleanupRuntimeLogging = initRendererRuntimeLogging()

    const runtimeError = new Error('boom')
    window.dispatchEvent(new ErrorEvent('error', {
      message: runtimeError.message,
      error: runtimeError,
      filename: 'app.js',
      lineno: 12,
      colno: 34,
    }))

    const rejection = typeof PromiseRejectionEvent === 'function'
      ? new PromiseRejectionEvent('unhandledrejection', {
        reason: new Error('async boom'),
        promise: Promise.resolve(),
      })
      : new Event('unhandledrejection')
    if (!('reason' in rejection)) {
      Object.defineProperty(rejection, 'reason', { value: new Error('async boom') })
    }
    window.dispatchEvent(rejection)

    expect(invoke).toHaveBeenCalledWith('log:write', 'error', 'Unhandled renderer error', expect.objectContaining({
      filename: 'app.js',
      lineno: 12,
      colno: 34,
    }))
    expect(invoke).toHaveBeenCalledWith('crash:report', expect.objectContaining({
      message: 'boom',
      source: 'window:error',
    }))
    expect(invoke).toHaveBeenCalledWith('log:write', 'error', 'Unhandled renderer promise rejection', expect.objectContaining({
      reason: 'async boom',
    }))
    expect(invoke).toHaveBeenCalledWith('crash:report', expect.objectContaining({
      message: 'async boom',
      source: 'window:unhandledrejection',
    }))
  })
})
