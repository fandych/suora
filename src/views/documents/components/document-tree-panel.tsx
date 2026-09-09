import { ChevronDownIcon, ChevronRightIcon, DownloadIcon, FilePlus2Icon, FileTextIcon, FolderIcon, FolderPlusIcon, PencilIcon, Trash2Icon, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { DocumentTreeEntry } from "@/data/domain/document-tree"
import { getDocumentDisplayName } from "@/data/domain/document-tree"

type DocumentTreePanelProps = {
  collapsedIds: Set<string>
  entries: DocumentTreeEntry[]
  onAddDirectory: (parentId: string) => void
  onAddFile: (parentId: string) => void
  onDelete: (nodeId: string) => void
  onExport: (nodeId: string) => void
  onRename: (nodeId: string) => void
  onSelect: (nodeId: string) => void
  onToggle: (nodeId: string) => void
  onUpload: (parentId: string) => void
  selectedNodeId: string
}

const rowClass = "group flex w-full items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-muted/60"
const actionButtonClassName = "shrink-0 opacity-0 group-hover:opacity-100"

export function DocumentTreePanel({ collapsedIds, entries, onAddDirectory, onAddFile, onDelete, onExport, onRename, onSelect, onToggle, onUpload, selectedNodeId }: DocumentTreePanelProps) {
  return (
    <div className="min-h-0 h-full overflow-y-auto p-2">
      {entries.map(({ node, depth }) => {
        const isFolder = (node.type ?? "document") === "folder"
        const isCollapsed = collapsedIds.has(node.id)

        return (
          <ContextMenu key={node.id}>
            <ContextMenuTrigger className="block">
              <div className={`${rowClass} ${node.id === selectedNodeId ? "bg-muted" : ""}`}>
                <button className="flex min-w-0 flex-1 items-center gap-1 text-left" onClick={() => onSelect(node.id)}>
                  <span className="flex min-w-0 items-center gap-1" style={{ paddingLeft: `${depth * 12}px` }}>
                    {isFolder ? <span className="flex size-4 items-center justify-center" onClick={(event) => { event.stopPropagation(); onToggle(node.id) }}>{isCollapsed ? <ChevronRightIcon className="size-4 text-muted-foreground" /> : <ChevronDownIcon className="size-4 text-muted-foreground" />}</span> : <span className="size-4" />}
                    {isFolder ? <FolderIcon className="size-4 shrink-0 text-muted-foreground" /> : <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />}
                    <span className="truncate">{isFolder ? node.title : getDocumentDisplayName(node.title)}</span>
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className={actionButtonClassName} />}>
                    <span>...</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44 min-w-44">
                    {isFolder ? <DropdownMenuItem onClick={() => onAddFile(node.id)}><FilePlus2Icon className="size-4" />New file</DropdownMenuItem> : null}
                    {isFolder ? <DropdownMenuItem onClick={() => onAddDirectory(node.id)}><FolderPlusIcon className="size-4" />New folder</DropdownMenuItem> : null}
                    {isFolder ? <DropdownMenuItem onClick={() => onUpload(node.id)}><UploadIcon className="size-4" />Upload</DropdownMenuItem> : null}
                    <DropdownMenuItem onClick={() => onExport(node.id)}><DownloadIcon className="size-4" />Export</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onRename(node.id)}><PencilIcon className="size-4" />Rename</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => onDelete(node.id)}><Trash2Icon className="size-4" />Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              {isFolder ? <ContextMenuItem onClick={() => onAddFile(node.id)}><FilePlus2Icon className="size-4" />New file</ContextMenuItem> : null}
              {isFolder ? <ContextMenuItem onClick={() => onAddDirectory(node.id)}><FolderPlusIcon className="size-4" />New folder</ContextMenuItem> : null}
              {isFolder ? <ContextMenuItem onClick={() => onUpload(node.id)}><UploadIcon className="size-4" />Upload</ContextMenuItem> : null}
              <ContextMenuItem onClick={() => onExport(node.id)}><DownloadIcon className="size-4" />Export</ContextMenuItem>
              <ContextMenuItem onClick={() => onRename(node.id)}><PencilIcon className="size-4" />Rename</ContextMenuItem>
              <ContextMenuItem variant="destructive" onClick={() => onDelete(node.id)}><Trash2Icon className="size-4" />Delete</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        )
      })}
    </div>
  )
}
