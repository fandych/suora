import type { RefObject } from "react"
import { DownloadIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, PanelRightCloseIcon, PanelRightOpenIcon, PlayIcon, SaveIcon, UploadIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { VersionOption } from "@/data/domain/models"
import VersionSelect from "@/views/components/version-select"

type WorkflowHeaderActionsProps = {
  versions: VersionOption[]
  selectedVersionId: string
  onVersionChange: (value: string) => void
  isReleaseVersion: boolean
  hasUnsavedChanges: boolean
  issueCount: number
  showLibrary: boolean
  showInspector: boolean
  canRunRelease: boolean
  canSaveDraft: boolean
  canPublish: boolean
  onToggleLibrary: () => void
  onToggleInspector: () => void
  onRunRelease: () => void
  onSaveDraft: () => void
  onPublish: () => void
  onExport: () => void
  onImport: () => void
  importInputRef: RefObject<HTMLInputElement | null>
  onImportChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}

export function WorkflowHeaderActions(props: WorkflowHeaderActionsProps) {
  const {
    versions,
    selectedVersionId,
    onVersionChange,
    isReleaseVersion,
    hasUnsavedChanges,
    issueCount,
    showLibrary,
    showInspector,
    canRunRelease,
    canSaveDraft,
    canPublish,
    onToggleLibrary,
    onToggleInspector,
    onRunRelease,
    onSaveDraft,
    onPublish,
    onExport,
    onImport,
    importInputRef,
    onImportChange,
  } = props

  return (
    <>
      <VersionSelect versions={versions} value={selectedVersionId} onChange={onVersionChange} />
      <Badge variant={isReleaseVersion ? "secondary" : "outline"}>{isReleaseVersion ? "Release revision" : "Draft revision"}</Badge>
      <Badge variant={hasUnsavedChanges ? "destructive" : "outline"}>{hasUnsavedChanges ? "Unsaved changes" : "Saved"}</Badge>
      <Badge variant={issueCount ? "destructive" : "outline"}>{issueCount} design issue{issueCount === 1 ? "" : "s"}</Badge>
      <Button size="sm" variant="outline" onClick={onToggleLibrary}>
        {showLibrary ? <PanelLeftCloseIcon /> : <PanelLeftOpenIcon />}
        Library
      </Button>
      <Button size="sm" variant="outline" onClick={onToggleInspector}>
        {showInspector ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
        Panels
      </Button>
      <Button size="sm" variant="outline" onClick={onRunRelease} disabled={!canRunRelease}>
        <PlayIcon />
        Run
      </Button>
      <Button size="sm" onClick={onSaveDraft} disabled={!canSaveDraft}>
        <SaveIcon />
        Save draft
      </Button>
      <Button size="sm" variant="outline" onClick={onPublish} disabled={!canPublish}>
        <UploadIcon />
        Publish
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
          <DownloadIcon />
          Transfer
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 min-w-40">
          <DropdownMenuItem onClick={onExport}>Export JSON</DropdownMenuItem>
          <DropdownMenuItem onClick={onImport}>Import JSON</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void onImportChange(event)} />
    </>
  )
}