import { useEffect, useRef } from "react"

export function WorkflowPanelResizeHandle({ label, onResize }: { label: string; onResize: (deltaX: number) => void }) {
  const startX = useRef<number | null>(null)
  const pointerId = useRef<number | null>(null)
  const onResizeRef = useRef(onResize)

  useEffect(() => {
    onResizeRef.current = onResize
  }, [onResize])

  useEffect(() => () => {
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
  }, [])

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="nodrag nopan absolute top-1/2 -left-1 z-50 h-12 w-1 -translate-y-1/2 touch-none cursor-ew-resize rounded-full border-border/70 bg-border/80 hover:bg-primary"
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        startX.current = event.clientX
        pointerId.current = event.pointerId
        event.currentTarget.setPointerCapture(event.pointerId)
        document.body.style.cursor = "ew-resize"
        document.body.style.userSelect = "none"
      }}
      onPointerMove={(event) => {
        if (event.pointerId !== pointerId.current || startX.current === null) return
        const deltaX = event.clientX - startX.current
        if (deltaX === 0) return
        startX.current = event.clientX
        onResizeRef.current(deltaX)
      }}
      onMouseDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        let previousX = event.clientX
        const handleMove = (moveEvent: MouseEvent) => {
          const deltaX = moveEvent.clientX - previousX
          if (deltaX === 0) return
          previousX = moveEvent.clientX
          onResizeRef.current(deltaX)
        }
        const handleEnd = () => {
          window.removeEventListener("mousemove", handleMove)
          window.removeEventListener("mouseup", handleEnd)
          document.body.style.cursor = ""
          document.body.style.userSelect = ""
        }
        window.addEventListener("mousemove", handleMove)
        window.addEventListener("mouseup", handleEnd, { once: true })
        document.body.style.cursor = "ew-resize"
        document.body.style.userSelect = "none"
      }}
      onPointerUp={(event) => {
        if (event.pointerId !== pointerId.current) return
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
        pointerId.current = null
        startX.current = null
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }}
      onPointerCancel={(event) => {
        if (event.pointerId !== pointerId.current) return
        pointerId.current = null
        startX.current = null
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }}
    />
  )
}
