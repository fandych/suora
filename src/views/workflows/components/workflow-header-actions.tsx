import type { ChangeEvent, RefObject } from "react"
import { DownloadIcon, EllipsisIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, PlayIcon, Settings2Icon, SparklesIcon, Trash2Icon, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { VersionOption } from "@/data/domain/models"
import VersionSelect from "@/views/components/version-select"

type WorkflowHeaderActionsProps = {
  versions: VersionOption[]
  selectedVersionId: string
  onVersionChange: (value: string) => void
  showLibrary: boolean
  canPublish: boolean
  canRunRelease: boolean
  onToggleLibrary: () => void
  onAutoLayout: () => void
  onOpenPreference: () => void
  onOpenTryRun: () => void
  onRunRelease: () => void
  onPublish: () => void
  onExport: () => void
  onImport: () => void
  onDelete: () => void
  importInputRef: RefObject<HTMLInputElement | null>
  onImportChange: (event: ChangeEvent<HTMLInputElement>) => void
}

export function WorkflowHeaderActions(props: WorkflowHeaderActionsProps) {
  const {
    versions,
    selectedVersionId,
    onVersionChange,
    showLibrary,
    canPublish,
    canRunRelease,
    onToggleLibrary,
    onAutoLayout,
    onOpenPreference,
    onOpenTryRun,
    onRunRelease,
    onPublish,
    onExport,
    onImport,
    onDelete,
    importInputRef,
    onImportChange,
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
        <Button size="sm" onClick={onPublish} disabled={!canPublish}>
          <UploadIcon />
          Publish
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="icon-sm" variant="outline" aria-label="Workflow actions" />}>
            <EllipsisIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 min-w-48">
            <DropdownMenuItem onClick={onOpenTryRun}>
              <PlayIcon className="size-4" />
              Try run
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRunRelease} disabled={!canRunRelease}>
              <PlayIcon />
              Run release
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExport}>
              <DownloadIcon className="size-4" />
              Export
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onImport}>
              <UploadIcon className="size-4" />
              Import
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenPreference}>
              <Settings2Icon className="size-4" />
              Preference
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} variant="destructive">
              <Trash2Icon className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void onImportChange(event)} />
    </div>
  )
}