/**
 * Lightweight startup instrumentation helpers.
 *
 * Wraps the standard `performance` API and emits a `console.debug` line in
 * development builds so cold-start regressions are easy to spot. In production
 * the marks/measures are still recorded (for devtools/profilers) but no
 * console output is produced.
 */

const isDev = (() => {
  try {
    // import.meta.env exists in Vite-built renderer; guard for non-Vite contexts (tests, node).
    const meta = import.meta as unknown as { env?: { DEV?: boolean; MODE?: string } }
    if (typeof meta?.env?.DEV === 'boolean') return meta.env.DEV
    if (meta?.env?.MODE) return meta.env.MODE !== 'production'
  } catch {
    // ignore — fall through to NODE_ENV check below
  }
  try {
    return typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production'
  } catch {
    return false
  }
})()

function getPerf(): Performance | null {
  if (typeof performance === 'undefined') return null
  return performance
}

export function markPerf(name: string): void {
  const perf = getPerf()
  if (!perf) return
  try {
    perf.mark(name)
  } catch {
    // ignore: name may already exist or environment doesn't allow marks
  }
}

export function measurePerf(name: string, startMark: string, endMark: string): number | null {
  const perf = getPerf()
  if (!perf) return null
  try {
    const entry = perf.measure(name, startMark, endMark)
    const duration = entry?.duration ?? null
    if (isDev && typeof duration === 'number') {
      console.debug(`[perf] ${name}: ${duration.toFixed(1)}ms`)
    }
    return duration
  } catch {
    return null
  }
}
