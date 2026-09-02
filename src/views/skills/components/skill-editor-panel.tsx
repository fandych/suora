import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ResourceFilePreview } from "@/views/components/resource-file-preview"
import DocumentContentEditor from "@/views/components/document-content-editor"
import type { SkillFileRecord } from "@/data/domain/models"
import { getResourcePreviewKind } from "@/lib/resource-files"
import { getSkillSourceLanguage, isEditableSkillFile } from "@/lib/skill-files"

type SkillEditorPanelProps = {
  autosaveLabel: string
  fileContent: string
  selectedFile: SkillFileRecord | null
  selectedPath: string
  versionLabel: string
  onChange: (value: string) => void
  onPublish: () => void
  onSaveNow: () => void
}

export function SkillEditorPanel({ autosaveLabel, fileContent, selectedFile, selectedPath, versionLabel, onChange, onPublish, onSaveNow }: SkillEditorPanelProps) {
  const previewKind = selectedFile ? getResourcePreviewKind(selectedFile.path, fileContent) : "binary"
  const isEditable = selectedFile ? isEditableSkillFile(selectedFile.path) : false

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2 text-sm text-muted-foreground">
        <span className="truncate">{selectedPath || "Editor"}</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{versionLabel}</Badge>
          <Badge variant="secondary">{autosaveLabel}</Badge>
          <Button size="sm" variant="outline" onClick={onPublish}>Publish</Button>
          <Button size="sm" onClick={onSaveNow}>Save now</Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-0">
        {selectedFile && isEditable ? (
          <DocumentContentEditor mode="source" value={fileContent} onChange={onChange} sourceLanguage={getSkillSourceLanguage(selectedFile.path, selectedFile.language)} />
        ) : selectedFile ? (
          <ResourceFilePreview content={fileContent} path={selectedFile.path} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">Select a file to inspect its contents.</div>
        )}
      </div>
      <div className="border-t px-3 py-2 text-xs text-muted-foreground">Preview mode: {previewKind}</div>
    </div>
  )
}
