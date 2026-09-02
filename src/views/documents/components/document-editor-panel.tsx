import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ResourceFilePreview } from "@/views/components/resource-file-preview"
import DocumentContentEditor from "@/views/components/document-content-editor"
import type { DocumentPageRecord } from "@/data/domain/models"
import { getDocumentDisplayName, getDocumentSourceLanguage, isMarkdownDocumentTitle } from "@/lib/document-tree"
import { getResourcePreviewKind } from "@/lib/resource-files"

type DocumentEditorPanelProps = {
  autosaveLabel: string
  editorMode: "rich" | "source"
  onChange: (value: string) => void
  onEditorModeChange: (mode: "rich" | "source") => void
  onPublish: () => void
  onSaveNow: () => void
  pageContent: string
  selectedPage: DocumentPageRecord | undefined
  versionLabel: string
}

export function DocumentEditorPanel({ autosaveLabel, editorMode, onChange, onEditorModeChange, onPublish, onSaveNow, pageContent, selectedPage, versionLabel }: DocumentEditorPanelProps) {
  const selectedIsDocument = (selectedPage?.type ?? "document") === "document"
  const effectiveEditorMode = selectedIsDocument && selectedPage && !isMarkdownDocumentTitle(selectedPage.title) ? "source" : editorMode
  const previewKind = selectedPage ? getResourcePreviewKind(selectedPage.title, pageContent) : "binary"

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2 text-sm text-muted-foreground">
        <span className="truncate">{selectedPage ? ((selectedPage.type ?? "document") === "document" ? getDocumentDisplayName(selectedPage.title) : selectedPage.title) : "Editor"}</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{versionLabel}</Badge>
          <Badge variant="secondary">{autosaveLabel}</Badge>
          <Button size="sm" variant="outline" onClick={onPublish}>Publish</Button>
          <Button size="sm" onClick={onSaveNow}>Save now</Button>
          {selectedIsDocument ? <NativeSelect value={effectiveEditorMode} onChange={(event) => onEditorModeChange(event.target.value as "rich" | "source")} size="sm"><NativeSelectOption value="rich" disabled={selectedPage ? !isMarkdownDocumentTitle(selectedPage.title) : false}>Rich</NativeSelectOption><NativeSelectOption value="source">Source</NativeSelectOption></NativeSelect> : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-0">
        {selectedIsDocument && selectedPage
          ? previewKind === "markdown" || previewKind === "data" || previewKind === "script"
            ? <DocumentContentEditor mode={effectiveEditorMode} value={pageContent} onChange={onChange} sourceLanguage={effectiveEditorMode === "source" ? getDocumentSourceLanguage(selectedPage.title) : undefined} />
            : <ResourceFilePreview content={pageContent} path={selectedPage.title} />
          : <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">Create or upload files into this folder.</div>}
      </div>
      <div className="border-t px-3 py-2 text-xs text-muted-foreground">Preview mode: {previewKind}</div>
    </div>
  )
}
