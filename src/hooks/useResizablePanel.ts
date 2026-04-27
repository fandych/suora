import { useState, useCallback } from 'react'

const DEFAULT_MIN_WIDTH = 224
const DEFAULT_MAX_WIDTH = 360

function clampPanelWidth(width: number): number {
  return Math.min(DEFAULT_MAX_WIDTH, Math.max(DEFAULT_MIN_WIDTH, Math.round(width)))
}

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
      if (!Number.isNaN(parsed) && parsed > 0) return clampPanelWidth(parsed)
    }
    return clampPanelWidth(defaultWidth)
  })

  const setWidth = useCallback(
    (newWidth: number) => {
      const nextWidth = clampPanelWidth(newWidth)
      setWidthState(nextWidth)
      localStorage.setItem(`panel-width:${key}`, String(nextWidth))
    },
    [key],
  )

  return [width, setWidth]
}
