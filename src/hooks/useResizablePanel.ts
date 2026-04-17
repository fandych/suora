import { useState, useCallback } from 'react'

/**
 * Hook to manage a resizable panel width with localStorage persistence.
 */
export function useResizablePanel(
  key: string,
  defaultWidth: number = 280,
): [number, (width: number) => void] {
  const [width, setWidthState] = useState<number>(() => {
    const saved = localStorage.getItem(`panel-width:${key}`)
    if (saved) {
      const parsed = Number(saved)
      if (!Number.isNaN(parsed) && parsed > 0) return parsed
    }
    return defaultWidth
  })

  const setWidth = useCallback(
    (newWidth: number) => {
      setWidthState(newWidth)
      localStorage.setItem(`panel-width:${key}`, String(newWidth))
    },
    [key],
  )

  return [width, setWidth]
}
