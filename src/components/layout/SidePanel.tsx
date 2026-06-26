import { useEffect, useRef, type ReactNode } from 'react'

const MIN_PANEL_WIDTH = 280
const MAX_PANEL_WIDTH = 420

function clampPanelWidth(width?: number): number {
  return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Math.round(width ?? 320)))
}

interface SidePanelProps {
  title: string
  children: ReactNode
  action?: ReactNode
  /** Panel width in pixels. When provided, overrides the default width. */
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
      className="module-side-panel h-full min-h-0 w-80 shrink-0 overflow-hidden border-r border-border-subtle/80 bg-surface-1/92 flex flex-col"
    >
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border-subtle/80 px-3.5 py-2 shrink-0">
        <h2 className="truncate text-sm font-semibold text-text-primary">{title}</h2>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {children}
      </div>
    </aside>
  )
}
