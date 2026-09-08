import { EllipsisIcon, HistoryIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, PencilIcon, PlayIcon, SaveIcon, SparklesIcon, Trash2Icon, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { VersionOption } from "@/data/domain/models"
import VersionSelect from "@/views/components/version-select"

type WorkflowHeaderActionsProps = {
  versions: VersionOption[]
  selectedVersionId: string
  onVersionChange: (value: string) => void
  showLibrary: boolean
  canSave: boolean
  canPublish: boolean
  onToggleLibrary: () => void
  onSave: () => void
  onAutoLayout: () => void
  onOpenEdit: () => void
  onOpenHistory: () => void
  onPublish: () => void
  onDelete: () => void
}

export function WorkflowHeaderActions(props: WorkflowHeaderActionsProps) {
  const {
    versions,
    selectedVersionId,
    onVersionChange,
    showLibrary,
    canSave,
    canPublish,
    onToggleLibrary,
    onSave,
    onAutoLayout,
    onOpenEdit,
    onOpenHistory,
    onPublish,
    onDelete,
  } = props

  return (
    <div className="flex w-full items-center justify-between gap-3 rounded-2xl border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
        <Button size="icon-sm" variant="outline" onClick={onToggleLibrary} aria-label={showLibrary ? "Collapse node library" : "Expand node library"}>
          {showLibrary ? <PanelLeftCloseIcon /> : <PanelLeftOpenIcon />}
        </Button>
        <Button size="icon-sm" variant="outline" onClick={onAutoLayout} aria-label="Auto layout workflow">
          <SparklesIcon />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="min-w-28">
          <VersionSelect versions={versions} value={selectedVersionId} onChange={onVersionChange} />
        </div>
        <TooltipProvider>
          <Tooltip><TooltipTrigger render={<Button size="icon-sm" variant="outline" onClick={onSave} disabled={!canSave} aria-label="Save workflow" />}><SaveIcon /></TooltipTrigger><TooltipContent>Save</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger render={<Button size="icon-sm" onClick={onPublish} disabled={!canPublish} aria-label="Publish workflow" />}><UploadIcon /></TooltipTrigger><TooltipContent>Publish</TooltipContent></Tooltip>
        </TooltipProvider>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="icon-sm" variant="outline" aria-label="Workflow actions" />}>
            <EllipsisIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 min-w-48">
            <DropdownMenuItem onClick={onOpenEdit}><PencilIcon />Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenHistory}>
              <HistoryIcon />
              Run history
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} variant="destructive">
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export function WorkflowRevisionActions({
  versions,
  selectedVersionId,
  onVersionChange,
  canSave,
  canPublish,
  onSave,
  onPublish,
  canTryRun,
  onOpenTryRun,
}: Pick<WorkflowHeaderActionsProps, "versions" | "selectedVersionId" | "onVersionChange" | "canSave" | "canPublish" | "onSave" | "onPublish"> & { canTryRun: boolean; onOpenTryRun: () => void }) {
  return (
    <div className="flex h-8 items-center gap-2 rounded-2xl border bg-background/95 px-1 shadow-sm backdrop-blur">
      <div className="min-w-28">
        <VersionSelect versions={versions} value={selectedVersionId} onChange={onVersionChange} />
      </div>
      <TooltipProvider>
        <Tooltip><TooltipTrigger render={<Button className="h-8" size="icon-sm" variant="outline" onClick={onSave} disabled={!canSave} aria-label="Save workflow" />}><SaveIcon /></TooltipTrigger><TooltipContent>Save</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger render={<Button className="h-8" size="icon-sm" onClick={onPublish} disabled={!canPublish} aria-label="Publish workflow" />}><UploadIcon /></TooltipTrigger><TooltipContent>Publish</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger render={<Button className="h-8" size="icon-sm" variant="outline" onClick={onOpenTryRun} disabled={!canTryRun} aria-label="Try run workflow" />}><PlayIcon /></TooltipTrigger><TooltipContent>Try run</TooltipContent></Tooltip>
      </TooltipProvider>
    </div>
  )
}