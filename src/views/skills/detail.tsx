import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "react-router"
import { useLocation, useNavigate } from "react-router"

import { ConfirmDeleteDialog } from "@/views/components/confirm-delete-dialog"
import { ResourceEntryDialog } from "@/views/components/resource-entry-dialog"
import { getSkillSourceLanguage } from "@/lib/skill-files"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { useAutosaveStatus } from "@/hooks/use-autosave-status"
import { emitDataChanged } from "@/data/repositories/data-events"
import type { SkillDetail, SkillFileRecord } from "@/data/domain/models"
import { getSkillDetail, saveSkillDraft } from "@/data/repositories/skill-repository"
import { deleteSkill } from "@/data/repositories/skill-repository"
import { downloadJson, downloadStoredContent, readBrowserFile } from "@/lib/browser-files"
import { buildSkillTree, getDefaultSkillFileName, isSafeSkillResourcePath, normalizeSkillPath, parseSkillFrontmatter, SKILL_ROOT_PATH } from "@/lib/skill-files"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { SkillEditorPanel } from "@/views/skills/components/skill-editor-panel"
import { SkillTreePanel } from "@/views/skills/components/skill-tree-panel"
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/toast"
import { EllipsisIcon, SlashIcon, Trash2Icon } from "lucide-react"

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

function isVisibleSkillEntry(path: string, collapsedPaths: Set<string>) {
  for (const collapsedPath of collapsedPaths) {
    if (path !== collapsedPath && path.startsWith(`${collapsedPath}/`)) return false
  }
  return true
}

function isCoreSkillNode(path: string) {
  return path === SKILL_ROOT_PATH || path === "SKILL.md" || ["scripts", "references", "assets", "other"].includes(path)
}

function buildSkillSnapshot(detail: SkillDetail | null) {
  if (!detail) {
    return ""
  }

  return JSON.stringify({
    id: detail.skill.id,
    selectedVersionId: detail.selectedVersion.id,
    title: detail.skill.title,
    summary: detail.skill.summary,
    source: detail.skill.source,
    files: detail.files.map((file) => ({ path: file.path, content: file.content, kind: file.kind, executable: file.executable, language: file.language })),
  })
}

const SkillsDetailPage = () => {
  const { skillId } = useParams<{ skillId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>()
  const { data, error, isLoading, reload, setData } = useAsyncResource(() => getSkillDetail(skillId ?? "", selectedVersionId), [skillId, selectedVersionId])
  const [draft, setDraft] = useState<SkillDetail | null>(null)
  const [selectedFilePath, setSelectedFilePath] = useState("")
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set())
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadTargetPath, setUploadTargetPath] = useState("other")
  const [hasLoadedInitialState, setHasLoadedInitialState] = useState(false)
  const [entryDialogValue, setEntryDialogValue] = useState("")
  const [entryDialogError, setEntryDialogError] = useState("")
  const [entryDialogMode, setEntryDialogMode] = useState<{ kind: "add-file" | "add-directory" | "rename"; parentPath?: string; targetPath?: string } | null>(null)
  const [deleteTargetPath, setDeleteTargetPath] = useState<string | null>(null)
  const [pendingUpload, setPendingUpload] = useState<{ files: SkillFileRecord[]; conflictPaths: string[] } | null>(null)

  const persistDraft = async (nextDraft: SkillDetail) => {
    const skillMarkdown = nextDraft.files.find((file) => normalizeSkillPath(file.path) === "SKILL.md")?.content ?? ""
    const frontmatter = parseSkillFrontmatter(skillMarkdown)
    const saved = await saveSkillDraft(skillId ?? "", {
      title: frontmatter.name || nextDraft.skill.title,
      source: nextDraft.skill.source,
      summary: frontmatter.description || nextDraft.skill.summary,
      files: nextDraft.files,
      selectedVersionId: nextDraft.selectedVersion.id,
    })
    const next = {
      ...saved,
      skill: {
        ...saved.skill,
        title: frontmatter.name || saved.skill.title,
        summary: frontmatter.description || saved.skill.summary,
      },
    }
    const hasSelectedFile = next.files.some((file) => normalizeSkillPath(file.path) === normalizeSkillPath(selectedFilePath))
    setData(next)
    setDraft(next)
    setSelectedVersionId(next.selectedVersion.id)
    if (hasSelectedFile) {
      setSelectedFilePath((current) => current)
    } else {
      setSelectedFilePath(next.files[0]?.path ?? "")
    }
    emitDataChanged("/skills")
    return buildSkillSnapshot(next)
  }

  const autosave = useAutosaveStatus({
    enabled: hasLoadedInitialState && Boolean(skillId && draft),
    onSave: async () => draft ? persistDraft(draft) : "",
    snapshotKey: buildSkillSnapshot(draft),
  })

  useEffect(() => {
    if (!data) return
    setDraft(data)
    setSelectedVersionId(data.selectedVersion.id)
    setSelectedFilePath((current) => {
      if (current && data.files.some((file) => normalizeSkillPath(file.path) === normalizeSkillPath(current))) {
        return current
      }

      return data.files[0]?.path ?? ""
    })
    setCollapsedPaths(new Set())
    setHasLoadedInitialState(true)
    autosave.markClean(buildSkillSnapshot(data))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const treeEntries = useMemo(() => buildSkillTree(draft?.files ?? [], draft?.skill.title), [draft?.files, draft?.skill.title])
  const visibleEntries = useMemo(() => treeEntries.filter((entry) => {
    if (entry.path === SKILL_ROOT_PATH) return true
    if (collapsedPaths.has(SKILL_ROOT_PATH)) return false
    return isVisibleSkillEntry(entry.path, collapsedPaths)
  }), [collapsedPaths, treeEntries])
  const selectedEntry = treeEntries.find((entry) => entry.path === selectedFilePath) ?? treeEntries[0]
  const selectedFile = selectedEntry?.kind === "file" ? selectedEntry.file ?? null : null
  const selectedFileContent = selectedFile?.content ?? ""
  const handleSelectEntry = (path: string) => {
    setSelectedFilePath(path)
  }

  const toggleFolder = (path: string) => {
    setCollapsedPaths((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const commitAddOrRename = () => {
    if (!draft || !entryDialogMode) {
      return
    }

    const rawValue = entryDialogValue.trim()
    if (!rawValue) {
      setEntryDialogError("Path is required.")
      return
    }

    if (entryDialogMode.kind === "rename") {
      const sourcePath = entryDialogMode.targetPath ?? ""
      const normalizedNext = normalizeSkillPath(rawValue)
      if (normalizedNext === sourcePath) {
        setEntryDialogMode(null)
        setEntryDialogError("")
        return
      }
      if (!isSafeSkillResourcePath(normalizedNext)) {
        setEntryDialogError("Use SKILL.md or a path under scripts, references, assets, or other.")
        return
      }
      if (draft.files.some((file) => normalizeSkillPath(file.path) === normalizedNext && normalizeSkillPath(file.path) !== sourcePath)) {
        setEntryDialogError("Another file or folder already uses that path.")
        return
      }

      const nextFiles = draft.files.map((file) => {
        const currentPath = normalizeSkillPath(file.path)
        if (currentPath === sourcePath) return { ...file, path: normalizedNext }
        if (currentPath.startsWith(`${sourcePath}/`)) return { ...file, path: `${normalizedNext}/${currentPath.slice(sourcePath.length + 1)}` }
        return file
      })
      setDraft({ ...draft, files: nextFiles })
      setSelectedFilePath(normalizedNext)
      setEntryDialogMode(null)
      setEntryDialogError("")
      return
    }

    const parentPath = entryDialogMode.parentPath === SKILL_ROOT_PATH ? "other" : entryDialogMode.parentPath ?? "other"
    const basePath = rawValue.includes("/") ? rawValue : `${parentPath}/${rawValue}`
    const nextPath = getUniqueSkillPath(draft.files, normalizeSkillPath(basePath))
    if (!isSafeSkillResourcePath(nextPath)) {
      setEntryDialogError("Use a path inside scripts, references, assets, or other.")
      return
    }

    const nextFile: SkillFileRecord = entryDialogMode.kind === "add-directory"
      ? { path: nextPath, content: "", language: "plaintext", kind: "directory", executable: false }
      : { path: nextPath, content: nextPath.startsWith("scripts/") ? "export async function main(input: unknown) {\n  return { ok: true, input }\n}\n" : "", language: getSkillSourceLanguage(nextPath), kind: "file", executable: nextPath.startsWith("scripts/") }
    setDraft({ ...draft, files: [...draft.files, nextFile] })
    setCollapsedPaths((current) => { const next = new Set(current); next.delete(parentPath); return next })
    handleSelectEntry(nextPath)
    setEntryDialogMode(null)
    setEntryDialogError("")
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
    setDeleteTargetPath(null)
  }

  const exportEntry = (path: string) => {
    if (!draft) return
    const entry = treeEntries.find((candidate) => candidate.path === path)
    if (!entry) return
    if (path === SKILL_ROOT_PATH) {
      downloadJson(`${draft.skill.title || "skill"}.json`, draft.files)
      return
    }
    const file = draft.files.find((candidate) => normalizeSkillPath(candidate.path) === normalizeSkillPath(path))
    if (entry.kind === "file" && file) {
      downloadStoredContent(entry.label, file.content)
      return
    }
    const subtree = draft.files.filter((candidate) => {
      const currentPath = normalizeSkillPath(candidate.path)
      return currentPath === path || currentPath.startsWith(`${path}/`)
    })
    downloadJson(`${entry.label || "bundle"}.json`, subtree)
  }

  const applyUpload = (files: SkillFileRecord[], conflictPaths: string[], overwrite: boolean) => {
    if (!draft) return
    const conflictSet = new Set(conflictPaths)
    const uploadedPaths = files.filter((file) => overwrite || !conflictSet.has(normalizeSkillPath(file.path))).map((file) => normalizeSkillPath(file.path))
    const nextFiles = draft.files
      .filter((file) => !uploadedPaths.includes(normalizeSkillPath(file.path)))
      .concat(files.filter((file) => uploadedPaths.includes(normalizeSkillPath(file.path))))
    setDraft({ ...draft, files: nextFiles })
    if (uploadedPaths.length > 0) handleSelectEntry(uploadedPaths[0])
    setPendingUpload(null)
  }

  const handleUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!draft) return
    const inputFiles = Array.from(event.target.files ?? [])
    if (inputFiles.length === 0) return
    const nextFiles: SkillFileRecord[] = []
    const uploadParentPath = uploadTargetPath === SKILL_ROOT_PATH ? "other" : uploadTargetPath
    for (const file of inputFiles) {
      const preferredPath = `${uploadParentPath}/${file.name}`
      const existingPath = draft.files.some((candidate) => normalizeSkillPath(candidate.path) === normalizeSkillPath(preferredPath))
      const nextPath = existingPath ? normalizeSkillPath(preferredPath) : getUniqueSkillPath(draft.files.concat(nextFiles), normalizeSkillPath(preferredPath))
      if (!isSafeSkillResourcePath(nextPath)) continue
      nextFiles.push({ path: nextPath, content: await readBrowserFile(file), language: getSkillSourceLanguage(nextPath), kind: "file", executable: nextPath.startsWith("scripts/") })
    }
    const conflictPaths = nextFiles
      .map((file) => normalizeSkillPath(file.path))
      .filter((path, index, paths) => paths.indexOf(path) !== index || draft.files.some((candidate) => normalizeSkillPath(candidate.path) === path))
    if (conflictPaths.length > 0) {
      setPendingUpload({ files: nextFiles, conflictPaths: Array.from(new Set(conflictPaths)) })
    } else if (nextFiles.length > 0) {
      applyUpload(nextFiles, [], false)
    }
    event.target.value = ""
  }

  const handleFileContentChange = (value: string) => {
    if (!draft || !selectedFile) {
      return
    }

    setDraft({
      ...draft,
      files: draft.files.map((file) => normalizeSkillPath(file.path) === normalizeSkillPath(selectedFile.path) ? { ...file, content: value } : file),
    })
  }

  const handleSkillAction = async (actionId: "disable" | "delete") => {
    if (!skillId || !draft) return

    try {
      if (actionId === "delete") {
        await deleteSkill(skillId)
        emitDataChanged("/skills")
        if (location.pathname === `/skills/${skillId}`) navigate("/skills")
        toast.add({ title: "Skill deleted", description: "The skill was removed.", type: "success" })
        return
      }

      await saveSkillDraft(skillId, {
        title: draft.skill.title,
        source: draft.skill.source,
        summary: `[disabled] ${draft.skill.summary}`.trim(),
        files: draft.files,
        selectedVersionId: draft.selectedVersion.id,
      })
      emitDataChanged("/skills")
      toast.add({ title: "Skill disabled", description: "The skill is no longer active.", type: "success" })
    } catch (actionError) {
      toast.add({ title: "Action failed", description: actionError instanceof Error ? actionError.message : String(actionError), type: "error" })
    }
  }

  const skillActions = (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label="Skill actions" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 min-w-40">
        <DropdownMenuItem onClick={() => void handleSkillAction("disable")}>
          <SlashIcon className="size-4" />
          Disable
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => void handleSkillAction("delete")}>
          <Trash2Icon className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title={draft?.skill.title ?? "Skill"} description={draft?.skill.summary} actions={draft ? skillActions : null} />
      <input ref={uploadInputRef} type="file" multiple className="hidden" onChange={handleUploadChange} />
      <div className="min-h-0 flex-1 p-3">
        {isLoading ? <LoadingCard title="Loading skill..." /> : null}
        {error ? <ErrorCard error={error} onRetry={reload} /> : null}
        {!isLoading && !error && draft ? (
          <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-9.5rem)] overflow-hidden rounded-xl border bg-background">
            <ResizablePanel defaultSize={28} minSize={18} className="min-w-0">
              <SkillTreePanel collapsedPaths={collapsedPaths} entries={visibleEntries} onAddDirectory={(parentPath) => { setEntryDialogMode({ kind: "add-directory", parentPath }); setEntryDialogValue("new-folder"); setEntryDialogError("") }} onAddFile={(parentPath) => { setEntryDialogMode({ kind: "add-file", parentPath }); setEntryDialogValue(getDefaultSkillFileName(parentPath)); setEntryDialogError("") }} onDelete={(path) => setDeleteTargetPath(path)} onExport={exportEntry} onRename={(path) => { setEntryDialogMode({ kind: "rename", targetPath: path }); setEntryDialogValue(path); setEntryDialogError("") }} onSelect={handleSelectEntry} onToggle={toggleFolder} onUpload={(path) => { setUploadTargetPath(path); uploadInputRef.current?.click() }} selectedPath={selectedFilePath} />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={72} minSize={30} className="min-w-0">
              <SkillEditorPanel fileContent={selectedFileContent} selectedFile={selectedFile} onChange={handleFileContentChange} />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : null}
      </div>
      <ResourceEntryDialog description={entryDialogMode?.kind === "rename" ? "Rename the selected file or folder. Descendant paths will move with the folder." : "Create a new item inside the selected folder."} errorMessage={entryDialogError} fieldLabel={entryDialogMode?.kind === "rename" ? "New path" : "File or folder name"} onOpenChange={(open) => { if (!open) { setEntryDialogMode(null); setEntryDialogError("") } }} onSubmit={commitAddOrRename} onValueChange={setEntryDialogValue} open={Boolean(entryDialogMode)} placeholder={entryDialogMode?.kind === "rename" ? "references/guide.md" : "guide.md"} submitLabel={entryDialogMode?.kind === "rename" ? "Rename" : "Create"} title={entryDialogMode?.kind === "rename" ? "Rename item" : entryDialogMode?.kind === "add-directory" ? "Create folder" : "Create file"} value={entryDialogValue} />
      <ConfirmDeleteDialog description={deleteTargetPath ? `Delete ${deleteTargetPath} and any nested items?` : "Delete this item?"} onConfirm={() => deleteTargetPath ? deleteEntry(deleteTargetPath) : undefined} onOpenChange={(open) => { if (!open) setDeleteTargetPath(null) }} open={Boolean(deleteTargetPath)} title="Delete item" />
      <AlertDialog open={Boolean(pendingUpload)} onOpenChange={(open) => { if (!open) setPendingUpload(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overwrite existing files?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingUpload?.conflictPaths.length === 1 ? `The file ${pendingUpload.conflictPaths[0]} already exists.` : `${pendingUpload?.conflictPaths.length ?? 0} files already exist.`} Choose whether to overwrite them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingUpload(null)}>Skip existing</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingUpload ? applyUpload(pendingUpload.files, pendingUpload.conflictPaths, true) : undefined}>Overwrite</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default SkillsDetailPage
