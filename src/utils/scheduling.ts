type IdleHandle = number
type AnimationHandle = number

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => IdleHandle
  cancelIdleCallback?: (handle: IdleHandle) => void
}

export interface ScheduledTask {
  cancel: () => void
}

export function scheduleAfterPaint(task: () => void): ScheduledTask {
  let animationFrameId: AnimationHandle | null = null
  let timeoutId: number | null = null
  let cancelled = false

  animationFrameId = window.requestAnimationFrame(() => {
    animationFrameId = null
    timeoutId = window.setTimeout(() => {
      timeoutId = null
      if (!cancelled) task()
    }, 0)
  })

  return {
    cancel: () => {
      cancelled = true
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
        animationFrameId = null
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
        timeoutId = null
      }
    },
  }
}

export function scheduleWhenIdle(task: () => void, timeout = 2000): ScheduledTask {
  const win = window as IdleWindow
  let fallbackTask: ScheduledTask | null = null
  let idleHandle: IdleHandle | null = null
  let cancelled = false

  if (typeof win.requestIdleCallback === 'function') {
    idleHandle = win.requestIdleCallback(() => {
      idleHandle = null
      if (!cancelled) task()
    }, { timeout })
    return {
      cancel: () => {
        cancelled = true
        if (idleHandle !== null && typeof win.cancelIdleCallback === 'function') {
          win.cancelIdleCallback(idleHandle)
          idleHandle = null
        }
      },
    }
  }

  fallbackTask = scheduleAfterPaint(() => {
    window.setTimeout(() => {
      if (!cancelled) task()
    }, Math.max(0, timeout))
  })

  return {
    cancel: () => {
      cancelled = true
      fallbackTask?.cancel()
      fallbackTask = null
    },
  }
}

export function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    scheduleAfterPaint(resolve)
  })
}
