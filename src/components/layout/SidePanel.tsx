import { useEffect, useRef, type ReactNode } from 'react'

const MIN_PANEL_WIDTH = 224
const MAX_PANEL_WIDTH = 360

function clampPanelWidth(width?: number): number {
  return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Math.round(width ?? 280)))
}

interface SidePanelProps {
  title: string
  children: ReactNode
  action?: ReactNode
  /** Panel width in pixels. When provided, overrides the default w-70. */
  width?: number
}

export function SidePanel({ title, children, action, width }: SidePanelProps) {
  const panelRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!panelRef.current) return
    panelRef.current.style.width = `${clampPanelWidth(width)}px`
  }, [width])

  return (
    <aside
      ref={panelRef}
      aria-label={title}
      className="module-side-panel h-full min-h-0 w-70 shrink-0 overflow-hidden border-r border-border-subtle/80 bg-surface-1/92 flex flex-col"
    >
      <div className="h-11 px-3 flex items-center justify-between border-b border-border-subtle/80 shrink-0">
        <h2 className="truncate text-[13px] font-semibold text-text-secondary">{title}</h2>
        {action}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {children}
      </div>
    </aside>
  )
}
