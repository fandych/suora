import { ResourceFilePreview } from "@/pages/components/resource-file-preview"
import DocumentContentEditor from "@/pages/components/document-content-editor"
import type { SkillFileRecord } from "@/types/document"
import { getResourcePreviewKind } from "@/lib/browser/resource-preview"
import { getSkillSourceLanguage, isEditableSkillFile } from "@/lib/skill/editor-utils"

type SkillEditorPanelProps = {
  fileContent: string
  selectedFile: SkillFileRecord | null
  onChange: (value: string) => void
}

export function SkillEditorPanel({ fileContent, selectedFile, onChange }: SkillEditorPanelProps) {
  const previewKind = selectedFile ? getResourcePreviewKind(selectedFile.path, fileContent) : "binary"
  const isEditable = selectedFile ? isEditableSkillFile(selectedFile.path) : false

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden p-0">
        {selectedFile && isEditable ? (
          <DocumentContentEditor
            mode="source"
            value={fileContent}
            onChange={onChange}
            sourceLanguage={getSkillSourceLanguage(selectedFile.path, selectedFile.language)}
          />
        ) : selectedFile ? (
          <ResourceFilePreview content={fileContent} path={selectedFile.path} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            Select a file to inspect its contents.
          </div>
        )}
      </div>
      <div className="border-t px-3 py-2 text-xs text-muted-foreground">Preview mode: {previewKind}</div>
    </div>
  )
}
