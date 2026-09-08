import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { EllipsisIcon, PencilIcon, PowerIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { useAutosaveStatus } from "@/hooks/use-autosave-status"
import { emitDataChanged } from "@/data/repositories/data-events"
import type { DocumentDetail } from "@/data/domain/models"
import { deleteDocument, getDocumentDetail, saveDocumentDraft } from "@/data/repositories/document-repository"
import { buildDocumentTree, getDocumentDisplayName } from "@/lib/document-tree"
import { downloadJson, downloadStoredContent, readBrowserFile } from "@/lib/browser-files"
import PageHeader from "@/views/components/page-header"
import { ConfirmDeleteDialog } from "@/views/components/confirm-delete-dialog"
import { ResourceEntryDialog } from "@/views/components/resource-entry-dialog"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { DocumentCreateDialog } from "@/views/documents/components/document-create-dialog"
import { DocumentEditorPanel } from "@/views/documents/components/document-editor-panel"
import { DocumentTreePanel } from "@/views/documents/components/document-tree-panel"

function getUniqueDocumentTitle(existingTitles: string[], preferredTitle: string) {
  if (!existingTitles.includes(preferredTitle)) return preferredTitle
  const dotIndex = preferredTitle.lastIndexOf(".")
  const hasExtension = dotIndex > -1
  const base = hasExtension ? preferredTitle.slice(0, dotIndex) : preferredTitle
  const extension = hasExtension ? preferredTitle.slice(dotIndex) : ""
  let index = 2
  while (existingTitles.includes(`${base}-${index}${extension}`)) index += 1
  return `${base}-${index}${extension}`
}

function isVisibleDocumentNode(path: string[], collapsedIds: Set<string>) {
  return !path.some((id) => collapsedIds.has(id))
}

function buildDocumentSnapshot(detail: ReturnType<typeof normalizeDocumentState>) {
  return JSON.stringify(detail)
}

function normalizeDocumentState(detail: DocumentDetail) {
  return {
    document: detail.document,
    graphEdges: detail.graphEdges,
    pages: detail.pages,
    selectedVersionId: detail.selectedVersion.id,
    settings: detail.settings,
  }
}

const DocumentsDetailPage = () => {
  const navigate = useNavigate()
  const { documentId } = useParams<{ documentId: string }>()
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>()
  const { data, error, isLoading, reload, setData } = useAsyncResource(() => getDocumentDetail(documentId ?? "", selectedVersionId), [documentId, selectedVersionId])
  const [selectedNodeId, setSelectedNodeId] = useState("")
  const [editorMode, setEditorMode] = useState<"rich" | "source">("rich")
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const uploadParentIdRef = useRef<string | null>(null)
  const [draft, setDraft] = useState<DocumentDetail | null>(null)
  const [entryDialogMode, setEntryDialogMode] = useState<{ kind: "add-file" | "add-directory" | "rename"; parentId?: string | null; targetId?: string } | null>(null)
  const [entryDialogValue, setEntryDialogValue] = useState("")
  const [entryDialogError, setEntryDialogError] = useState("")
  const [hasLoadedInitialState, setHasLoadedInitialState] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [isMetadataDialogOpen, setIsMetadataDialogOpen] = useState(false)
  const [isDocumentDeleteDialogOpen, setIsDocumentDeleteDialogOpen] = useState(false)

  const persistDraft = async (nextDraft: DocumentDetail) => {
    const saved = await saveDocumentDraft(documentId ?? "", {
      title: nextDraft.document.title,
      summary: nextDraft.document.summary,
      enabled: nextDraft.document.enabled,
      pages: nextDraft.pages,
      graphEdges: nextDraft.graphEdges,
      settings: nextDraft.settings,
      selectedVersionId: nextDraft.selectedVersion.id,
    })
    const hasSelectedPage = saved.pages.some((page) => page.id === selectedNodeId)
    setData(saved)
    setDraft(saved)
    setSelectedVersionId(saved.selectedVersion.id)
    if (hasSelectedPage) {
      setSelectedNodeId((current) => current)
    } else {
      setSelectedNodeId(saved.pages[0]?.id ?? "")
    }
    emitDataChanged("/documents")
    return buildDocumentSnapshot(normalizeDocumentState(saved))
  }

  const autosave = useAutosaveStatus({
    enabled: hasLoadedInitialState && Boolean(documentId && draft),
    onSave: async () => draft ? persistDraft(draft) : "",
    snapshotKey: draft ? buildDocumentSnapshot(normalizeDocumentState(draft)) : "",
  })

  useEffect(() => {
    if (!data) return
    setDraft(data)
    setSelectedVersionId(data.selectedVersion.id)
    setSelectedNodeId((current) => {
      if (current && data.pages.some((page) => page.id === current)) {
        return current
      }

      const firstDocument = data.pages.find((page) => (page.type ?? "document") === "document") ?? data.pages[0]
      return firstDocument?.id ?? ""
    })
    setCollapsedIds(new Set())
    setHasLoadedInitialState(true)
    autosave.markClean(buildDocumentSnapshot(normalizeDocumentState(data)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const pages = useMemo(() => draft?.pages ?? [], [draft])
  const pagesById = useMemo(() => new Map(pages.map((page) => [page.id, page])), [pages])
  const treeEntries = useMemo(() => buildDocumentTree(pages), [pages])
  const visibleEntries = useMemo(() => treeEntries.filter(({ node }) => {
    const ancestorIds: string[] = []
    let currentParentId = node.parentId ?? null
    while (currentParentId) {
      ancestorIds.push(currentParentId)
      currentParentId = pagesById.get(currentParentId)?.parentId ?? null
    }
    return isVisibleDocumentNode(ancestorIds, collapsedIds)
  }), [collapsedIds, pagesById, treeEntries])
  const selectedPage = pages.find((page) => page.id === selectedNodeId) ?? pages[0]
  const pageContent = selectedPage?.content ?? ""

  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId)
  }

  const toggleFolder = (nodeId: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const commitAddOrRename = () => {
    if (!draft || !entryDialogMode) {
      return
    }

    const rawValue = entryDialogValue.trim()
    if (!rawValue) {
      setEntryDialogError("Name is required.")
      return
    }

    if (entryDialogMode.kind === "rename") {
      const target = draft.pages.find((page) => page.id === entryDialogMode.targetId)
      if (!target) {
        return
      }

      const nextTitle = rawValue
      const siblingTitles = draft.pages.filter((page) => page.id !== target.id && page.parentId === target.parentId).map((page) => page.title)
      if (siblingTitles.includes(nextTitle) || ((target.type ?? "document") === "document" && siblingTitles.includes(getUniqueDocumentTitle(siblingTitles, nextTitle)))) {
        setEntryDialogError("Another item in this folder already uses that name.")
        return
      }

      setDraft({
        ...draft,
        pages: draft.pages.map((page) => page.id === target.id ? {
          ...page,
          title: (page.type ?? "document") === "document" ? getUniqueDocumentTitle(draft.pages.filter((candidate) => candidate.id !== page.id).map((candidate) => candidate.title), nextTitle) : nextTitle,
        } : page),
      })
      setEntryDialogMode(null)
      setEntryDialogError("")
      return
    }

    const parentId = entryDialogMode.parentId ?? null
    const type = entryDialogMode.kind === "add-directory" ? "folder" : "document"
    const siblingTitles = draft.pages.filter((page) => page.parentId === parentId).map((page) => page.title)
    const nodeTitle = type === "folder" ? getUniqueDocumentTitle(siblingTitles, rawValue) : getUniqueDocumentTitle(siblingTitles, rawValue)
    const nextNode = { id: globalThis.crypto.randomUUID(), title: nodeTitle, content: type === "document" ? "# New Document\n\nStart writing here.\n" : "", type, parentId } as const
    setDraft({ ...draft, pages: [...draft.pages, nextNode] })
    setCollapsedIds((current) => { const next = new Set(current); if (parentId) next.delete(parentId); return next })
    handleSelectNode(nextNode.id)
    setEntryDialogMode(null)
    setEntryDialogError("")
  }

  const getDescendantIds = (nodeId: string) => {
    const ids = new Set<string>()
    const visit = (parentId: string) => {
      for (const page of pages) {
        if (page.parentId === parentId) {
          ids.add(page.id)
          visit(page.id)
        }
      }
    }
    visit(nodeId)
    return ids
  }

  const deleteNode = (nodeId: string) => {
    if (!draft || draft.pages.length <= 1) return
    const descendantIds = getDescendantIds(nodeId)
    const nextPages = draft.pages.filter((page) => page.id !== nodeId && !descendantIds.has(page.id))
    setDraft({ ...draft, pages: nextPages })
    const fallback = nextPages.find((page) => (page.type ?? "document") === "document") ?? nextPages[0]
    setSelectedNodeId(fallback?.id ?? "")
    setDeleteTargetId(null)
  }

  const exportNode = (nodeId: string) => {
    const target = pages.find((page) => page.id === nodeId)
    if (!target) return
    if ((target.type ?? "document") === "document") {
      downloadStoredContent(getDocumentDisplayName(target.title), target.content)
      return
    }
    const descendantIds = getDescendantIds(nodeId)
    const subtree = pages.filter((page) => page.id === nodeId || descendantIds.has(page.id))
    downloadJson(`${target.title || "documents"}.json`, subtree)
  }

  const handleUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!draft) return
    const parentId = uploadParentIdRef.current
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return
    const nextPages = [...draft.pages]
    for (const file of files) {
      nextPages.push({ id: globalThis.crypto.randomUUID(), title: getUniqueDocumentTitle(nextPages.map((page) => page.title), file.name), content: await readBrowserFile(file), type: "document", parentId })
    }
    setDraft({ ...draft, pages: nextPages })
    const firstUploaded = nextPages[nextPages.length - files.length]
    if (firstUploaded) handleSelectNode(firstUploaded.id)
    event.target.value = ""
  }

  const handleContentChange = (value: string) => {
    if (!draft || !selectedPage) {
      return
    }

    setDraft({
      ...draft,
      pages: draft.pages.map((page) => page.id === selectedPage.id ? { ...page, content: value } : page),
    })
  }

  const handleDeleteDocument = async () => {
    if (!documentId) return
    await deleteDocument(documentId)
    emitDataChanged("/documents")
    navigate("/documents")
  }

  const toggleDocumentEnabled = () => {
    setDraft((current) => current ? { ...current, document: { ...current.document, enabled: !current.document.enabled } } : current)
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={draft?.document.title ?? "Document"}
        description={draft?.document.summary}
        actions={draft ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Document actions" />}>
              <EllipsisIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={toggleDocumentEnabled}>
                <PowerIcon />
                {draft.document.enabled ? "Disable" : "Enable"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsMetadataDialogOpen(true)}><PencilIcon className="size-4" />Edit Info</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setIsDocumentDeleteDialogOpen(true)}><Trash2Icon className="size-4" />Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      />
      <input ref={uploadInputRef} type="file" multiple className="hidden" onChange={handleUploadChange} />
      <div className="min-h-0 flex-1 p-3">
        {isLoading ? <LoadingCard title="Loading document..." /> : null}
        {error ? <ErrorCard error={error} onRetry={reload} /> : null}
        {!isLoading && !error && draft ? (
          <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-9.5rem)] overflow-hidden rounded-xl border bg-background">
            <ResizablePanel defaultSize={28} minSize={18} className="min-w-0">
              <DocumentTreePanel collapsedIds={collapsedIds} entries={visibleEntries} onAddDirectory={(parentId) => { setEntryDialogMode({ kind: "add-directory", parentId }); setEntryDialogValue("new-folder"); setEntryDialogError("") }} onAddFile={(parentId) => { setEntryDialogMode({ kind: "add-file", parentId }); setEntryDialogValue("new-document.md"); setEntryDialogError("") }} onDelete={(nodeId) => setDeleteTargetId(nodeId)} onExport={exportNode} onRename={(nodeId) => { const target = draft.pages.find((page) => page.id === nodeId); setEntryDialogMode({ kind: "rename", targetId: nodeId }); setEntryDialogValue(target?.title ?? ""); setEntryDialogError("") }} onSelect={handleSelectNode} onToggle={toggleFolder} onUpload={(parentId) => { uploadParentIdRef.current = parentId; uploadInputRef.current?.click() }} selectedNodeId={selectedNodeId} />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={72} minSize={30} className="min-w-0">
              <DocumentEditorPanel editorMode={editorMode} onChange={handleContentChange} onEditorModeChange={setEditorMode} pageContent={pageContent} selectedPage={selectedPage} />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : null}
      </div>
      <DocumentCreateDialog dialogDescription="Update the document name and description for this workspace." dialogTitle="Edit document details" onDescriptionChange={(value) => setDraft((current) => current ? { ...current, document: { ...current.document, summary: value } } : current)} onOpenChange={setIsMetadataDialogOpen} onSubmit={() => setIsMetadataDialogOpen(false)} onTitleChange={(value) => setDraft((current) => current ? { ...current, document: { ...current.document, title: value } } : current)} open={isMetadataDialogOpen} submitLabel="Save changes" title={draft?.document.title ?? ""} description={draft?.document.summary ?? ""} />
      <ConfirmDeleteDialog description="This permanently deletes the document and all of its content. This action cannot be undone." onConfirm={() => void handleDeleteDocument()} onOpenChange={setIsDocumentDeleteDialogOpen} open={isDocumentDeleteDialogOpen} title="Delete document" />
      <ResourceEntryDialog description={entryDialogMode?.kind === "rename" ? "Rename the selected page or folder." : "Create a new document or folder inside the selected parent."} errorMessage={entryDialogError} fieldLabel={entryDialogMode?.kind === "rename" ? "New name" : "Name"} onOpenChange={(open) => { if (!open) { setEntryDialogMode(null); setEntryDialogError("") } }} onSubmit={commitAddOrRename} onValueChange={setEntryDialogValue} open={Boolean(entryDialogMode)} placeholder={entryDialogMode?.kind === "add-file" ? "new-document.md" : "new-folder"} submitLabel={entryDialogMode?.kind === "rename" ? "Rename" : "Create"} title={entryDialogMode?.kind === "rename" ? "Rename item" : entryDialogMode?.kind === "add-directory" ? "Create folder" : "Create document"} value={entryDialogValue} />
      <ConfirmDeleteDialog description={deleteTargetId ? `Delete this item and all nested content under it?` : "Delete this item?"} onConfirm={() => deleteTargetId ? deleteNode(deleteTargetId) : undefined} onOpenChange={(open) => { if (!open) setDeleteTargetId(null) }} open={Boolean(deleteTargetId)} title="Delete item" />
    </div>
  )
}

export default DocumentsDetailPage
