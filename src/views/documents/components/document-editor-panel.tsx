import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ResourceFilePreview } from "@/views/components/resource-file-preview"
import DocumentContentEditor from "@/views/components/document-content-editor"
import type { DocumentPageRecord } from "@/data/domain/models"
import { getDocumentSourceLanguage, isMarkdownDocumentTitle } from "@/data/domain/document-tree"
import { getResourcePreviewKind } from "@/lib/resources/archive-import"

type DocumentEditorPanelProps = {
  editorMode: "rich" | "source"
  onChange: (value: string) => void
  onEditorModeChange: (mode: "rich" | "source") => void
  pageContent: string
  selectedPage: DocumentPageRecord | undefined
}

export function DocumentEditorPanel({ editorMode, onChange, onEditorModeChange, pageContent, selectedPage }: DocumentEditorPanelProps) {
  const selectedIsDocument = (selectedPage?.type ?? "document") === "document"
  const effectiveEditorMode = selectedIsDocument && selectedPage && !isMarkdownDocumentTitle(selectedPage.title) ? "source" : editorMode
  const previewKind = selectedPage ? getResourcePreviewKind(selectedPage.title, pageContent) : "binary"

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden p-0">
        {selectedIsDocument && selectedPage
          ? previewKind === "markdown" || previewKind === "data" || previewKind === "script"
            ? <DocumentContentEditor mode={effectiveEditorMode} value={pageContent} onChange={onChange} sourceLanguage={effectiveEditorMode === "source" ? getDocumentSourceLanguage(selectedPage.title) : undefined} />
            : <ResourceFilePreview content={pageContent} path={selectedPage.title} />
          : <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">Create or upload files into this folder.</div>}
      </div>
      <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
        <span>Preview mode: {previewKind}</span>
        {selectedIsDocument && (previewKind === "markdown" || previewKind === "data" || previewKind === "script") ? <NativeSelect className="w-24 shrink-0" value={effectiveEditorMode} onChange={(event) => onEditorModeChange(event.target.value as "rich" | "source")} size="sm"><NativeSelectOption value="rich" disabled={selectedPage ? !isMarkdownDocumentTitle(selectedPage.title) : false}>Rich</NativeSelectOption><NativeSelectOption value="source">Source</NativeSelectOption></NativeSelect> : null}
      </div>
    </div>
  )
}
