import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "react-router"
import { ChevronDownIcon, ChevronRightIcon, DownloadIcon, FilePlus2Icon, FileTextIcon, FolderIcon, FolderPlusIcon, PencilIcon, Trash2Icon, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { getDocumentDetail, publishDocumentVersion, saveDocumentDraft } from "@/data/repositories/document-repository"
import { buildDocumentTree, getDocumentDisplayName, getDocumentSourceLanguage, isMarkdownDocumentTitle } from "@/lib/document-tree"
import { downloadJson, downloadStoredContent, readBrowserFile } from "@/lib/browser-files"
import DocumentContentEditor from "@/views/components/document-content-editor"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import VersionSelect from "@/views/components/version-select"

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

const rowClass = "group flex w-full items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-muted/60"
const actionButtonClassName = "shrink-0 opacity-0 group-hover:opacity-100"

const DocumentsDetailPage = () => {
  const { documentId } = useParams<{ documentId: string }>()
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>()
  const { data, error, isLoading, reload, setData } = useAsyncResource(() => getDocumentDetail(documentId ?? "", selectedVersionId), [documentId, selectedVersionId])
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [selectedNodeId, setSelectedNodeId] = useState("")
  const [pageContent, setPageContent] = useState("")
  const [editorMode, setEditorMode] = useState<"rich" | "source">("rich")
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const uploadParentIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!data) return
    setTitle(data.document.title)
    setSummary(data.document.summary)
    setSelectedVersionId(data.selectedVersion.id)
    const firstDocument = data.pages.find((page) => (page.type ?? "document") === "document") ?? data.pages[0]
    setSelectedNodeId(firstDocument?.id ?? "")
    setPageContent(firstDocument?.content ?? "")
    setCollapsedIds(new Set())
  }, [data])

  const pages = useMemo(() => data?.pages ?? [], [data])
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
  const selectedIsDocument = (selectedPage?.type ?? "document") === "document"
  const effectiveEditorMode = selectedIsDocument && selectedPage && !isMarkdownDocumentTitle(selectedPage.title) ? "source" : editorMode

  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    const nextNode = pages.find((page) => page.id === nodeId)
    setPageContent(nextNode?.content ?? "")
  }

  const toggleFolder = (nodeId: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const addNodeAt = (type: "document" | "folder", parentId: string | null) => {
    if (!data) return
    const existingTitles = data.pages.map((page) => page.title)
    const nodeTitle = type === "folder" ? getUniqueDocumentTitle(existingTitles, "new-folder") : getUniqueDocumentTitle(existingTitles, "new-document.md")
    const nextNode = { id: crypto.randomUUID(), title: nodeTitle, content: type === "document" ? "# New Document\n\nStart writing here.\n" : "", type, parentId } as const
    setData({ ...data, pages: [...data.pages, nextNode] })
    setCollapsedIds((current) => { const next = new Set(current); if (parentId) next.delete(parentId); return next })
    handleSelectNode(nextNode.id)
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
    if (!data || data.pages.length <= 1) return
    const descendantIds = getDescendantIds(nodeId)
    const nextPages = data.pages.filter((page) => page.id !== nodeId && !descendantIds.has(page.id))
    setData({ ...data, pages: nextPages })
    const fallback = nextPages.find((page) => (page.type ?? "document") === "document") ?? nextPages[0]
    setSelectedNodeId(fallback?.id ?? "")
    setPageContent(fallback?.content ?? "")
  }

  const renameNode = (nodeId: string) => {
    if (!data) return
    const target = data.pages.find((page) => page.id === nodeId)
    if (!target) return
    const nextTitle = window.prompt("Rename item", target.title)
    if (!nextTitle?.trim()) return
    setData({
      ...data,
      pages: data.pages.map((page) => page.id === nodeId ? {
        ...page,
        title: (page.type ?? "document") === "document" ? getUniqueDocumentTitle(data.pages.filter((candidate) => candidate.id !== page.id).map((candidate) => candidate.title), nextTitle.trim()) : nextTitle.trim(),
      } : page),
    })
  }

  const exportNode = (nodeId: string) => {
    const target = pages.find((page) => page.id === nodeId)
    if (!target) return
    if ((target.type ?? "document") === "document") {
      downloadStoredContent(getDocumentDisplayName(target.title), target.id === selectedNodeId ? pageContent : target.content)
      return
    }
    const descendantIds = getDescendantIds(nodeId)
    const subtree = pages.filter((page) => page.id === nodeId || descendantIds.has(page.id))
    downloadJson(`${target.title || "documents"}.json`, subtree)
  }

  const handleUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!data) return
    const parentId = uploadParentIdRef.current
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return
    const nextPages = [...data.pages]
    for (const file of files) {
      nextPages.push({ id: crypto.randomUUID(), title: getUniqueDocumentTitle(nextPages.map((page) => page.title), file.name), content: await readBrowserFile(file), type: "document", parentId })
    }
    setData({ ...data, pages: nextPages })
    const firstUploaded = nextPages[nextPages.length - files.length]
    if (firstUploaded) handleSelectNode(firstUploaded.id)
    event.target.value = ""
  }

  const handleSave = async () => {
    if (!documentId || !data) return
    const nextPages = data.pages.map((page) => {
      if ((page.type ?? "document") === "folder" && page.parentId === null) return { ...page, title }
      if (page.id === selectedPage?.id && (page.type ?? "document") === "document") return { ...page, content: pageContent }
      return page
    })
    const next = await saveDocumentDraft(documentId, { title, summary, pages: nextPages, graphEdges: data.graphEdges, settings: data.settings })
    setData(next)
    setSelectedVersionId(next.selectedVersion.id)
  }

  const handlePublish = async () => {
    if (!documentId || !data) return
    const next = await publishDocumentVersion(documentId, data.selectedVersion.id)
    setData(next)
    setSelectedVersionId(next.selectedVersion.id)
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title={data?.document.title ?? "Document"} actions={data ? <><VersionSelect versions={data.versions} value={data.selectedVersion.id} onChange={setSelectedVersionId} /><Button variant="outline" onClick={handlePublish}>Publish</Button><Button onClick={handleSave}>Save</Button></> : null} />
      <input ref={uploadInputRef} type="file" multiple className="hidden" onChange={handleUploadChange} />
      <div className="min-h-0 flex-1 p-4">
        {isLoading ? <LoadingCard title="Loading document..." /> : null}
        {error ? <ErrorCard error={error} onRetry={reload} /> : null}
        {!isLoading && !error && data ? (
          <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-11rem)] overflow-hidden rounded-xl border bg-background">
            <ResizablePanel defaultSize={28} minSize={18} className="min-w-0">
              <ContextMenu>
                <ContextMenuTrigger className="h-full">
                  <div className="min-h-0 h-full overflow-y-auto p-2">
                {visibleEntries.map(({ node, depth }) => {
                  const isFolder = (node.type ?? "document") === "folder"
                  const isCollapsed = collapsedIds.has(node.id)
                  return (
                    <div key={node.id} className={`${rowClass} ${node.id === selectedNodeId ? "bg-muted" : ""}`}>
                      <button className="flex min-w-0 flex-1 items-center gap-1 text-left" onClick={() => handleSelectNode(node.id)}>
                        <span className="flex min-w-0 items-center gap-1" style={{ paddingLeft: `${depth * 12}px` }}>
                          {isFolder ? <span className="flex size-4 items-center justify-center" onClick={(event) => { event.stopPropagation(); toggleFolder(node.id) }}>{isCollapsed ? <ChevronRightIcon className="size-4 text-muted-foreground" /> : <ChevronDownIcon className="size-4 text-muted-foreground" />}</span> : <span className="size-4" />}
                          {isFolder ? <FolderIcon className="size-4 shrink-0 text-muted-foreground" /> : <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />}
                          <span className="truncate">{isFolder ? node.title : getDocumentDisplayName(node.title)}</span>
                        </span>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className={actionButtonClassName} />}>
                          <span>...</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 min-w-44">
                          {isFolder ? <DropdownMenuItem onClick={() => addNodeAt("document", node.id)}><FilePlus2Icon className="size-4" />New file</DropdownMenuItem> : null}
                          {isFolder ? <DropdownMenuItem onClick={() => addNodeAt("folder", node.id)}><FolderPlusIcon className="size-4" />New folder</DropdownMenuItem> : null}
                          {isFolder ? <DropdownMenuItem onClick={() => { uploadParentIdRef.current = node.id; uploadInputRef.current?.click() }}><UploadIcon className="size-4" />Upload</DropdownMenuItem> : null}
                          <DropdownMenuItem onClick={() => exportNode(node.id)}><DownloadIcon className="size-4" />Export</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => renameNode(node.id)}><PencilIcon className="size-4" />Rename</DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => deleteNode(node.id)}><Trash2Icon className="size-4" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )
                })}
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => addNodeAt("document", pages.find((page) => (page.type ?? "document") === "folder" && page.parentId === null)?.id ?? null)}><FilePlus2Icon className="size-4" />New file</ContextMenuItem>
                  <ContextMenuItem onClick={() => addNodeAt("folder", pages.find((page) => (page.type ?? "document") === "folder" && page.parentId === null)?.id ?? null)}><FolderPlusIcon className="size-4" />New folder</ContextMenuItem>
                  <ContextMenuItem onClick={() => { uploadParentIdRef.current = pages.find((page) => (page.type ?? "document") === "folder" && page.parentId === null)?.id ?? null; uploadInputRef.current?.click() }}><UploadIcon className="size-4" />Upload</ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={72} minSize={30} className="min-w-0">
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex items-center justify-between border-b px-3 py-2 text-sm text-muted-foreground">
                  <span className="truncate">{selectedPage ? ((selectedPage.type ?? "document") === "document" ? getDocumentDisplayName(selectedPage.title) : selectedPage.title) : "Editor"}</span>
                  {selectedIsDocument ? <NativeSelect value={effectiveEditorMode} onChange={(event) => setEditorMode(event.target.value as "rich" | "source")} size="sm"><NativeSelectOption value="rich" disabled={selectedPage ? !isMarkdownDocumentTitle(selectedPage.title) : false}>Rich</NativeSelectOption><NativeSelectOption value="source">Source</NativeSelectOption></NativeSelect> : null}
                </div>
                <div className="min-h-0 flex-1 overflow-hidden p-0">
                  {selectedIsDocument ? <DocumentContentEditor mode={effectiveEditorMode} value={pageContent} onChange={setPageContent} sourceLanguage={effectiveEditorMode === "source" ? getDocumentSourceLanguage(selectedPage?.title ?? "") : undefined} /> : <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">Create or upload files into this folder.</div>}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : null}
      </div>
    </div>
  )
}

export default DocumentsDetailPage
