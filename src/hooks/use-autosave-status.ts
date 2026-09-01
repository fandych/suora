import { useEffect, useEffectEvent, useRef, useState } from "react"

export type AutosaveState = "saved" | "pending" | "saving" | "error"

type UseAutosaveStatusOptions = {
  delayMs?: number
  enabled: boolean
  onSave: () => Promise<string | void>
  snapshotKey: string
}

export function useAutosaveStatus({ delayMs = 900, enabled, onSave, snapshotKey }: UseAutosaveStatusOptions) {
  const [state, setState] = useState<AutosaveState>("saved")
  const [error, setError] = useState<Error | null>(null)
  const cleanSnapshotRef = useRef(snapshotKey)
  const runSave = useEffectEvent(async (nextSnapshotKey: string) => {
    setState("saving")
    setError(null)

    try {
      const cleanSnapshotKey = await onSave()
      cleanSnapshotRef.current = cleanSnapshotKey ?? nextSnapshotKey
      setState("saved")
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError : new Error("Autosave failed."))
      setState("error")
    }
  })

  useEffect(() => {
    if (!enabled) {
      return
    }
    if (snapshotKey === cleanSnapshotRef.current) {
      return
    }

    setState("pending")
    const timeoutId = window.setTimeout(() => {
      void runSave(snapshotKey)
    }, delayMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [delayMs, enabled, runSave, snapshotKey])

  return {
    error,
    markClean(snapshot: string) {
      cleanSnapshotRef.current = snapshot
      setError(null)
      setState("saved")
    },
    saveNow: async () => {
      await runSave(snapshotKey)
    },
    state,
  }
}
