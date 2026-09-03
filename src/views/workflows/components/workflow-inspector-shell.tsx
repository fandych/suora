import { PanelRightOpenIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function WorkflowInspectorShell({
  isOpen,
  onOpen,
  children,
}: {
  isOpen: boolean
  onOpen: () => void
  children: React.ReactNode
}) {
  if (isOpen) {
    return <div className="max-h-[calc(100vh-10rem)] overflow-hidden rounded-2xl border bg-card shadow-sm">{children}</div>
  }

  return (
    <div className="rounded-2xl border bg-card p-2 shadow-sm">
      <Button size="sm" variant="ghost" onClick={onOpen}>
        <PanelRightOpenIcon />
      </Button>
    </div>
  )
}