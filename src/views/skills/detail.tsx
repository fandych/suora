import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "react-router"
import { ChevronDownIcon, ChevronRightIcon, DownloadIcon, FileCode2Icon, FilePlus2Icon, FileTextIcon, FolderIcon, FolderPlusIcon, PencilIcon, Trash2Icon, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { useAsyncResource } from "@/hooks/use-async-resource"
import type { SkillDetail, SkillFileRecord } from "@/data/domain/models"
import { getSkillDetail, publishSkillVersion, saveSkillDraft } from "@/data/repositories/skill-repository"
import { downloadJson, downloadStoredContent, readBrowserFile } from "@/lib/browser-files"
import { buildSkillTree, getDefaultSkillFileName, getSkillSourceLanguage, isEditableSkillFile, isSafeSkillResourcePath, normalizeSkillPath, parseSkillFrontmatter } from "@/lib/skill-files"
import DocumentContentEditor from "@/views/components/document-content-editor"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import VersionSelect from "@/views/components/version-select"

function getUniqueSkillPath(files: SkillFileRecord[], preferredPath: string) {
  const used = new Set(files.map((file) => normalizeSkillPath(file.path)))
  if (!used.has(preferredPath)) return preferredPath
  const dotIndex = preferredPath.lastIndexOf(".")
  const hasExtension = dotIndex > preferredPath.lastIndexOf("/")
  const base = hasExtension ? preferredPath.slice(0, dotIndex) : preferredPath
  const extension = hasExtension ? preferredPath.slice(dotIndex) : ""
  let index = 2
  while (used.has(`${base}-${index}${extension}`)) index += 1
  return `${base}-${index}${extension}`
}

function isCoreSkillNode(path: string) {
  return path === "SKILL.md" || ["scripts", "references", "assets", "other"].includes(path)
}

function isVisibleSkillEntry(path: string, collapsedPaths: Set<string>) {
  for (const collapsedPath of collapsedPaths) {
    if (path !== collapsedPath && path.startsWith(`${collapsedPath}/`)) return false
  }
  return true
}

const rowClass = "group flex w-full items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-muted/60"
const actionButtonClassName = "shrink-0 opacity-0 group-hover:opacity-100"

const SkillsDetailPage = () => {
  const { skillId } = useParams<{ skillId: string }>()
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>()
  const { data, error, isLoading, reload, setData } = useAsyncResource(() => getSkillDetail(skillId ?? "", selectedVersionId), [skillId, selectedVersionId])
  const [draft, setDraft] = useState<SkillDetail | null>(null)
  const [selectedFilePath, setSelectedFilePath] = useState("")
  const [fileContent, setFileContent] = useState("")
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set())
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadTargetPath, setUploadTargetPath] = useState("other")

  useEffect(() => {
    if (!data) return
    setDraft(data)
    setSelectedVersionId(data.selectedVersion.id)
    setSelectedFilePath(data.files[0]?.path ?? "")
    setFileContent(data.files[0]?.content ?? "")
    setCollapsedPaths(new Set())
  }, [data])

  const treeEntries = useMemo(() => buildSkillTree(draft?.files ?? []), [draft?.files])
  const visibleEntries = useMemo(() => treeEntries.filter((entry) => isVisibleSkillEntry(entry.path, collapsedPaths)), [collapsedPaths, treeEntries])
  const selectedEntry = treeEntries.find((entry) => entry.path === selectedFilePath) ?? treeEntries[0]
  const selectedFile = selectedEntry?.kind === "file" ? selectedEntry.file ?? null : null

  const handleSelectEntry = (path: string) => {
    setSelectedFilePath(path)
    const nextFile = draft?.files.find((file) => normalizeSkillPath(file.path) === normalizeSkillPath(path) && (file.kind ?? "file") === "file")
    setFileContent(nextFile?.content ?? "")
  }

  const toggleFolder = (path: string) => {
    setCollapsedPaths((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const addResourceAt = (kind: "file" | "directory", parentPath: string) => {
    if (!draft) return
    const proposedPath = kind === "file" ? `${parentPath}/${getDefaultSkillFileName(parentPath)}` : `${parentPath}/new-folder`
    const nextPath = getUniqueSkillPath(draft.files, proposedPath)
    if (!isSafeSkillResourcePath(nextPath)) return
    const nextFile: SkillFileRecord = kind === "directory"
      ? { path: nextPath, content: "", language: "plaintext", kind: "directory", executable: false }
      : { path: nextPath, content: nextPath.startsWith("scripts/") ? "export async function main(input: unknown) {\n  return { ok: true, input }\n}\n" : "", language: getSkillSourceLanguage(nextPath), kind: "file", executable: nextPath.startsWith("scripts/") }
    setDraft({ ...draft, files: [...draft.files, nextFile] })
    setCollapsedPaths((current) => { const next = new Set(current); next.delete(parentPath); return next })
    handleSelectEntry(nextPath)
  }

  const renameEntry = (path: string) => {
    if (!draft || isCoreSkillNode(path)) return
    const proposedPath = window.prompt("Rename path", path)
    if (!proposedPath) return
    const normalizedNext = normalizeSkillPath(proposedPath)
    if (normalizedNext === path || !isSafeSkillResourcePath(normalizedNext)) return
    const nextFiles = draft.files.map((file) => {
      const currentPath = normalizeSkillPath(file.path)
      if (currentPath === path) return { ...file, path: normalizedNext }
      if (currentPath.startsWith(`${path}/`)) return { ...file, path: `${normalizedNext}/${currentPath.slice(path.length + 1)}` }
      return file
    })
    setDraft({ ...draft, files: nextFiles })
    setSelectedFilePath(normalizedNext)
  }

  const deleteEntry = (path: string) => {
    if (!draft || isCoreSkillNode(path)) return
    const nextFiles = draft.files.filter((file) => {
      const currentPath = normalizeSkillPath(file.path)
      return currentPath !== path && !currentPath.startsWith(`${path}/`)
    })
    setDraft({ ...draft, files: nextFiles })
    const fallback = nextFiles.find((file) => (file.kind ?? "file") === "file")
    setSelectedFilePath(fallback?.path ?? "SKILL.md")
    setFileContent(fallback?.content ?? "")
  }

  const exportEntry = (path: string) => {
    if (!draft) return
    const entry = treeEntries.find((candidate) => candidate.path === path)
    if (!entry) return
    const file = draft.files.find((candidate) => normalizeSkillPath(candidate.path) === normalizeSkillPath(path))
    if (entry.kind === "file" && file) {
      downloadStoredContent(entry.label, path === selectedFilePath ? fileContent : file.content)
      return
    }
    const subtree = draft.files.filter((candidate) => {
      const currentPath = normalizeSkillPath(candidate.path)
      return currentPath === path || currentPath.startsWith(`${path}/`)
    })
    downloadJson(`${entry.label || "bundle"}.json`, subtree)
  }

  const handleUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!draft) return
    const inputFiles = Array.from(event.target.files ?? [])
    if (inputFiles.length === 0) return
    const nextFiles: SkillFileRecord[] = []
    for (const file of inputFiles) {
      const nextPath = getUniqueSkillPath(draft.files.concat(nextFiles), `${uploadTargetPath}/${file.name}`)
      if (!isSafeSkillResourcePath(nextPath)) continue
      nextFiles.push({ path: nextPath, content: await readBrowserFile(file), language: getSkillSourceLanguage(nextPath), kind: "file", executable: nextPath.startsWith("scripts/") })
    }
    if (nextFiles.length > 0) {
      setDraft({ ...draft, files: [...draft.files, ...nextFiles] })
      handleSelectEntry(nextFiles[0].path)
    }
    event.target.value = ""
  }

  const handleSave = async () => {
    if (!skillId || !draft) return
    const nextFiles = draft.files.map((file) => normalizeSkillPath(file.path) === normalizeSkillPath(selectedFilePath) && (file.kind ?? "file") === "file" ? { ...file, content: fileContent } : file)
    const skillMarkdown = nextFiles.find((file) => normalizeSkillPath(file.path) === "SKILL.md")?.content ?? ""
    const frontmatter = parseSkillFrontmatter(skillMarkdown)
    const next = await saveSkillDraft(skillId, { title: frontmatter.name || draft.skill.title, source: draft.skill.source, summary: frontmatter.description || draft.skill.summary, files: nextFiles })
    setData(next)
    setDraft(next)
    setSelectedVersionId(next.selectedVersion.id)
  }

  const handlePublish = async () => {
    if (!skillId || !draft) return
    const next = await publishSkillVersion(skillId, draft.selectedVersion.id)
    setData(next)
    setDraft(next)
    setSelectedVersionId(next.selectedVersion.id)
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title={draft?.skill.title ?? "Skill"} actions={draft ? <><VersionSelect versions={draft.versions} value={selectedVersionId ?? draft.selectedVersion.id} onChange={setSelectedVersionId} /><Button variant="outline" onClick={handlePublish}>Publish</Button><Button onClick={handleSave}>Save</Button></> : null} />
      <input ref={uploadInputRef} type="file" multiple className="hidden" onChange={handleUploadChange} />
      <div className="min-h-0 flex-1 p-4">
        {isLoading ? <LoadingCard title="Loading skill..." /> : null}
        {error ? <ErrorCard error={error} onRetry={reload} /> : null}
        {!isLoading && !error && draft ? (
          <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-11rem)] overflow-hidden rounded-xl border bg-background">
            <ResizablePanel defaultSize={28} minSize={18} className="min-w-0">
              <ContextMenu>
                <ContextMenuTrigger className="h-full">
                  <div className="min-h-0 h-full overflow-y-auto p-2">
                {visibleEntries.map((entry) => {
                  const isDirectory = entry.kind === "directory"
                  const isCollapsed = collapsedPaths.has(entry.path)
                  return (
                    <div key={entry.path} className={`${rowClass} ${entry.path === selectedFilePath ? "bg-muted" : ""}`}>
                      <button className="flex min-w-0 flex-1 items-center gap-1 text-left" onClick={() => handleSelectEntry(entry.path)}>
                        <span className="flex min-w-0 items-center gap-1" style={{ paddingLeft: `${entry.depth * 12}px` }}>
                          {isDirectory ? <span className="flex size-4 items-center justify-center" onClick={(event) => { event.stopPropagation(); toggleFolder(entry.path) }}>{isCollapsed ? <ChevronRightIcon className="size-4 text-muted-foreground" /> : <ChevronDownIcon className="size-4 text-muted-foreground" />}</span> : <span className="size-4" />}
                          {isDirectory ? <FolderIcon className="size-4 shrink-0 text-muted-foreground" /> : entry.path === "SKILL.md" ? <FileTextIcon className="size-4 shrink-0 text-muted-foreground" /> : <FileCode2Icon className="size-4 shrink-0 text-muted-foreground" />}
                          <span className="truncate">{entry.label}</span>
                        </span>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className={actionButtonClassName} />}>
                          <span>...</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 min-w-44">
                          {isDirectory ? <DropdownMenuItem onClick={() => addResourceAt("file", entry.path)}><FilePlus2Icon className="size-4" />New file</DropdownMenuItem> : null}
                          {isDirectory ? <DropdownMenuItem onClick={() => addResourceAt("directory", entry.path)}><FolderPlusIcon className="size-4" />New folder</DropdownMenuItem> : null}
                          {isDirectory ? <DropdownMenuItem onClick={() => { setUploadTargetPath(entry.path); uploadInputRef.current?.click() }}><UploadIcon className="size-4" />Upload</DropdownMenuItem> : null}
                          <DropdownMenuItem onClick={() => exportEntry(entry.path)}><DownloadIcon className="size-4" />Export</DropdownMenuItem>
                          {!isCoreSkillNode(entry.path) ? <DropdownMenuItem onClick={() => renameEntry(entry.path)}><PencilIcon className="size-4" />Rename</DropdownMenuItem> : null}
                          {!isCoreSkillNode(entry.path) ? <DropdownMenuItem variant="destructive" onClick={() => deleteEntry(entry.path)}><Trash2Icon className="size-4" />Delete</DropdownMenuItem> : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )
                })}
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => addResourceAt("file", "other")}><FilePlus2Icon className="size-4" />New file</ContextMenuItem>
                  <ContextMenuItem onClick={() => addResourceAt("directory", "other")}><FolderPlusIcon className="size-4" />New folder</ContextMenuItem>
                  <ContextMenuItem onClick={() => { setUploadTargetPath("other"); uploadInputRef.current?.click() }}><UploadIcon className="size-4" />Upload</ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={72} minSize={30} className="min-w-0">
              <div className="flex h-full min-h-0 flex-col">
                <div className="border-b px-3 py-2 text-sm text-muted-foreground">{selectedEntry?.path ?? "Editor"}</div>
                <div className="min-h-0 flex-1 overflow-hidden p-0">
                  {selectedFile && isEditableSkillFile(selectedFile.path) ? <DocumentContentEditor mode="source" value={fileContent} onChange={setFileContent} sourceLanguage={getSkillSourceLanguage(selectedFile.path, selectedFile.language)} /> : <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">{selectedEntry?.kind === "directory" ? "Create or upload files into this folder." : "This resource type is not editable as plain text."}</div>}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : null}
      </div>
    </div>
  )
}

export default SkillsDetailPage
