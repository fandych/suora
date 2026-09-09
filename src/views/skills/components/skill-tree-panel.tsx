import { ChevronDownIcon, ChevronRightIcon, DownloadIcon, FileCode2Icon, FileTextIcon, FolderIcon, FolderPlusIcon, FilePlus2Icon, PencilIcon, Trash2Icon, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SKILL_ROOT_PATH, type SkillTreeEntry } from "@/lib/resources/skill-files"

type SkillTreePanelProps = {
  collapsedPaths: Set<string>
  entries: SkillTreeEntry[]
  onAddDirectory: (parentPath: string) => void
  onAddFile: (parentPath: string) => void
  onDelete: (path: string) => void
  onExport: (path: string) => void
  onRename: (path: string) => void
  onSelect: (path: string) => void
  onToggle: (path: string) => void
  onUpload: (path: string) => void
  selectedPath: string
}

const rowClass = "group flex w-full items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-muted/60"
const actionButtonClassName = "shrink-0 opacity-0 group-hover:opacity-100"

function isProtectedPath(path: string) {
  return path === SKILL_ROOT_PATH || path === "SKILL.md" || ["scripts", "references", "assets", "other"].includes(path)
}

function getIcon(entry: SkillTreeEntry) {
  if (entry.kind === "directory") {
    return <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
  }
  if (entry.path === "SKILL.md") {
    return <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
  }
  return <FileCode2Icon className="size-4 shrink-0 text-muted-foreground" />
}

export function SkillTreePanel({ collapsedPaths, entries, onAddDirectory, onAddFile, onDelete, onExport, onRename, onSelect, onToggle, onUpload, selectedPath }: SkillTreePanelProps) {
  return (
    <div className="min-h-0 h-full overflow-y-auto p-2">
      {entries.map((entry) => {
        const isDirectory = entry.kind === "directory"
        const isCollapsed = collapsedPaths.has(entry.path)

        return (
          <ContextMenu key={entry.path}>
            <ContextMenuTrigger className="block">
              <div className={`${rowClass} ${entry.path === selectedPath ? "bg-muted" : ""}`}>
                <button className="flex min-w-0 flex-1 items-center gap-1 text-left" onClick={() => onSelect(entry.path)}>
                  <span className="flex min-w-0 items-center gap-1" style={{ paddingLeft: `${entry.depth * 12}px` }}>
                    {isDirectory ? <span className="flex size-4 items-center justify-center" onClick={(event) => { event.stopPropagation(); onToggle(entry.path) }}>{isCollapsed ? <ChevronRightIcon className="size-4 text-muted-foreground" /> : <ChevronDownIcon className="size-4 text-muted-foreground" />}</span> : <span className="size-4" />}
                    {getIcon(entry)}
                    <span className="truncate">{entry.label}</span>
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className={actionButtonClassName} />}>
                    <span>...</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44 min-w-44">
                    {isDirectory ? <DropdownMenuItem onClick={() => onAddFile(entry.path)}><FilePlus2Icon className="size-4" />New file</DropdownMenuItem> : null}
                    {isDirectory ? <DropdownMenuItem onClick={() => onAddDirectory(entry.path)}><FolderPlusIcon className="size-4" />New folder</DropdownMenuItem> : null}
                    {isDirectory ? <DropdownMenuItem onClick={() => onUpload(entry.path)}><UploadIcon className="size-4" />Upload</DropdownMenuItem> : null}
                    <DropdownMenuItem onClick={() => onExport(entry.path)}><DownloadIcon className="size-4" />Export</DropdownMenuItem>
                    {!isProtectedPath(entry.path) ? <DropdownMenuItem onClick={() => onRename(entry.path)}><PencilIcon className="size-4" />Rename</DropdownMenuItem> : null}
                    {!isProtectedPath(entry.path) ? <DropdownMenuItem variant="destructive" onClick={() => onDelete(entry.path)}><Trash2Icon className="size-4" />Delete</DropdownMenuItem> : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              {isDirectory ? <ContextMenuItem onClick={() => onAddFile(entry.path)}><FilePlus2Icon className="size-4" />New file</ContextMenuItem> : null}
              {isDirectory ? <ContextMenuItem onClick={() => onAddDirectory(entry.path)}><FolderPlusIcon className="size-4" />New folder</ContextMenuItem> : null}
              {isDirectory ? <ContextMenuItem onClick={() => onUpload(entry.path)}><UploadIcon className="size-4" />Upload</ContextMenuItem> : null}
              <ContextMenuItem onClick={() => onExport(entry.path)}><DownloadIcon className="size-4" />Export</ContextMenuItem>
              {!isProtectedPath(entry.path) ? <ContextMenuItem onClick={() => onRename(entry.path)}><PencilIcon className="size-4" />Rename</ContextMenuItem> : null}
              {!isProtectedPath(entry.path) ? <ContextMenuItem variant="destructive" onClick={() => onDelete(entry.path)}><Trash2Icon className="size-4" />Delete</ContextMenuItem> : null}
            </ContextMenuContent>
          </ContextMenu>
        )
      })}
    </div>
  )
}
