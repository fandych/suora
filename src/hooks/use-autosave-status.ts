import { useEffect, useRef, useState } from "react"

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
  const latestSnapshotRef = useRef(snapshotKey)
  const onSaveRef = useRef(onSave)
  const saveRunIdRef = useRef(0)

  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  useEffect(() => {
    latestSnapshotRef.current = snapshotKey
  }, [snapshotKey])

  const runSave = async (nextSnapshotKey: string) => {
    const runId = ++saveRunIdRef.current
    setState("saving")
    setError(null)

    try {
      const cleanSnapshotKey = await onSaveRef.current()
      if (runId !== saveRunIdRef.current) {
        return
      }
      if (latestSnapshotRef.current !== nextSnapshotKey) {
        setState("pending")
        return
      }
      cleanSnapshotRef.current = cleanSnapshotKey ?? nextSnapshotKey
      setState("saved")
    } catch (nextError) {
      if (runId !== saveRunIdRef.current) {
        return
      }
      setError(nextError instanceof Error ? nextError : new Error("Autosave failed."))
      setState("error")
    }
  }

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
  }, [delayMs, enabled, snapshotKey])

  return {
    error,
    markClean(snapshot: string) {
      saveRunIdRef.current += 1
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
