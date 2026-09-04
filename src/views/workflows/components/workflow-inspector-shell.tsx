import { PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function WorkflowInspectorShell({
  isOpen,
  onOpen,
  onClose,
  title,
  description,
  children,
}: {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  title: string
  description: string
  children: React.ReactNode
}) {
  if (isOpen) {
    return (
      <div className="max-h-[calc(100vh-10rem)] overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{description}</div>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}>
            <PanelRightCloseIcon />
          </Button>
        </div>
        {children}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-card p-2 shadow-sm">
      <Button size="sm" variant="ghost" onClick={onOpen}>
        <PanelRightOpenIcon />
      </Button>
    </div>
  )
}