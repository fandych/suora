import { MinusIcon, PlusIcon, ScanIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

type WorkflowZoomControlsProps = {
  zoom: number
  onZoomOut: () => void
  onZoomIn: () => void
  onFitView: () => void
}

export function WorkflowZoomControls({ zoom, onZoomOut, onZoomIn, onFitView }: WorkflowZoomControlsProps) {
  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-full border bg-background/95 px-2 py-1 shadow-sm backdrop-blur">
      <Button size="icon-sm" variant="ghost" onClick={onZoomOut} aria-label="Zoom out">
        <MinusIcon />
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={onZoomIn} aria-label="Zoom in">
        <PlusIcon />
      </Button>
      <div className="min-w-12 text-center text-[11px] font-medium text-foreground">{Math.round(zoom * 100)}%</div>
      <Button size="sm" variant="ghost" onClick={onFitView}>
        <ScanIcon />
        Full
      </Button>
    </div>
  )
}