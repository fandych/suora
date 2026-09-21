import { DownloadIcon, PlayIcon, SaveIcon, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type WorkflowRevisionActionsProps = {
  canSave: boolean
  onSave: () => void
  canTryRun: boolean
  onOpenTryRun: () => void
  onExport: () => void
  onImport: () => void
  importDisabled?: boolean
}

function WorkflowActionButton({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button className="h-8" size="icon-sm" variant="outline" type="button" aria-label={label} title={label} />}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function WorkflowRevisionActions({
  canSave,
  onSave,
  canTryRun,
  onOpenTryRun,
  onExport,
  onImport,
  importDisabled = false,
}: WorkflowRevisionActionsProps) {
  return (
    <div className="flex h-8 items-center gap-2 rounded-2xl border bg-background/95 px-1 shadow-sm backdrop-blur">
      <TooltipProvider>
        <WorkflowActionButton label="Import workflow" disabled={importDisabled} onClick={onImport}>
            <UploadIcon />
        </WorkflowActionButton>
        <WorkflowActionButton label="Export workflow" onClick={onExport}>
            <DownloadIcon />
        </WorkflowActionButton>
        <WorkflowActionButton label="Save workflow" disabled={!canSave} onClick={onSave}>
            <SaveIcon />
        </WorkflowActionButton>
        <WorkflowActionButton label="Try run workflow" disabled={!canTryRun} onClick={onOpenTryRun}>
            <PlayIcon />
        </WorkflowActionButton>
      </TooltipProvider>
    </div>
  )
}
