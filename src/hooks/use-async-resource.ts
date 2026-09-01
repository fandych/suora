import type { Dispatch, SetStateAction } from "react"
import { useEffect, useEffectEvent, useState } from "react"

type AsyncResourceState<T> = {
  data: T | null
  error: Error | null
  isLoading: boolean
  reload: () => void
  setData: Dispatch<SetStateAction<T | null>>
}

export function useAsyncResource<T>(loader: () => Promise<T>, dependencies: readonly unknown[]): AsyncResourceState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)
  const runLoader = useEffectEvent(loader)

  useEffect(() => {
    let cancelled = false

    setIsLoading(true)
    setError(null)

    runLoader()
      .then((result) => {
        if (cancelled) {
          return
        }

        setData(result)
        setIsLoading(false)
      })
      .catch((nextError: unknown) => {
        if (cancelled) {
          return
        }

        setError(nextError instanceof Error ? nextError : new Error("Unknown error"))
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, reloadToken])

  return {
    data,
    error,
    isLoading,
    reload: () => setReloadToken((value) => value + 1),
    setData,
  }
}