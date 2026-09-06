import { useEffect, useRef } from "react"

export function WorkflowPanelResizeHandle({ label, onResize }: { label: string; onResize: (deltaX: number) => void }) {
  const startX = useRef<number | null>(null)
  const pointerId = useRef<number | null>(null)

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (pointerId.current === null || startX.current === null || event.pointerId !== pointerId.current) {
        return
      }
      const deltaX = event.clientX - startX.current
      if (deltaX === 0) {
        return
      }
      startX.current = event.clientX
      onResize(deltaX)
    }
    const handleEnd = (event: PointerEvent) => {
      if (event.pointerId === pointerId.current) {
        pointerId.current = null
        startX.current = null
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }
    }
    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleEnd)
    window.addEventListener("pointercancel", handleEnd)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleEnd)
      window.removeEventListener("pointercancel", handleEnd)
    }
  }, [onResize])

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="nodrag nopan absolute top-1/2 -left-3 z-50 h-16 w-3 -translate-y-1/2 touch-none cursor-ew-resize rounded-full border border-border/70 bg-background/90 shadow-sm hover:bg-primary"
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        startX.current = event.clientX
        pointerId.current = event.pointerId
        document.body.style.cursor = "ew-resize"
        document.body.style.userSelect = "none"
      }}
    />
  )
}
