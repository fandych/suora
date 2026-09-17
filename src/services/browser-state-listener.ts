type BrowserStatePayload = {
  sessionId?: string
  open?: boolean
  visible?: boolean
  url?: string
  loading?: boolean
  error?: string
}

type BrowserStateListener = (payload: BrowserStatePayload) => void

export function subscribeToBrowserState(listener: BrowserStateListener) {
  const bridgeListener = (...args: unknown[]) => {
    const payload = args[1] as BrowserStatePayload | undefined
    if (payload) {
      listener(payload)
    }
  }

  window.electron?.on?.("tools:browserStateChanged", bridgeListener)
  return () => window.electron?.off?.("tools:browserStateChanged", bridgeListener)
}