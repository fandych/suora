import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import { useAppStore } from '@/store/appStore'
import { SidePanel } from '@/components/layout/SidePanel'
import { ResizeHandle } from '@/components/layout/ResizeHandle'
import { useResizablePanel } from '@/hooks/useResizablePanel'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { DocumentGraphView } from '@/components/documents/DocumentGraphView'
import { MathBlock, InlineMath, MermaidBlock } from '@/components/documents/DocumentExtensions'
import { confirm } from '@/services/confirmDialog'
import { createDocument, createDocumentGroup, createDocumentId, extractMarkdownImageReferences, findReferencedDocuments, getDocumentDisplayName, getDocumentExtension, getDocumentKindLabel, isMarkdownDocumentTitle, searchDocuments, tiptapJsonToMarkdown } from '@/services/documents'
import { buildDocumentGraph, buildDocumentPath, type DocumentGraph } from '@/services/documentGraph'
import type { DocumentFolder, DocumentGroup, DocumentItem, DocumentNode } from '@/types'

const DOCUMENT_GROUP_COLOR_CLASS: Record<string, string> = {
  '#12A8A0': 'bg-[#12A8A0]',
  '#4D7CFF': 'bg-[#4D7CFF]',
  '#D9A441': 'bg-[#D9A441]',
  '#35B98F': 'bg-[#35B98F]',
  '#E45F68': 'bg-[#E45F68]',
  '#9B7CFF': 'bg-[#9B7CFF]',
}

function sortDocumentNodes(a: DocumentNode, b: DocumentNode) {
  return a.type === b.type ? a.title.localeCompare(b.title) : a.type === 'folder' ? -1 : 1
}

function getDocumentGroupColorClass(color: string) {
  return DOCUMENT_GROUP_COLOR_CLASS[color] ?? 'bg-accent'
}

function getDocumentNodeDisplayName(node: DocumentNode): string {
  if (node.type !== 'document') return node.title
  return getDocumentDisplayName(node.title)
}

const EMPTY_DOCUMENT_CHILDREN: DocumentNode[] = []
const EMPTY_DOCUMENT_GRAPH: DocumentGraph = {
  nodes: [],
  edges: [],
  backlinksByDocumentId: {},
  referencesByDocumentId: {},
  orphanDocumentIds: [],
  tags: [],
}

function collectAncestorFolderIds(parentId: string | null, nodes: DocumentNode[]) {
  const ids: string[] = []
  const visited = new Set<string>()
  let currentId = parentId

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    ids.push(currentId)
    const currentNode = nodes.find((node) => node.id === currentId && node.type === 'folder')
    currentId = currentNode?.parentId ?? null
  }

  return ids
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function escapeAttr(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function inlineMarkdown(value: string) {
  // Extract inline math tokens before HTML escaping to preserve raw LaTeX.
  // The pattern intentionally excludes newlines ($\n) because inline math
  // is single-line by convention; block math uses $$...$$.
  const mathTokens: string[] = []
  const tokenized = value.replace(/\$([^$\n]+)\$/g, (_, latex: string) => {
    mathTokens.push(latex)
    return `\x01M${mathTokens.length - 1}\x01`
  })

  let result = escapeHtml(tokenized)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt: string, src: string) => `<img src="${src}" alt="${alt}">`)
    .replace(/\[\[([^\]\n]+)\]\]/g, '<a href="#doc:$1">$1</a>')
    .replace(/\[([^\]\n]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

  result = result.replace(/\x01M(\d+)\x01/g, (_, i: string) => {
    const latex = mathTokens[parseInt(i)]
    return `<span data-math-inline="${escapeAttr(latex)}"></span>`
  })

  return result
}

function markdownToTiptapHtml(markdown: string) {
  const lines = markdown.split('\n')
  const html: string[] = []
  let list: 'ul' | 'ol' | null = null
  let inCode = false
  let codeLang = ''
  let code: string[] = []
  let inMath = false
  let math: string[] = []

  const closeList = () => {
    if (list) {
      html.push(`</${list}>`)
      list = null
    }
  }

  lines.forEach((line) => {
    // ── Code / mermaid fence ──────────────────────────────────────────────
    if (line.trim().startsWith('```')) {
      if (inCode) {
        if (codeLang === 'mermaid') {
          html.push(`<div data-mermaid="${escapeAttr(code.join('\n'))}"></div>`)
        } else {
          html.push(`<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(code.join('\n'))}</code></pre>`)
        }
        code = []
        codeLang = ''
        inCode = false
      } else {
        closeList()
        codeLang = line.trim().slice(3).trim()
        inCode = true
      }
      return
    }

    if (inCode) {
      code.push(line)
      return
    }

    // ── Block math ($$...$$) ───────────────────────────────────────────────
    if (line.trim() === '$$') {
      if (inMath) {
        html.push(`<div data-math-block="${escapeAttr(math.join('\n'))}"></div>`)
        math = []
        inMath = false
      } else {
        closeList()
        inMath = true
      }
      return
    }

    if (inMath) {
      math.push(line)
      return
    }

    // ── Normal inline content ──────────────────────────────────────────────
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      closeList()
      html.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`)
      return
    }

    const unordered = /^\s*[-*]\s+(.*)$/.exec(line)
    if (unordered) {
      if (list !== 'ul') {
        closeList()
        list = 'ul'
        html.push('<ul>')
      }
      html.push(`<li>${inlineMarkdown(unordered[1])}</li>`)
      return
    }

    const ordered = /^\s*\d+\.\s+(.*)$/.exec(line)
    if (ordered) {
      if (list !== 'ol') {
        closeList()
        list = 'ol'
        html.push('<ol>')
      }
      html.push(`<li>${inlineMarkdown(ordered[1])}</li>`)
      return
    }

    closeList()
    if (line.trim().startsWith('>')) {
      html.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ''))}</blockquote>`)
    } else if (line.trim() === '---') {
      html.push('<hr />')
    } else if (line.trim()) {
      html.push(`<p>${inlineMarkdown(line)}</p>`)
    }
  })

  closeList()
  if (inCode) {
    if (codeLang === 'mermaid') {
      html.push(`<div data-mermaid="${escapeAttr(code.join('\n'))}"></div>`)
    } else {
      html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
    }
  }
  if (inMath) html.push(`<div data-math-block="${escapeAttr(math.join('\n'))}"></div>`)
  return html.join('\n') || '<p></p>'
}

function DocumentTiptapEditor({ document, onUpdate }: { document: DocumentItem; onUpdate: (markdown: string) => void }) {
  // Prevents the onUpdate callback from firing during programmatic content resets
  // that occur when switching between documents, avoiding a feedback loop where
  // the reset triggers onUpdate which would overwrite the incoming document's markdown.
  const isSyncingFromPropsRef = useRef(false)
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing…' }),
      Image.configure({ inline: true }),
      MathBlock,
      InlineMath,
      MermaidBlock,
    ],
    content: markdownToTiptapHtml(document.markdown),
    editable: true,
    editorProps: {
      attributes: {
        class: 'document-prose min-h-full focus:outline-none',
      },
    },
    onUpdate: ({ editor: ed }: { editor: { getJSON: () => unknown } }) => {
      if (isSyncingFromPropsRef.current) return
      const json = ed.getJSON()
      const markdown = tiptapJsonToMarkdown(json as Parameters<typeof tiptapJsonToMarkdown>[0])
      onUpdate(markdown)
    },
  })

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    // Only sync editor content when the document identity (id) changes, not on every
    // markdown keystroke — this intentionally avoids overwriting in-flight user edits
    // that haven't been flushed to the store yet.
    isSyncingFromPropsRef.current = true
    editor.commands.setContent(markdownToTiptapHtml(document.markdown), { emitUpdate: false })
    isSyncingFromPropsRef.current = false
  }, [document.id])

  return <EditorContent editor={editor} className="document-tiptap-wysiwyg h-full" />
}

function TreeNode({
  node,
  childrenByParent,
  selectedDocumentId,
  selectedFolderId,
  editingNodeId,
  editingTitle,
  expanded,
  onToggle,
  onSelectDocument,
  onSelectFolder,
  onStartRename,
  onEditingTitleChange,
  onCommitRename,
  onCancelRename,
  onCreateDocument,
  onCreateFolder,
  onDeleteNode,
}: {
  node: DocumentNode
  childrenByParent: Map<string | null, DocumentNode[]>
  selectedDocumentId: string | null
  selectedFolderId: string | null
  editingNodeId: string | null
  editingTitle: string
  expanded: Set<string>
  onToggle: (id: string) => void
  onSelectDocument: (id: string) => void
  onSelectFolder: (id: string) => void
  onStartRename: (node: DocumentNode) => void
  onEditingTitleChange: (value: string) => void
  onCommitRename: () => void
  onCancelRename: () => void
  onCreateDocument: (parentId: string | null, groupId?: string) => void
  onCreateFolder: (parentId: string | null, groupId?: string) => void
  onDeleteNode: (node: DocumentNode) => void
}) {
  const { t } = useI18n()
  const children = childrenByParent.get(node.id) ?? EMPTY_DOCUMENT_CHILDREN
  const isExpanded = expanded.has(node.id)
  const isActive = node.type === 'document' ? selectedDocumentId === node.id : selectedFolderId === node.id
  const isEditing = editingNodeId === node.id
  const nodeDisplayName = getDocumentNodeDisplayName(node)

  return (
    <div>
      <div className={`group flex items-center gap-1 rounded-2xl px-1.5 py-1 transition-all ${isActive ? 'bg-accent/12 text-accent shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.16)]' : 'text-text-secondary hover:bg-surface-3/55 hover:text-text-primary'}`}>
        {isEditing ? (
          <>
            {node.type === 'folder' ? (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onToggle(node.id)}
                aria-label={isExpanded ? `${t('documents.collapseFolder', 'Collapse folder')}: ${nodeDisplayName}` : `${t('documents.expandFolder', 'Expand folder')}: ${nodeDisplayName}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-surface-3/55 hover:text-text-primary"
                title={isExpanded ? t('documents.collapseFolder', 'Collapse folder') : t('documents.expandFolder', 'Expand folder')}
              >
                <IconifyIcon name="ui-chevron-down" size={13} color="currentColor" className={isExpanded ? '' : '-rotate-90'} />
              </button>
            ) : (
              <span className="h-8 w-8 shrink-0" />
            )}
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border ${node.type === 'folder' ? 'border-amber-400/20 bg-amber-400/10 text-amber-300' : 'border-accent/15 bg-accent/10 text-accent'}`}>
              <IconifyIcon name={node.type === 'folder' ? 'skill-filesystem' : 'skill-code-review'} size={15} color="currentColor" />
            </span>
            <input
              autoFocus
              value={editingTitle}
              onChange={(event) => onEditingTitleChange(event.target.value)}
              onBlur={onCommitRename}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) onCommitRename()
                if (event.key === 'Escape') onCancelRename()
              }}
              aria-label={t('documents.nodeName', 'Document or folder name')}
              className="min-w-0 flex-1 rounded-xl border border-accent/30 bg-surface-0/88 px-3 py-2 text-[12px] font-medium text-text-primary outline-none focus:ring-2 focus:ring-accent/20"
            />
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onCommitRename}
              aria-label={t('documents.saveNodeName', 'Save name')}
              title={t('common.save', 'Save')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-success/20 bg-success/10 text-success transition-colors hover:bg-success/15"
            >
              <IconifyIcon name="ui-check" size={14} color="currentColor" />
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onCancelRename}
              aria-label={t('documents.cancelRename', 'Cancel rename')}
              title={t('common.cancel', 'Cancel')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border-subtle/65 bg-surface-2/70 text-text-muted transition-colors hover:text-text-primary"
            >
              <IconifyIcon name="ui-close" size={14} color="currentColor" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                if (node.type === 'folder') {
                  onSelectFolder(node.id)
                  onToggle(node.id)
                } else {
                  onSelectDocument(node.id)
                }
              }}
              onDoubleClick={() => onStartRename(node)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1.5 py-1.5 text-left"
            >
              {node.type === 'folder' ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-text-muted">
                  <IconifyIcon name="ui-chevron-down" size={13} color="currentColor" className={isExpanded ? '' : '-rotate-90'} />
                </span>
              ) : (
                <span className="h-5 w-5 shrink-0" />
              )}
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border ${node.type === 'folder' ? 'border-amber-400/20 bg-amber-400/10 text-amber-300' : 'border-accent/15 bg-accent/10 text-accent'}`}>
                <IconifyIcon name={node.type === 'folder' ? 'skill-filesystem' : 'skill-code-review'} size={15} color="currentColor" />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{nodeDisplayName}</span>
            </button>
            <div className={`flex shrink-0 items-center gap-1 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
              {node.type === 'folder' && (
                <>
                  <button
                    type="button"
                    title={t('documents.newDocInFolder', 'New child document')}
                    aria-label={`${t('documents.newDocInFolder', 'New child document')}: ${node.title}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onCreateDocument(node.id, node.groupId)
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-xl bg-accent/15 text-accent transition-colors hover:bg-accent/25"
                  >
                    <IconifyIcon name="ui-plus" size={13} color="currentColor" />
                  </button>
                  <button
                    type="button"
                    title={t('documents.newSubfolder', 'New subfolder')}
                    aria-label={`${t('documents.newSubfolder', 'New subfolder')}: ${node.title}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onCreateFolder(node.id, node.groupId)
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-xl border border-border-subtle/65 bg-surface-2/70 text-text-muted transition-colors hover:text-text-primary"
                  >
                    <IconifyIcon name="skill-filesystem" size={13} color="currentColor" />
                  </button>
                </>
              )}
              <button
                type="button"
                title={t('common.rename', 'Rename')}
                aria-label={`${t('common.rename', 'Rename')}: ${nodeDisplayName}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onStartRename(node)
                }}
                className="flex h-7 w-7 items-center justify-center rounded-xl border border-border-subtle/65 bg-surface-2/70 text-text-muted transition-colors hover:text-text-primary"
              >
                <IconifyIcon name="ui-edit" size={13} color="currentColor" />
              </button>
              <button
                type="button"
                title={t('common.delete', 'Delete')}
                aria-label={`${t('common.delete', 'Delete')}: ${nodeDisplayName}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onDeleteNode(node)
                }}
                className="flex h-7 w-7 items-center justify-center rounded-xl border border-danger/20 bg-danger/10 text-danger transition-colors hover:bg-danger/15"
              >
                <IconifyIcon name="ui-trash" size={13} color="currentColor" />
              </button>
            </div>
          </>
        )}
      </div>
      {node.type === 'folder' && isExpanded && children.length > 0 && (
        <div className="mt-1 space-y-1 pl-4">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              childrenByParent={childrenByParent}
              selectedDocumentId={selectedDocumentId}
              selectedFolderId={selectedFolderId}
              editingNodeId={editingNodeId}
              editingTitle={editingTitle}
              expanded={expanded}
              onToggle={onToggle}
              onSelectDocument={onSelectDocument}
              onSelectFolder={onSelectFolder}
              onStartRename={onStartRename}
              onEditingTitleChange={onEditingTitleChange}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onCreateDocument={onCreateDocument}
              onCreateFolder={onCreateFolder}
              onDeleteNode={onDeleteNode}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GroupTreeNode({
  group,
  children,
  documentCount,
  isActive,
  isExpanded,
  editingGroupId,
  editingGroupName,
  childrenByParent,
  selectedDocumentId,
  selectedFolderId,
  editingNodeId,
  editingTitle,
  expanded,
  onToggle,
  onSelectGroup,
  onStartRenameGroup,
  onEditingGroupNameChange,
  onCommitRenameGroup,
  onCancelRenameGroup,
  onSelectDocument,
  onSelectFolder,
  onStartRenameNode,
  onEditingTitleChange,
  onCommitRenameNode,
  onCancelRenameNode,
  onCreateDocument,
  onCreateFolder,
  onDeleteNode,
  onDeleteGroup,
}: {
  group: DocumentGroup
  children: DocumentNode[]
  documentCount: number
  isActive: boolean
  isExpanded: boolean
  editingGroupId: string | null
  editingGroupName: string
  childrenByParent: Map<string | null, DocumentNode[]>
  selectedDocumentId: string | null
  selectedFolderId: string | null
  editingNodeId: string | null
  editingTitle: string
  expanded: Set<string>
  onToggle: (id: string) => void
  onSelectGroup: (group: DocumentGroup) => void
  onStartRenameGroup: (group: DocumentGroup) => void
  onEditingGroupNameChange: (value: string) => void
  onCommitRenameGroup: () => void
  onCancelRenameGroup: () => void
  onSelectDocument: (id: string) => void
  onSelectFolder: (id: string) => void
  onStartRenameNode: (node: DocumentNode) => void
  onEditingTitleChange: (value: string) => void
  onCommitRenameNode: () => void
  onCancelRenameNode: () => void
  onCreateDocument: (parentId: string | null, groupId?: string) => void
  onCreateFolder: (parentId: string | null, groupId?: string) => void
  onDeleteNode: (node: DocumentNode) => void
  onDeleteGroup: (group: DocumentGroup) => void
}) {
  const { t } = useI18n()
  const isEditing = editingGroupId === group.id

  return (
    <div>
      <div className={`group flex items-center gap-1 rounded-2xl px-1.5 py-1 transition-all ${isActive ? 'bg-accent/12 text-accent shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.16)]' : 'text-text-secondary hover:bg-surface-3/55 hover:text-text-primary'}`}>
        {isEditing ? (
          <>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onToggle(group.id)}
              aria-label={isExpanded ? `${t('documents.collapseFolder', 'Collapse folder')}: ${group.name}` : `${t('documents.expandFolder', 'Expand folder')}: ${group.name}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-surface-3/55 hover:text-text-primary"
              title={isExpanded ? t('documents.collapseFolder', 'Collapse folder') : t('documents.expandFolder', 'Expand folder')}
            >
              <IconifyIcon name="ui-chevron-down" size={13} color="currentColor" className={isExpanded ? '' : '-rotate-90'} />
            </button>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-white/95 ${getDocumentGroupColorClass(group.color)}`}>
              <IconifyIcon name="skill-filesystem" size={15} color="currentColor" />
            </span>
            <input
              autoFocus
              value={editingGroupName}
              onChange={(event) => onEditingGroupNameChange(event.target.value)}
              onBlur={onCommitRenameGroup}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) onCommitRenameGroup()
                if (event.key === 'Escape') onCancelRenameGroup()
              }}
              className="min-w-0 flex-1 rounded-xl border border-accent/30 bg-surface-0/88 px-3 py-2 text-[12px] font-medium text-text-primary outline-none focus:ring-2 focus:ring-accent/20"
              aria-label={t('documents.groupName', 'Group name')}
            />
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onCommitRenameGroup} title={t('common.save', 'Save')} aria-label={t('documents.saveGroupName', 'Save group name')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-success/20 bg-success/10 text-success hover:bg-success/15">
              <IconifyIcon name="ui-check" size={14} color="currentColor" />
            </button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onCancelRenameGroup} title={t('common.cancel', 'Cancel')} aria-label={t('documents.cancelGroupRename', 'Cancel group rename')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border-subtle/65 bg-surface-2/70 text-text-muted hover:text-text-primary">
              <IconifyIcon name="ui-close" size={14} color="currentColor" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onSelectGroup(group)}
              onDoubleClick={() => onStartRenameGroup(group)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1.5 py-1.5 text-left"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-text-muted">
                <IconifyIcon name="ui-chevron-down" size={13} color="currentColor" className={isExpanded ? '' : '-rotate-90'} />
              </span>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-white/95 ${getDocumentGroupColorClass(group.color)}`}>
                <IconifyIcon name="skill-filesystem" size={15} color="currentColor" />
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">{group.name}</span>
              <span className="shrink-0 rounded-lg bg-surface-2/60 px-1.5 py-0.5 text-[10px] text-text-muted">{documentCount}</span>
            </button>
            <div className={`flex shrink-0 items-center gap-1 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
              <button type="button" title={t('documents.newDoc', 'New Document')} aria-label={`${t('documents.newDoc', 'New Document')}: ${group.name}`} onClick={(event) => { event.stopPropagation(); onCreateDocument(null, group.id) }} className="flex h-7 w-7 items-center justify-center rounded-xl bg-accent/15 text-accent transition-colors hover:bg-accent/25">
                <IconifyIcon name="ui-plus" size={13} color="currentColor" />
              </button>
              <button type="button" title={t('documents.newFolderButton', 'New Folder')} aria-label={`${t('documents.newFolderButton', 'New Folder')}: ${group.name}`} onClick={(event) => { event.stopPropagation(); onCreateFolder(null, group.id) }} className="flex h-7 w-7 items-center justify-center rounded-xl border border-border-subtle/65 bg-surface-2/70 text-text-muted transition-colors hover:text-text-primary">
                <IconifyIcon name="skill-filesystem" size={13} color="currentColor" />
              </button>
              <button type="button" title={t('documents.groupGraph', 'Knowledge Graph')} aria-label={`${t('documents.groupGraph', 'Knowledge Graph')}: ${group.name}`} onClick={(event) => { event.stopPropagation(); onSelectGroup(group) }} className="flex h-7 w-7 items-center justify-center rounded-xl border border-border-subtle/65 bg-surface-2/70 text-text-muted transition-colors hover:text-text-primary">
                <IconifyIcon name="ui-chart" size={13} color="currentColor" />
              </button>
              <button type="button" title={t('common.rename', 'Rename')} aria-label={`${t('common.rename', 'Rename')}: ${group.name}`} onClick={(event) => { event.stopPropagation(); onStartRenameGroup(group) }} className="flex h-7 w-7 items-center justify-center rounded-xl border border-border-subtle/65 bg-surface-2/70 text-text-muted transition-colors hover:text-text-primary">
                <IconifyIcon name="ui-edit" size={13} color="currentColor" />
              </button>
              <button type="button" title={t('common.delete', 'Delete')} aria-label={`${t('common.delete', 'Delete')}: ${group.name}`} onClick={(event) => { event.stopPropagation(); onDeleteGroup(group) }} className="flex h-7 w-7 items-center justify-center rounded-xl border border-danger/20 bg-danger/10 text-danger transition-colors hover:bg-danger/15">
                <IconifyIcon name="ui-trash" size={13} color="currentColor" />
              </button>
            </div>
          </>
        )}
      </div>
      {isExpanded && children.length > 0 && (
        <div className="mt-1 space-y-1 pl-4">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              childrenByParent={childrenByParent}
              selectedDocumentId={selectedDocumentId}
              selectedFolderId={selectedFolderId}
              editingNodeId={editingNodeId}
              editingTitle={editingTitle}
              expanded={expanded}
              onToggle={onToggle}
              onSelectDocument={onSelectDocument}
              onSelectFolder={onSelectFolder}
              onStartRename={onStartRenameNode}
              onEditingTitleChange={onEditingTitleChange}
              onCommitRename={onCommitRenameNode}
              onCancelRename={onCancelRenameNode}
              onCreateDocument={onCreateDocument}
              onCreateFolder={onCreateFolder}
              onDeleteNode={onDeleteNode}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function DocumentsLayout() {
  const { t } = useI18n()
  const [panelWidth, setPanelWidth] = useResizablePanel('documents', 310)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [mode, setMode] = useState<'editor' | 'source' | 'graph'>('editor')
  const {
    documentGroups,
    documentNodes,
    selectedDocumentGroupId,
    selectedDocumentId,
    addDocumentGroup,
    updateDocumentGroup,
    removeDocumentGroup,
    setSelectedDocumentGroup,
    addDocumentFolder,
    addDocument,
    updateDocumentNode,
    removeDocumentNode,
    setSelectedDocument,
  } = useAppStore()

  const activeGroup = documentGroups.find((group) => group.id === selectedDocumentGroupId) ?? documentGroups[0] ?? null
  const activeGroupId = activeGroup?.id ?? null
  const groupNodes = useMemo(() => activeGroupId ? documentNodes.filter((node) => node.groupId === activeGroupId) : [], [documentNodes, activeGroupId])
  const activeDocument = useMemo(() => documentNodes.find((node): node is DocumentItem => node.type === 'document' && node.id === selectedDocumentId) ?? null, [documentNodes, selectedDocumentId])
  const activeDocumentIsMarkdown = activeDocument ? isMarkdownDocumentTitle(activeDocument.title) : false
  const activeDocumentKindLabel = activeDocument ? getDocumentKindLabel(activeDocument.title) : ''
  const activeDocumentExtension = activeDocument ? getDocumentExtension(activeDocument.title) || '.md' : ''
  const groupDocuments = useMemo(() => groupNodes.filter((node): node is DocumentItem => node.type === 'document'), [groupNodes])
  const searchResults = useMemo(() => searchDocuments(documentNodes, null, deferredQuery), [documentNodes, deferredQuery])
  const referencedDocuments = useMemo(() => activeDocument ? findReferencedDocuments(activeDocument.markdown, groupDocuments).filter((doc) => doc.id !== activeDocument.id) : [], [activeDocument, groupDocuments])
  const imageReferences = useMemo(() => activeDocument && activeDocumentIsMarkdown ? extractMarkdownImageReferences(activeDocument.markdown) : [], [activeDocument, activeDocumentIsMarkdown])
  const shouldShowDocumentGraph = mode === 'graph' || !activeDocument
  const documentGraph = useMemo(
    () => shouldShowDocumentGraph ? buildDocumentGraph(documentGroups, documentNodes, { groupId: activeGroupId }) : EMPTY_DOCUMENT_GRAPH,
    [activeGroupId, documentGroups, documentNodes, shouldShowDocumentGraph],
  )
  const documentCountByGroupId = useMemo(() => {
    const counts = new Map<string, number>()

    for (const node of documentNodes) {
      if (node.type !== 'document') continue
      counts.set(node.groupId, (counts.get(node.groupId) ?? 0) + 1)
    }

    return counts
  }, [documentNodes])
  const totalDocumentCount = useMemo(() => Array.from(documentCountByGroupId.values()).reduce((total, count) => total + count, 0), [documentCountByGroupId])
  const groupNameById = useMemo(() => new Map(documentGroups.map((group) => [group.id, group.name])), [documentGroups])
  const childrenByParent = useMemo(() => {
    const nextChildrenByParent = new Map<string | null, DocumentNode[]>()

    for (const node of documentNodes) {
      const siblings = nextChildrenByParent.get(node.parentId)
      if (siblings) siblings.push(node)
      else nextChildrenByParent.set(node.parentId, [node])
    }

    for (const children of nextChildrenByParent.values()) {
      children.sort(sortDocumentNodes)
    }

    return nextChildrenByParent
  }, [documentNodes])
  const rootNodesByGroupId = useMemo(() => {
    const nextRootNodesByGroupId = new Map<string, DocumentNode[]>()

    for (const node of documentNodes) {
      if (node.parentId !== null) continue
      const roots = nextRootNodesByGroupId.get(node.groupId)
      if (roots) roots.push(node)
      else nextRootNodesByGroupId.set(node.groupId, [node])
    }

    for (const roots of nextRootNodesByGroupId.values()) {
      roots.sort(sortDocumentNodes)
    }

    return nextRootNodesByGroupId
  }, [documentNodes])
  const documentNodeIds = useMemo(() => new Set(documentNodes.map((node) => node.id)), [documentNodes])
  const documentFolderIds = useMemo(() => new Set(documentNodes.filter((node) => node.type === 'folder').map((node) => node.id)), [documentNodes])
  const activeDocumentAncestorKey = useMemo(
    () => activeDocument ? collectAncestorFolderIds(activeDocument.parentId, documentNodes).join('|') : '',
    [activeDocument?.id, activeDocument?.parentId, documentNodes],
  )

  useEffect(() => {
    if (!selectedDocumentGroupId && documentGroups[0]) setSelectedDocumentGroup(documentGroups[0].id)
  }, [documentGroups, selectedDocumentGroupId, setSelectedDocumentGroup])

  useEffect(() => {
    if (selectedFolderId && !documentFolderIds.has(selectedFolderId)) {
      setSelectedFolderId(null)
    }
  }, [documentFolderIds, selectedFolderId])

  useEffect(() => {
    if (editingNodeId && !documentNodeIds.has(editingNodeId)) {
      setEditingNodeId(null)
      setEditingTitle('')
    }
  }, [documentNodeIds, editingNodeId])

  useEffect(() => {
    if (editingGroupId && (!documentGroups.some((group) => group.id === editingGroupId) || editingGroupId !== activeGroupId)) {
      setEditingGroupId(null)
      setEditingGroupName('')
    }
  }, [activeGroupId, documentGroups, editingGroupId])

  useEffect(() => {
    if (!activeDocument) return
    setSelectedFolderId(activeDocument.parentId)
    if (!isMarkdownDocumentTitle(activeDocument.title) && mode === 'editor') {
      setMode('source')
    }

    const ancestorIds = activeDocumentAncestorKey.split('|').filter(Boolean)
    setExpanded((prev) => {
      const next = new Set(prev)
      next.add(activeDocument.groupId)
      ancestorIds.forEach((id) => next.add(id))
      return next
    })
  }, [activeDocument?.groupId, activeDocument?.id, activeDocument?.parentId, activeDocument?.title, activeDocumentAncestorKey, mode])

  const revealNode = (node: DocumentNode) => {
    const ancestorIds = collectAncestorFolderIds(node.parentId, documentNodes)
    ancestorIds.unshift(node.groupId)
    if (node.type === 'folder') ancestorIds.push(node.id)
    if (!ancestorIds.length) return

    setExpanded((prev) => {
      const next = new Set(prev)
      ancestorIds.forEach((id) => next.add(id))
      return next
    })
  }

  const openDocument = (documentId: string) => {
    const doc = documentNodes.find((node): node is DocumentItem => node.type === 'document' && node.id === documentId)
    if (!doc) return

    setSelectedDocumentGroup(doc.groupId)
    setSelectedDocument(doc.id)
    setSelectedFolderId(doc.parentId)
    revealNode(doc)
    setMode(isMarkdownDocumentTitle(doc.title) ? 'editor' : 'source')
  }

  const selectGroup = (group: DocumentGroup) => {
    setSelectedDocumentGroup(group.id)
    setSelectedDocument(null)
    setSelectedFolderId(null)
    setMode('graph')
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(group.id)) next.delete(group.id)
      else next.add(group.id)
      return next
    })
  }

  const focusFolder = (folderId: string) => {
    const folder = documentNodes.find((node): node is DocumentFolder => node.type === 'folder' && node.id === folderId)
    if (!folder) return

    setSelectedDocumentGroup(folder.groupId)
    setSelectedFolderId(folder.id)
    revealNode(folder)
  }

  const createGroup = () => {
    const group = createDocumentGroup(t('documents.newGroup', 'New Document Group'))
    addDocumentGroup(group)
    const doc = createDocument(group.id, null, t('documents.welcomeDoc', 'Welcome'))
    addDocument(doc)
    setEditingNodeId(null)
    setEditingTitle('')
    setEditingGroupId(null)
    setEditingGroupName('')
    setSelectedFolderId(null)
    setExpanded(new Set([group.id]))
    setQuery('')
    setMode('editor')
  }

  const createFolder = (parentId: string | null = selectedFolderId, targetGroupId = activeGroupId) => {
    if (!targetGroupId) return
    const now = Date.now()
    const folder: DocumentFolder = {
      id: createDocumentId('doc-folder'),
      groupId: targetGroupId,
      parentId,
      type: 'folder',
      title: t('documents.newFolder', 'New Folder'),
      createdAt: now,
      updatedAt: now,
    }
    addDocumentFolder(folder)
    setSelectedDocumentGroup(targetGroupId)
    const nextParentId = folder.parentId
    setExpanded((prev) => {
      const next = new Set(prev)
      next.add(targetGroupId)
      if (nextParentId) next.add(nextParentId)
      return next
    })
    setSelectedFolderId(folder.id)
    setEditingNodeId(folder.id)
    setEditingTitle(folder.title)
  }

  const createDoc = (parentId: string | null = selectedFolderId, targetGroupId = activeGroupId) => {
    if (!targetGroupId) return
    const doc = createDocument(targetGroupId, parentId, t('documents.untitled', 'Untitled Document'))
    addDocument(doc)
    setExpanded((prev) => {
      const next = new Set(prev)
      next.add(targetGroupId)
      if (parentId) next.add(parentId)
      return next
    })
    setSelectedFolderId(parentId)
    setMode('editor')
  }

  const startRenameNode = (node: DocumentNode) => {
    setEditingNodeId(node.id)
    setEditingTitle(node.title)

    if (node.type === 'folder') {
      focusFolder(node.id)
      return
    }

    openDocument(node.id)
  }

  const cancelRenameNode = () => {
    setEditingNodeId(null)
    setEditingTitle('')
  }

  const startRenameGroup = (group: DocumentGroup) => {
    cancelRenameNode()
    setSelectedDocumentGroup(group.id)
    setEditingGroupId(group.id)
    setEditingGroupName(group.name)
  }

  const cancelRenameGroup = () => {
    setEditingGroupId(null)
    setEditingGroupName('')
  }

  const commitRenameGroup = () => {
    if (!editingGroupId) return

    const nextName = editingGroupName.trim()
    if (!nextName) {
      cancelRenameGroup()
      return
    }

    updateDocumentGroup(editingGroupId, { name: nextName })
    cancelRenameGroup()
  }

  const commitRenameNode = () => {
    if (!editingNodeId) return

    const nextTitle = editingTitle.trim()
    if (!nextTitle) {
      cancelRenameNode()
      return
    }

    updateDocumentNode(editingNodeId, { title: nextTitle })
    cancelRenameNode()
  }

  const deleteGroup = async (group = activeGroup) => {
    if (!group) return
    const ok = await confirm({
      title: t('documents.deleteGroupTitle', 'Delete document group?'),
      body: t('documents.deleteGroupBody', '"{name}" and all nested documents will be removed. This cannot be undone.').replace('{name}', group.name),
      danger: true,
      confirmText: t('common.delete', 'Delete'),
    })
    if (!ok) return

    if (editingGroupId === group.id) cancelRenameGroup()
    removeDocumentGroup(group.id)
  }

  const deleteActiveDocument = async () => {
    if (!activeDocument) return
    const ok = await confirm({
      title: t('documents.deleteDocumentTitle', 'Delete document?'),
      body: t('documents.deleteDocumentBody', '"{name}" will be removed. This cannot be undone.').replace('{name}', activeDocument.title),
      danger: true,
      confirmText: t('common.delete', 'Delete'),
    })
    if (ok) removeDocumentNode(activeDocument.id)
  }

  const deleteNode = async (node: DocumentNode) => {
    const isFolder = node.type === 'folder'
    const ok = await confirm({
      title: isFolder ? t('documents.deleteFolderTitle', 'Delete folder?') : t('documents.deleteDocumentTitle', 'Delete document?'),
      body: isFolder
        ? t('documents.deleteFolderBody', '"{name}" and all nested documents will be removed. This cannot be undone.').replace('{name}', node.title)
        : t('documents.deleteDocumentBody', '"{name}" will be removed. This cannot be undone.').replace('{name}', node.title),
      danger: true,
      confirmText: t('common.delete', 'Delete'),
    })

    if (!ok) return

    if (editingNodeId === node.id) cancelRenameNode()
    removeDocumentNode(node.id)
  }

  const toggleExpanded = (id: string) => setExpanded((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <>
      <SidePanel
        title={t('documents.title', 'Documents')}
        width={panelWidth}
        action={
          <button type="button" onClick={createGroup} className="rounded-xl bg-accent/15 px-3 py-1.5 text-[11px] font-semibold text-accent hover:bg-accent/25">
            {t('documents.addGroup', '+ Group')}
          </button>
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-0 px-3 py-3">
          {/* Search */}
          <div className="mb-3 rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-3">
            <div className="relative">
              <IconifyIcon name="ui-search" size={14} color="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/55" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('documents.searchPlaceholder', 'Progressively search markdown…')}
                className="w-full rounded-2xl border border-border-subtle/55 bg-surface-2/80 py-2.5 pl-10 pr-3 text-[12px] text-text-primary placeholder-text-muted/55 focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted/70">
              <span>{searchResults.length} {t('common.results', 'results')}</span>
              <span>{totalDocumentCount} {t('documents.docs', 'docs')}</span>
            </div>
          </div>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {documentGroups.length === 0 ? (
              <button type="button" onClick={createGroup} className="w-full rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-8 text-center text-[12px] text-text-muted hover:border-accent/30 hover:text-accent">
                {t('documents.emptyGroups', 'Create your first document group')}
              </button>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
                {query.trim() ? (
                  <div className="space-y-2">
                    {searchResults.map(({ node, excerpt }) => (
                      <button key={node.id} type="button" onClick={() => openDocument(node.id)} className="w-full rounded-3xl border border-border-subtle/55 bg-surface-0/35 px-3 py-3 text-left hover:border-accent/25 hover:bg-accent/8">
                        <div className="truncate text-[12px] font-semibold text-text-primary">{node.title}</div>
                        <div className="mt-1 truncate text-[10px] text-text-muted">{groupNameById.get(node.groupId) ?? t('documents.groups', 'Groups')} / {buildDocumentPath(node, documentNodes)}</div>
                        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-text-secondary/80">{excerpt || t('documents.noExcerpt', 'No excerpt')}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {documentGroups.map((group) => (
                      <GroupTreeNode
                        key={group.id}
                        group={group}
                        children={rootNodesByGroupId.get(group.id) ?? EMPTY_DOCUMENT_CHILDREN}
                        documentCount={documentCountByGroupId.get(group.id) ?? 0}
                        isActive={activeGroupId === group.id}
                        isExpanded={expanded.has(group.id)}
                        editingGroupId={editingGroupId}
                        editingGroupName={editingGroupName}
                        childrenByParent={childrenByParent}
                        selectedDocumentId={selectedDocumentId}
                        selectedFolderId={selectedFolderId}
                        editingNodeId={editingNodeId}
                        editingTitle={editingTitle}
                        expanded={expanded}
                        onToggle={toggleExpanded}
                        onSelectGroup={selectGroup}
                        onStartRenameGroup={startRenameGroup}
                        onEditingGroupNameChange={setEditingGroupName}
                        onCommitRenameGroup={commitRenameGroup}
                        onCancelRenameGroup={cancelRenameGroup}
                        onSelectDocument={openDocument}
                        onSelectFolder={focusFolder}
                        onStartRenameNode={startRenameNode}
                        onEditingTitleChange={setEditingTitle}
                        onCommitRenameNode={commitRenameNode}
                        onCancelRenameNode={cancelRenameNode}
                        onCreateDocument={createDoc}
                        onCreateFolder={createFolder}
                        onDeleteNode={deleteNode}
                        onDeleteGroup={deleteGroup}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </SidePanel>
      <ResizeHandle width={panelWidth} onResize={setPanelWidth} />
      <section className="module-workspace flex min-w-0 flex-1 flex-col overflow-hidden">
        {activeDocument ? (
          <>
            <header className="flex min-h-0 shrink-0 items-center justify-between gap-4 border-b border-border-subtle/80 bg-surface-1/72 px-5 py-3">
              <div className="min-w-0 flex-1">
                <input
                  value={activeDocument.title}
                  onChange={(event) => updateDocumentNode(activeDocument.id, { title: event.target.value })}
                  aria-label={t('documents.documentTitle', 'Document title')}
                  className="w-full bg-transparent text-xl font-semibold tracking-[-0.02em] text-text-primary outline-none placeholder:text-text-muted"
                />
                <p className="mt-1 truncate text-[11px] text-text-muted" aria-label={`${activeGroup?.name ?? ''} / ${buildDocumentPath(activeDocument, documentNodes)}`}>
                  {activeGroup?.name} / {buildDocumentPath(activeDocument, documentNodes)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-xl border border-border-subtle/55 bg-surface-2/60 px-2.5 py-1 text-[10px] font-semibold text-text-muted">
                  {activeDocumentKindLabel}
                </span>
                <div className="flex rounded-2xl border border-border-subtle/55 bg-surface-0/45 p-1">
                  {(['editor', 'source', 'graph'] as const).map((value) => {
                    const isEditorUnavailable = value === 'editor' && !activeDocumentIsMarkdown
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMode(value)}
                        disabled={isEditorUnavailable}
                        title={isEditorUnavailable ? t('documents.markdownEditorOnly', 'Rich editor is available for Markdown files only.') : undefined}
                        className={`rounded-xl px-3 py-1.5 text-[11px] font-semibold ${mode === value ? 'bg-accent/15 text-accent' : isEditorUnavailable ? 'cursor-not-allowed text-text-muted/35' : 'text-text-muted hover:bg-surface-3/55 hover:text-text-primary'}`}
                      >
                        {value === 'editor' ? t('documents.editor', 'Editor') : value === 'source' ? t('documents.source', 'Source') : t('documents.graph', 'Graph')}
                      </button>
                    )
                  })}
                </div>
                <button type="button" onClick={deleteActiveDocument} aria-label={t('documents.deleteCurrentDocument', 'Delete current document')} className="rounded-2xl border border-danger/20 bg-danger/10 px-3 py-2 text-[11px] font-semibold text-danger/90 hover:bg-danger/15">
                  {t('common.delete', 'Delete')}
                </button>
              </div>
            </header>
            <div className={`grid min-h-0 flex-1 overflow-hidden ${mode === 'graph' ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_280px]'}`}>
              <div className="min-h-0 overflow-hidden p-5">
                {mode === 'editor' ? (
                  <div className="h-full overflow-y-auto rounded-4xl border border-border-subtle/70 bg-surface-0/62 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <DocumentTiptapEditor
                      document={activeDocument}
                      onUpdate={(markdown) => updateDocumentNode(activeDocument.id, { markdown })}
                    />
                  </div>
                ) : mode === 'source' ? (
                  <textarea
                    value={activeDocument.markdown}
                    onChange={(event) => updateDocumentNode(activeDocument.id, { markdown: event.target.value })}
                    spellCheck={activeDocumentIsMarkdown || activeDocumentExtension === '.txt'}
                    className="h-full w-full resize-none rounded-4xl border border-border-subtle/70 bg-surface-0/62 p-5 font-(--font-code) text-[13px] leading-7 text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none placeholder:text-text-muted focus:border-accent/30 focus:ring-4 focus:ring-accent/10"
                    placeholder={activeDocumentIsMarkdown ? t('documents.markdownPlaceholder', 'Write Markdown. Use [[Document Title]] to create references.') : t('documents.textPlaceholder', 'Edit this text or script file.')}
                  />
                ) : (
                  <DocumentGraphView graph={documentGraph} selectedDocumentId={activeDocument.id} onSelectDocument={openDocument} />
                )}
              </div>
              {mode !== 'graph' && (
                <aside className="min-h-0 overflow-y-auto border-l border-border-subtle/80 bg-surface-1/64 p-4">
                  <div className="rounded-3xl border border-border-subtle/60 bg-surface-0/42 p-4">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">{t('documents.fileInfo', 'File')}</h3>
                    <dl className="mt-3 space-y-2 text-[11px] text-text-secondary/80">
                      <div className="flex items-center justify-between gap-3">
                        <dt>{t('documents.fileType', 'Type')}</dt>
                        <dd className="truncate font-semibold text-text-primary">{activeDocumentKindLabel}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt>{t('documents.fileExtension', 'Extension')}</dt>
                        <dd className="font-(--font-code) text-text-primary">{activeDocumentExtension}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt>{t('documents.fileContent', 'Content')}</dt>
                        <dd className="font-(--font-code) text-text-primary">{activeDocument.markdown.length} chars</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="mt-4 rounded-3xl border border-border-subtle/60 bg-surface-0/42 p-4">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">{t('documents.references', 'References')}</h3>
                    <p className="mt-2 text-[11px] leading-relaxed text-text-secondary/75">{t('documents.referencesHint', 'Use [[Document Title]] or [Title](#doc:id) to connect notes in this group.')}</p>
                    <div className="mt-4 space-y-2">
                      {referencedDocuments.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-border-subtle/55 px-3 py-5 text-center text-[11px] text-text-muted">{t('documents.noReferences', 'No resolved references yet.')}</p>
                      ) : referencedDocuments.map((doc) => (
                        <button key={doc.id} type="button" onClick={() => openDocument(doc.id)} className="w-full rounded-2xl border border-border-subtle/55 bg-surface-2/55 px-3 py-2 text-left hover:border-accent/25 hover:bg-accent/8">
                          <span className="block truncate text-[12px] font-semibold text-text-primary">{doc.title}</span>
                          <span className="mt-1 block truncate text-[10px] text-text-muted">{buildDocumentPath(doc, documentNodes)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {activeDocumentIsMarkdown && (
                    <div className="mt-4 rounded-3xl border border-border-subtle/60 bg-surface-0/42 p-4">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">{t('documents.assets', 'Assets')}</h3>
                      <p className="mt-2 text-[11px] leading-relaxed text-text-secondary/75">{t('documents.assetsHint', 'Markdown image references are tracked here so linked local or remote images stay visible in the document context.')}</p>
                      <div className="mt-4 space-y-2">
                        {imageReferences.length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-border-subtle/55 px-3 py-5 text-center text-[11px] text-text-muted">{t('documents.noAssets', 'No image references yet.')}</p>
                        ) : imageReferences.map((asset) => (
                          <div key={asset.source} className="rounded-2xl border border-border-subtle/55 bg-surface-2/55 px-3 py-2">
                            <span className="block truncate font-(--font-code) text-[11px] text-text-primary">{asset.source}</span>
                            {(asset.alt || asset.title) && (
                              <span className="mt-1 block truncate text-[10px] text-text-muted">{asset.alt || asset.title}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-4 rounded-3xl border border-border-subtle/60 bg-surface-0/42 p-4">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">{t('documents.outline', 'Outline')}</h3>
                    <div className="mt-3 space-y-1">
                      {activeDocument.markdown.split('\n').filter((line) => /^#{1,3}\s+/.test(line)).slice(0, 12).map((line, index) => (
                        <div key={`${line}-${index}`} className="truncate rounded-xl bg-surface-2/50 px-2.5 py-1.5 text-[11px] text-text-secondary">
                          {line.replace(/^#{1,3}\s+/, '')}
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>
              )}
            </div>
          </>
        ) : activeGroup ? (
          /* Group-level knowledge graph — shown when a group is selected but no document is open */
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <header className="flex min-h-0 shrink-0 items-center gap-3 border-b border-border-subtle/80 bg-surface-1/72 px-5 py-3">
              <span className={`h-3 w-3 shrink-0 rounded-full ${getDocumentGroupColorClass(activeGroup.color)}`} />
              <h2 className="text-base font-semibold text-text-primary">{activeGroup.name}</h2>
              <span className="rounded-xl border border-border-subtle/55 bg-surface-2/60 px-2 py-0.5 text-[10px] text-text-muted">
                {t('documents.knowledgeGraph', 'Knowledge Graph')}
              </span>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={() => createDoc()} className="rounded-2xl bg-accent/15 px-3 py-1.5 text-[11px] font-semibold text-accent hover:bg-accent/25">
                  {t('documents.addDocument', '+ Document')}
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-hidden p-5">
              <DocumentGraphView graph={documentGraph} selectedDocumentId={null} onSelectDocument={openDocument} />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-lg rounded-4xl border border-border-subtle/70 bg-surface-1/70 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/15 bg-accent/10 text-accent">
                <IconifyIcon name="skill-code-review" size={26} color="currentColor" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary">{t('documents.emptyTitle', 'Build a document knowledge space')}</h2>
              <p className="mt-3 text-[13px] leading-relaxed text-text-secondary">{t('documents.emptyBody', 'Create document groups, nest folders freely, write Markdown, resolve references, and find notes progressively as you type.')}</p>
              <div className="mt-6 flex justify-center gap-3">
                <button type="button" onClick={createGroup} className="rounded-2xl bg-accent px-4 py-2 text-[12px] font-semibold text-white hover:bg-accent-hover">
                  {t('documents.addGroup', '+ Group')}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
