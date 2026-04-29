import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { useAppStore } from '@/store/appStore'
import { SidePanel } from '@/components/layout/SidePanel'
import { ResizeHandle } from '@/components/layout/ResizeHandle'
import { useResizablePanel } from '@/hooks/useResizablePanel'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { DocumentGraphView } from '@/components/documents/DocumentGraphView'
import { confirm } from '@/services/confirmDialog'
import { createDocument, createDocumentGroup, createDocumentId, findReferencedDocuments, searchDocuments } from '@/services/documents'
import { buildDocumentGraph, buildDocumentPath } from '@/services/documentGraph'
import type { DocumentFolder, DocumentItem, DocumentNode } from '@/types'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function inlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[\[([^\]\n]+)\]\]/g, '<a href="#doc:$1">$1</a>')
    .replace(/\[([^\]\n]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
}

function markdownToTiptapHtml(markdown: string) {
  const lines = markdown.split('\n')
  const html: string[] = []
  let list: 'ul' | 'ol' | null = null
  let inCode = false
  let code: string[] = []

  const closeList = () => {
    if (list) {
      html.push(`</${list}>`)
      list = null
    }
  }

  lines.forEach((line) => {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
        code = []
        inCode = false
      } else {
        closeList()
        inCode = true
      }
      return
    }

    if (inCode) {
      code.push(line)
      return
    }

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
  if (inCode) html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
  return html.join('\n') || '<p></p>'
}

function DocumentPreview({ markdown }: { markdown: string }) {
  const html = useMemo(() => markdownToTiptapHtml(markdown), [markdown])
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Markdown preview renders here…' }),
      Link.configure({ openOnClick: false }),
    ],
    content: html,
    editable: false,
    editorProps: {
      attributes: {
        class: 'document-prose min-h-full focus:outline-none',
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.commands.setContent(html, { emitUpdate: false })
  }, [editor, html])

  return <EditorContent editor={editor} className="document-tiptap-preview h-full" />
}

function TreeNode({
  node,
  nodes,
  level,
  selectedDocumentId,
  selectedFolderId,
  expanded,
  onToggle,
  onSelectDocument,
  onSelectFolder,
}: {
  node: DocumentNode
  nodes: DocumentNode[]
  level: number
  selectedDocumentId: string | null
  selectedFolderId: string | null
  expanded: Set<string>
  onToggle: (id: string) => void
  onSelectDocument: (id: string) => void
  onSelectFolder: (id: string) => void
}) {
  const children = nodes
    .filter((child) => child.parentId === node.id)
    .sort((a, b) => (a.type === b.type ? a.title.localeCompare(b.title) : a.type === 'folder' ? -1 : 1))
  const isExpanded = expanded.has(node.id)
  const isActive = node.type === 'document' ? selectedDocumentId === node.id : selectedFolderId === node.id

  return (
    <div>
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
        className={`group flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-[12px] transition-all ${isActive ? 'bg-accent/12 text-accent shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.16)]' : 'text-text-secondary hover:bg-surface-3/55 hover:text-text-primary'}`}
        style={{ paddingLeft: `${12 + level * 14}px` }}
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
        <span className="min-w-0 flex-1 truncate font-medium">{node.title}</span>
      </button>
      {node.type === 'folder' && isExpanded && children.length > 0 && (
        <div className="mt-1 space-y-1">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              nodes={nodes}
              level={level + 1}
              selectedDocumentId={selectedDocumentId}
              selectedFolderId={selectedFolderId}
              expanded={expanded}
              onToggle={onToggle}
              onSelectDocument={onSelectDocument}
              onSelectFolder={onSelectFolder}
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
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [mode, setMode] = useState<'markdown' | 'preview' | 'graph'>('markdown')
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
  const groupNodes = useMemo(() => documentNodes.filter((node) => activeGroup && node.groupId === activeGroup.id), [documentNodes, activeGroup])
  const activeDocument = documentNodes.find((node): node is DocumentItem => node.type === 'document' && node.id === selectedDocumentId) ?? null
  const groupDocuments = useMemo(() => groupNodes.filter((node): node is DocumentItem => node.type === 'document'), [groupNodes])
  const searchResults = useMemo(() => searchDocuments(documentNodes, activeGroup?.id ?? null, deferredQuery), [documentNodes, activeGroup?.id, deferredQuery])
  const referencedDocuments = useMemo(() => activeDocument ? findReferencedDocuments(activeDocument.markdown, groupDocuments).filter((doc) => doc.id !== activeDocument.id) : [], [activeDocument, groupDocuments])
  const documentGraph = useMemo(() => buildDocumentGraph(documentGroups, documentNodes, { groupId: activeGroup?.id ?? null }), [documentGroups, documentNodes, activeGroup?.id])

  useEffect(() => {
    if (!selectedDocumentGroupId && documentGroups[0]) setSelectedDocumentGroup(documentGroups[0].id)
  }, [documentGroups, selectedDocumentGroupId, setSelectedDocumentGroup])

  const createGroup = () => {
    const group = createDocumentGroup(t('documents.newGroup', 'New Document Group'))
    addDocumentGroup(group)
    const doc = createDocument(group.id, null, t('documents.welcomeDoc', 'Welcome'))
    addDocument(doc)
  }

  const createFolder = () => {
    if (!activeGroup) return
    const now = Date.now()
    const folder: DocumentFolder = {
      id: createDocumentId('doc-folder'),
      groupId: activeGroup.id,
      parentId: selectedFolderId,
      type: 'folder',
      title: t('documents.newFolder', 'New Folder'),
      createdAt: now,
      updatedAt: now,
    }
    addDocumentFolder(folder)
    if (folder.parentId) setExpanded((prev) => new Set(prev).add(folder.parentId))
    setSelectedFolderId(folder.id)
  }

  const createDoc = () => {
    if (!activeGroup) return
    const doc = createDocument(activeGroup.id, selectedFolderId, t('documents.untitled', 'Untitled Document'))
    addDocument(doc)
    if (selectedFolderId) setExpanded((prev) => new Set(prev).add(selectedFolderId))
    setMode('markdown')
  }

  const deleteGroup = async () => {
    if (!activeGroup) return
    const ok = await confirm({
      title: t('documents.deleteGroupTitle', 'Delete document group?'),
      body: t('documents.deleteGroupBody', `"${activeGroup.name}" and all nested documents will be removed. This cannot be undone.`),
      danger: true,
      confirmText: t('common.delete', 'Delete'),
    })
    if (ok) removeDocumentGroup(activeGroup.id)
  }

  const deleteActiveDocument = async () => {
    if (!activeDocument) return
    const ok = await confirm({
      title: t('documents.deleteDocumentTitle', 'Delete document?'),
      body: t('documents.deleteDocumentBody', `"${activeDocument.title}" will be removed. This cannot be undone.`),
      danger: true,
      confirmText: t('common.delete', 'Delete'),
    })
    if (ok) removeDocumentNode(activeDocument.id)
  }

  const rootNodes = groupNodes
    .filter((node) => node.parentId === null)
    .sort((a, b) => (a.type === b.type ? a.title.localeCompare(b.title) : a.type === 'folder' ? -1 : 1))

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
        <div className="space-y-4 px-3 py-3">
          <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-3">
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
              <span>{groupDocuments.length} {t('documents.docs', 'docs')}</span>
            </div>
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">{t('documents.groups', 'Groups')}</h3>
              {activeGroup && (
                <button type="button" onClick={deleteGroup} className="text-[10px] font-semibold text-danger/80 hover:text-danger">{t('common.delete', 'Delete')}</button>
              )}
            </div>
            {activeGroup && (
              <input
                value={activeGroup.name}
                onChange={(event) => updateDocumentGroup(activeGroup.id, { name: event.target.value })}
                className="mb-2 w-full rounded-2xl border border-border-subtle/55 bg-surface-0/45 px-3 py-2 text-[12px] font-semibold text-text-primary outline-none focus:border-accent/30 focus:ring-2 focus:ring-accent/10"
                aria-label={t('documents.groupName', 'Group name')}
              />
            )}
            <div className="space-y-2">
              {documentGroups.length === 0 ? (
                <button type="button" onClick={createGroup} className="w-full rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-8 text-center text-[12px] text-text-muted hover:border-accent/30 hover:text-accent">
                  {t('documents.emptyGroups', 'Create your first document group')}
                </button>
              ) : documentGroups.map((group) => (
                <button
                  type="button"
                  key={group.id}
                  onClick={() => setSelectedDocumentGroup(group.id)}
                  className={`flex w-full items-center gap-3 rounded-3xl border px-3.5 py-3 text-left transition-all ${activeGroup?.id === group.id ? 'border-accent/20 bg-accent/10 text-text-primary' : 'border-transparent bg-surface-1/20 text-text-secondary hover:border-border-subtle/60 hover:bg-surface-3/55'}`}
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{group.name}</span>
                  <span className="text-[10px] text-text-muted">{documentNodes.filter((node) => node.groupId === group.id && node.type === 'document').length}</span>
                </button>
              ))}
            </div>
          </section>

          {activeGroup && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={createDoc} className="flex-1 rounded-2xl bg-accent/15 px-3 py-2 text-[11px] font-semibold text-accent hover:bg-accent/25">{t('documents.newDoc', '+ Document')}</button>
                <button type="button" onClick={createFolder} className="flex-1 rounded-2xl border border-border-subtle/65 bg-surface-2/60 px-3 py-2 text-[11px] font-semibold text-text-secondary hover:text-text-primary">{t('documents.newFolderButton', '+ Folder')}</button>
              </div>

              {query.trim() ? (
                <div className="space-y-2">
                  {searchResults.map(({ node, excerpt }) => (
                    <button key={node.id} type="button" onClick={() => setSelectedDocument(node.id)} className="w-full rounded-3xl border border-border-subtle/55 bg-surface-0/35 px-3 py-3 text-left hover:border-accent/25 hover:bg-accent/8">
                      <div className="truncate text-[12px] font-semibold text-text-primary">{node.title}</div>
                      <div className="mt-1 truncate text-[10px] text-text-muted">{buildDocumentPath(node, documentNodes)}</div>
                      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-text-secondary/80">{excerpt || t('documents.noExcerpt', 'No excerpt')}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {rootNodes.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center text-[12px] leading-relaxed text-text-muted">
                      {t('documents.emptyTree', 'Create nested folders and markdown documents in this group.')}
                    </div>
                  ) : rootNodes.map((node) => (
                    <TreeNode
                      key={node.id}
                      node={node}
                      nodes={groupNodes}
                      level={0}
                      selectedDocumentId={selectedDocumentId}
                      selectedFolderId={selectedFolderId}
                      expanded={expanded}
                      onToggle={(id) => setExpanded((prev) => {
                        const next = new Set(prev)
                        if (next.has(id)) next.delete(id)
                        else next.add(id)
                        return next
                      })}
                      onSelectDocument={setSelectedDocument}
                      onSelectFolder={setSelectedFolderId}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
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
                  className="w-full bg-transparent text-xl font-semibold tracking-[-0.02em] text-text-primary outline-none placeholder:text-text-muted"
                />
                <p className="mt-1 truncate text-[11px] text-text-muted" aria-label={`${activeGroup?.name ?? ''} folder, ${buildDocumentPath(activeDocument, documentNodes)}`}>
                  {activeGroup?.name} / {buildDocumentPath(activeDocument, documentNodes)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-2xl border border-border-subtle/55 bg-surface-0/45 p-1">
                  {(['markdown', 'preview', 'graph'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMode(value)}
                      className={`rounded-xl px-3 py-1.5 text-[11px] font-semibold ${mode === value ? 'bg-accent/15 text-accent' : 'text-text-muted hover:bg-surface-3/55 hover:text-text-primary'}`}
                    >
                      {value === 'markdown' ? t('documents.markdown', 'Markdown') : value === 'preview' ? t('documents.tiptapPreview', 'Tiptap Preview') : t('documents.graph', 'Graph')}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={deleteActiveDocument} className="rounded-2xl border border-danger/20 bg-danger/10 px-3 py-2 text-[11px] font-semibold text-danger/90 hover:bg-danger/15">
                  {t('common.delete', 'Delete')}
                </button>
              </div>
            </header>
            <div className={`grid min-h-0 flex-1 overflow-hidden ${mode === 'graph' ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_280px]'}`}>
              <div className="min-h-0 overflow-hidden p-5">
                {mode === 'markdown' ? (
                  <textarea
                    value={activeDocument.markdown}
                    onChange={(event) => updateDocumentNode(activeDocument.id, { markdown: event.target.value })}
                    spellCheck
                    className="h-full w-full resize-none rounded-[2rem] border border-border-subtle/70 bg-surface-0/62 p-5 font-[var(--font-code)] text-[13px] leading-7 text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none placeholder:text-text-muted focus:border-accent/30 focus:ring-4 focus:ring-accent/10"
                    placeholder={t('documents.markdownPlaceholder', 'Write Markdown. Use [[Document Title]] to create references.')}
                  />
                ) : mode === 'preview' ? (
                  <div className="h-full overflow-y-auto rounded-[2rem] border border-border-subtle/70 bg-surface-0/62 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <DocumentPreview markdown={activeDocument.markdown} />
                  </div>
                ) : (
                  <DocumentGraphView graph={documentGraph} selectedDocumentId={activeDocument.id} onSelectDocument={setSelectedDocument} />
                )}
              </div>
              {mode !== 'graph' && <aside className="min-h-0 overflow-y-auto border-l border-border-subtle/80 bg-surface-1/64 p-4">
                <div className="rounded-3xl border border-border-subtle/60 bg-surface-0/42 p-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">{t('documents.references', 'Markdown References')}</h3>
                  <p className="mt-2 text-[11px] leading-relaxed text-text-secondary/75">{t('documents.referencesHint', 'Use [[Document Title]] or [Title](#doc:id) to connect notes in this group.')}</p>
                  <div className="mt-4 space-y-2">
                    {referencedDocuments.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-border-subtle/55 px-3 py-5 text-center text-[11px] text-text-muted">{t('documents.noReferences', 'No resolved references yet.')}</p>
                    ) : referencedDocuments.map((doc) => (
                      <button key={doc.id} type="button" onClick={() => setSelectedDocument(doc.id)} className="w-full rounded-2xl border border-border-subtle/55 bg-surface-2/55 px-3 py-2 text-left hover:border-accent/25 hover:bg-accent/8">
                        <span className="block truncate text-[12px] font-semibold text-text-primary">{doc.title}</span>
                        <span className="mt-1 block truncate text-[10px] text-text-muted">{buildDocumentPath(doc, documentNodes)}</span>
                      </button>
                    ))}
                  </div>
                </div>
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
              </aside>}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-lg rounded-[2rem] border border-border-subtle/70 bg-surface-1/70 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/15 bg-accent/10 text-accent">
                <IconifyIcon name="skill-code-review" size={26} color="currentColor" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary">{t('documents.emptyTitle', 'Build a document knowledge space')}</h2>
              <p className="mt-3 text-[13px] leading-relaxed text-text-secondary">{t('documents.emptyBody', 'Create document groups, nest folders freely, write Markdown, resolve references, and find notes progressively as you type.')}</p>
              <div className="mt-6 flex justify-center gap-3">
                <button type="button" onClick={documentGroups.length ? createDoc : createGroup} className="rounded-2xl bg-accent px-4 py-2 text-[12px] font-semibold text-white hover:bg-accent-hover">
                  {documentGroups.length ? t('documents.newDoc', '+ Document') : t('documents.addGroup', '+ Group')}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
