type BrowserStatePayload = {
  sessionId?: string
  open?: boolean
  visible?: boolean
  url?: string
  loading?: boolean
  error?: string
}

type BrowserStateListener = (payload: BrowserStatePayload) => void

let warnedMissingBridge = false

export function subscribeToBrowserState(listener: BrowserStateListener) {
  const electronBridge = window.electron
  if (!electronBridge?.on || !electronBridge?.off) {
    if (!warnedMissingBridge) {
      warnedMissingBridge = true
      console.warn("Browser state listener is unavailable because the Electron bridge is missing.")
    }
    return () => undefined
  }
  const bridgeListener = (...args: unknown[]) => {
    const payload = args[1] as BrowserStatePayload | undefined
    if (payload) {
      listener(payload)
    }
  }

    electronBridge.on("tools:browserStateChanged", bridgeListener)
    return () => electronBridge.off("tools:browserStateChanged", bridgeListener)
}