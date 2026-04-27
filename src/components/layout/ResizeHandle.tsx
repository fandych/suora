import { useCallback, useEffect, useRef, useState } from 'react'

interface ResizeHandleProps {
  /** Current width in pixels */
  width: number
  /** Callback when width changes during drag */
  onResize: (width: number) => void
  /** Minimum width in pixels (default: 200) */
  minWidth?: number
  /** Maximum width in pixels (default: 500) */
  maxWidth?: number
  /** Side of the panel: 'left' means handle is on the right edge, 'right' means handle is on the left edge */
  side?: 'left' | 'right'
}

export function ResizeHandle({
  width,
  onResize,
  minWidth = 224,
  maxWidth = 360,
  side = 'left',
}: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      startXRef.current = e.clientX
      startWidthRef.current = width
    },
    [width],
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const safeMinWidth = Math.max(224, minWidth)
      const safeMaxWidth = Math.min(360, Math.max(safeMinWidth, maxWidth))
      const delta = side === 'left'
        ? e.clientX - startXRef.current
        : startXRef.current - e.clientX
      const newWidth = Math.round(
        Math.min(safeMaxWidth, Math.max(safeMinWidth, startWidthRef.current + delta)),
      )
      onResize(newWidth)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    // Prevent text selection during drag
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isDragging, onResize, minWidth, maxWidth, side])

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`
        w-1 shrink-0 cursor-col-resize relative group my-1 rounded-full
        ${isDragging ? 'bg-accent/40' : 'bg-transparent hover:bg-accent/20'}
        transition-colors duration-150
      `}
    >
      {/* Wider invisible hit area */}
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  )
}
