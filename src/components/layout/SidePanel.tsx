import { useEffect, useRef, type ReactNode } from 'react'

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
    panelRef.current.style.width = `${width ?? 340}px`
  }, [width])

  return (
    <aside
      ref={panelRef}
      aria-label={title}
      className="h-full w-[340px] bg-surface-1/40 backdrop-blur-xl border-r border-border-subtle/50 flex flex-col shrink-0"
    >
      <div className="h-16 px-6 flex items-center justify-between border-b border-border-subtle/50 shrink-0">
        <h2 className="font-display text-[12px] font-semibold text-text-muted tracking-[0.16em] uppercase">{title}</h2>
        {action}
      </div>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </aside>
  )
}
