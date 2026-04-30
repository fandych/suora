import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { generateId } from '@/utils/helpers'
import { SkillIcon, IconifyIcon, getSkillIconName } from '@/components/icons/IconifyIcons'
import { IconPicker } from '@/components/icons/IconPicker'
import { useI18n } from '@/hooks/useI18n'
import type { Skill, SkillBundledResource, SkillFrontmatter, SkillSource, SkillExecutionContext } from '@/types'
import { MarkdownEditor } from './SkillEditorPanels'
import { confirm } from '@/services/confirmDialog'
import { toast } from '@/services/toast'
import {
  SKILL_TOP_LEVEL_FOLDERS,
  type SkillTopLevelFolder,
  classifySkillFileKind,
  getDefaultSkillFileName,
  getSkillFileIcon,
  isEditableSkillFile,
  isSafeSkillResourcePath,
  isSkillResourceExecutable,
  isSkillTopLevelFolder,
} from '@/utils/skillPaths'
import {
  settingsCheckboxClass,
  settingsInputClass,
  settingsLabelClass,
  settingsMonoInputClass,
  settingsRadioClass,
  settingsSelectClass,
  settingsTextAreaClass,
} from '@/components/settings/panelUi'

const CATEGORIES = [
  'Frontend', 'Backend', 'Design', 'AI', 'Development', 'Automation',
  'Testing', 'DevOps', 'Documentation', 'Utility', 'Media', 'Other',
]
const skillInputClass = `${settingsInputClass} bg-surface-2/75`
const skillSelectClass = `${settingsSelectClass} bg-surface-2/75`
const skillMonoInputClass = `${settingsMonoInputClass} bg-surface-2/75`
const skillTextAreaClass = `${settingsTextAreaClass} rounded-3xl bg-surface-2/75`
type SkillEditorTab = 'metadata' | 'content' | 'resources' | 'preview'

function makeDefaultSkill(): Skill {
  return {
    id: generateId('skill'),
    name: '',
    description: '',
    enabled: true,
    source: 'local' as SkillSource,
    content: '## Instructions\n\nDescribe what this skill does and how the agent should behave...\n',
    frontmatter: {
      name: '',
      description: '',
    },
    context: 'inline' as SkillExecutionContext,
  }
}

function EditorSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[28px] border border-border-subtle/55 bg-linear-to-br from-surface-1/96 via-surface-1/88 to-surface-2/70 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)] xl:p-6">
      <div className="mb-5">
        <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{eyebrow}</div>
        <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">{title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-text-secondary/80">{description}</p>
      </div>
      {children}
    </section>
  )
}

function SummaryStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-[22px] border border-border-subtle/50 bg-surface-0/60 px-4 py-3.5 shadow-sm">
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{label}</div>
      <div className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">{value}</div>
      <div className="mt-1 text-[11px] text-text-muted/70">{hint}</div>
    </div>
  )
}

function normalizeResourcePath(pathValue: string): string {
  return pathValue.replace(/\\/g, '/').replace(/^\/+/, '').split('/').filter(Boolean).join('/')
}

function joinSkillPath(skillRoot: string, resourcePath: string): string {
  return `${skillRoot.replace(/[\\/]+$/, '')}/${normalizeResourcePath(resourcePath)}`
}

function sortResources(resources: SkillBundledResource[]): SkillBundledResource[] {
  return [...resources].sort((a, b) => {
    const aDepth = a.path.split('/').length
    const bDepth = b.path.split('/').length
    if (aDepth !== bDepth) return aDepth - bDepth
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.path.localeCompare(b.path)
  })
}

function topFolderOf(pathValue: string): SkillTopLevelFolder | null {
  const top = normalizeResourcePath(pathValue).split('/')[0]
  return isSkillTopLevelFolder(top) ? top : null
}


const TOP_LEVEL_ICON: Record<SkillTopLevelFolder, string> = {
  scripts: 'lucide:terminal-square',
  references: 'lucide:book-open',
  assets: 'lucide:image',
  other: 'lucide:folder',
}

// ─── component ──────────────────────────────────────────────────────────

interface PendingCreate {
  parent: string // top-level folder, or sub-folder path
  kind: 'file' | 'folder'
  value: string
}

function ResourceTreePanel({
  skill,
  onChange,
}: {
  skill: Skill
  onChange: (patch: Partial<Skill>) => void
}) {
  const { t } = useI18n()
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [uploadFolder, setUploadFolder] = useState<SkillTopLevelFolder>('assets')
  const resources = useMemo(() => sortResources(skill.bundledResources ?? []), [skill.bundledResources])
  const [search, setSearch] = useState('')
  const [selectedPath, setSelectedPath] = useState<string>('')
  const [renamingPath, setRenamingPath] = useState('')
  const [renameValue, setRenameValue] = useState('')
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null)

  // Editor pane state — keyed by selectedPath
  const [editorContent, setEditorContent] = useState('')
  const [editorOriginal, setEditorOriginal] = useState('')
  const [editorError, setEditorError] = useState('')
  const [editorLoading, setEditorLoading] = useState(false)
  const [savingFile, setSavingFile] = useState(false)

  const dirty = editorContent !== editorOriginal && !!selectedPath

  // ── load file content when selection changes ─────────────────────────
  useEffect(() => {
    setEditorError('')
    if (!selectedPath || !skill.skillRoot) {
      setEditorContent('')
      setEditorOriginal('')
      return
    }
    const resource = resources.find((r) => r.path === selectedPath)
    if (!resource || resource.type !== 'file') {
      setEditorContent('')
      setEditorOriginal('')
      return
    }
    if (!isEditableSkillFile(resource.path)) {
      setEditorContent('')
      setEditorOriginal('')
      return
    }
    let cancelled = false
    setEditorLoading(true)
    window.electron
      .invoke('fs:readFile', joinSkillPath(skill.skillRoot, selectedPath))
      .then((result) => {
        if (cancelled) return
        if (typeof result === 'string') {
          setEditorContent(result)
          setEditorOriginal(result)
          setEditorError('')
        } else {
          setEditorContent('')
          setEditorOriginal('')
          setEditorError(
            (result as { error?: string })?.error ??
              t('skills.referencePreviewFailed', 'Unable to read file.'),
          )
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setEditorError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setEditorLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedPath, skill.skillRoot, resources, t])

  const removeResourceFromState = useCallback(
    (resourcePath: string) => {
      const normalized = normalizeResourcePath(resourcePath)
      onChange({
        bundledResources: (skill.bundledResources ?? []).filter(
          (resource) =>
            normalizeResourcePath(resource.path) !== normalized &&
            !normalizeResourcePath(resource.path).startsWith(`${normalized}/`),
        ),
        referenceFiles: (skill.referenceFiles ?? []).filter(
          (ref) => !normalizeResourcePath(ref.path).endsWith(normalized),
        ),
      })
      if (selectedPath === normalized) setSelectedPath('')
    },
    [onChange, skill.bundledResources, skill.referenceFiles, selectedPath],
  )

  const handleDelete = async (resource: SkillBundledResource) => {
    if (!skill.skillRoot) {
      removeResourceFromState(resource.path)
      return
    }
    const ok = await confirm({
      title: t('skills.deleteResourceTitle', 'Delete bundled resource?'),
      body: t('skills.deleteResourceBody', `"${resource.path}" will be removed from this skill.`),
      danger: true,
      confirmText: t('common.delete', 'Delete'),
    })
    if (!ok) return
    const channel = resource.type === 'directory' ? 'fs:deleteDir' : 'fs:deleteFile'
    await window.electron.invoke(channel, joinSkillPath(skill.skillRoot, resource.path))
    removeResourceFromState(resource.path)
  }

  const startRename = (resource: SkillBundledResource) => {
    setRenamingPath(resource.path)
    setRenameValue(resource.path)
  }

  const cancelRename = () => {
    setRenamingPath('')
    setRenameValue('')
  }

  const handleRename = async (resource: SkillBundledResource, nextPath: string) => {
    if (!nextPath || nextPath === resource.path) {
      cancelRename()
      return
    }
    if (!isSafeSkillResourcePath(nextPath)) {
      toast.error(
        t('skills.invalidResourcePath', 'Invalid resource path'),
        t(
          'skills.invalidResourcePathHint',
          `Paths must start with one of: ${SKILL_TOP_LEVEL_FOLDERS.join(', ')}/`,
        ),
      )
      return
    }
    const normalizedNext = normalizeResourcePath(nextPath)
    if (skill.skillRoot) {
      const parent = normalizedNext.split('/').slice(0, -1).join('/')
      if (parent) {
        const ensureResult = (await window.electron.invoke(
          'system:ensureDirectory',
          joinSkillPath(skill.skillRoot, parent),
        )) as { success?: boolean; error?: string }
        if (!ensureResult?.success) {
          throw new Error(
            ensureResult?.error ||
              t('skills.createResourceDirectoryFailed', 'Failed to create resource directory.'),
          )
        }
      }
      const moveResult = (await window.electron.invoke(
        'fs:moveFile',
        joinSkillPath(skill.skillRoot, resource.path),
        joinSkillPath(skill.skillRoot, normalizedNext),
      )) as { success?: boolean; error?: string }
      if (!moveResult?.success) {
        throw new Error(
          moveResult?.error || t('skills.renameResourceFailed', 'Failed to rename resource.'),
        )
      }
    }

    const oldPath = normalizeResourcePath(resource.path)
    onChange({
      bundledResources: (skill.bundledResources ?? []).map((entry) => {
        const entryPath = normalizeResourcePath(entry.path)
        if (entryPath === oldPath) return { ...entry, path: normalizedNext }
        if (entryPath.startsWith(`${oldPath}/`)) {
          return { ...entry, path: `${normalizedNext}/${entryPath.slice(oldPath.length + 1)}` }
        }
        return entry
      }),
      referenceFiles: (skill.referenceFiles ?? []).map((ref) => {
        const refPath = normalizeResourcePath(ref.path)
        return refPath.endsWith(oldPath)
          ? {
              ...ref,
              path: skill.skillRoot ? joinSkillPath(skill.skillRoot, normalizedNext) : normalizedNext,
              label: normalizedNext,
            }
          : ref
      }),
    })
    if (selectedPath === oldPath) setSelectedPath(normalizedNext)
    cancelRename()
  }

  const commitRename = (resource: SkillBundledResource) => {
    handleRename(resource, renameValue).catch((err: unknown) => {
      toast.error(
        t('skills.renameResourceFailed', 'Failed to rename resource'),
        err instanceof Error ? err.message : String(err),
      )
    })
  }

  // ── create file / folder ─────────────────────────────────────────────
  const beginCreate = (parent: string, kind: 'file' | 'folder') => {
    const defaultName = kind === 'file' ? getDefaultSkillFileName(parent) : 'new-folder'
    setPendingCreate({ parent, kind, value: defaultName })
  }

  const cancelCreate = () => setPendingCreate(null)

  const commitCreate = async () => {
    if (!pendingCreate) return
    const { parent, kind, value } = pendingCreate
    const trimmed = value.trim()
    if (!trimmed) {
      cancelCreate()
      return
    }
    if (trimmed.includes('/') || trimmed.includes('\\')) {
      toast.error(
        t('skills.invalidResourcePath', 'Invalid resource path'),
        t('skills.invalidResourceName', 'Name must not contain slashes.'),
      )
      return
    }
    const normalizedParent = normalizeResourcePath(parent)
    const newPath = normalizedParent ? `${normalizedParent}/${trimmed}` : trimmed
    if (!isSafeSkillResourcePath(newPath)) {
      toast.error(
        t('skills.invalidResourcePath', 'Invalid resource path'),
        t(
          'skills.topLevelFolderLocked',
          `Top-level folder must be one of: ${SKILL_TOP_LEVEL_FOLDERS.join(', ')}.`,
        ),
      )
      return
    }
    const exists = (skill.bundledResources ?? []).some(
      (r) => normalizeResourcePath(r.path) === newPath,
    )
    if (exists) {
      toast.error(
        t('skills.invalidResourcePath', 'Invalid resource path'),
        t('skills.resourceAlreadyExists', 'A resource at this path already exists.'),
      )
      return
    }
    if (!skill.skillRoot) {
      // Just add to in-memory list; real persistence happens once skill is saved.
      onChange({
        bundledResources: [
          ...(skill.bundledResources ?? []),
          kind === 'folder'
            ? { path: newPath, type: 'directory' }
            : { path: newPath, type: 'file', size: 0 },
        ],
      })
      cancelCreate()
      if (kind === 'file') setSelectedPath(newPath)
      return
    }
    try {
      if (kind === 'folder') {
        const result = (await window.electron.invoke(
          'system:ensureDirectory',
          joinSkillPath(skill.skillRoot, newPath),
        )) as { success?: boolean; error?: string }
        if (!result?.success) {
          throw new Error(
            result?.error ||
              t('skills.createResourceDirectoryFailed', 'Failed to create resource directory.'),
          )
        }
        onChange({
          bundledResources: [
            ...(skill.bundledResources ?? []),
            { path: newPath, type: 'directory' },
          ],
        })
      } else {
        if (normalizedParent) {
          const ensure = (await window.electron.invoke(
            'system:ensureDirectory',
            joinSkillPath(skill.skillRoot, normalizedParent),
          )) as { success?: boolean; error?: string }
          if (!ensure?.success) {
            throw new Error(
              ensure?.error ||
                t('skills.createResourceDirectoryFailed', 'Failed to create resource directory.'),
            )
          }
        }
        const write = (await window.electron.invoke(
          'fs:writeFile',
          joinSkillPath(skill.skillRoot, newPath),
          '',
        )) as { success?: boolean; error?: string }
        if (!write?.success) {
          throw new Error(write?.error || t('skills.createResourceFailed', 'Failed to create file.'))
        }
        onChange({
          bundledResources: [
            ...(skill.bundledResources ?? []),
            {
              path: newPath,
              type: 'file',
              size: 0,
              executable: isSkillResourceExecutable(newPath),
            },
          ],
        })
        setSelectedPath(newPath)
      }
      cancelCreate()
    } catch (err: unknown) {
      toast.error(
        t('skills.createResourceFailed', 'Failed to create resource'),
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  // ── upload ───────────────────────────────────────────────────────────
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !skill.skillRoot) return
    const resourcePath = normalizeResourcePath(`${uploadFolder}/${file.name}`)
    if (!isSafeSkillResourcePath(resourcePath)) {
      toast.error(
        t('skills.invalidResourcePath', 'Invalid resource path'),
        t('skills.invalidResourceName', 'Invalid file name.'),
      )
      return
    }
    await window.electron.invoke(
      'system:ensureDirectory',
      joinSkillPath(skill.skillRoot, uploadFolder),
    )
    await window.electron.invoke(
      'fs:writeFile',
      joinSkillPath(skill.skillRoot, resourcePath),
      await file.text(),
    )
    onChange({
      bundledResources: [
        ...(skill.bundledResources ?? []).filter(
          (resource) => normalizeResourcePath(resource.path) !== resourcePath,
        ),
        {
          path: resourcePath,
          type: 'file',
          size: file.size,
          executable: isSkillResourceExecutable(resourcePath),
        },
      ],
    })
  }

  // ── save edited file ────────────────────────────────────────────────
  const saveCurrentFile = async () => {
    if (!selectedPath || !skill.skillRoot || !dirty) return
    setSavingFile(true)
    try {
      const result = (await window.electron.invoke(
        'fs:writeFile',
        joinSkillPath(skill.skillRoot, selectedPath),
        editorContent,
      )) as { success?: boolean; error?: string }
      if (!result?.success) {
        throw new Error(result?.error || t('skills.saveFileFailed', 'Failed to save file.'))
      }
      const newSize = new TextEncoder().encode(editorContent).length
      onChange({
        bundledResources: (skill.bundledResources ?? []).map((entry) =>
          normalizeResourcePath(entry.path) === selectedPath ? { ...entry, size: newSize } : entry,
        ),
      })
      setEditorOriginal(editorContent)
      toast.success(t('skills.saveFile', 'File saved'))
    } catch (err: unknown) {
      toast.error(
        t('skills.saveFileFailed', 'Failed to save file'),
        err instanceof Error ? err.message : String(err),
      )
    } finally {
      setSavingFile(false)
    }
  }

  const handleSelect = async (resource: SkillBundledResource) => {
    if (resource.type !== 'file') return
    if (dirty && selectedPath !== resource.path) {
      const ok = await confirm({
        title: t('common.unsavedChanges', 'Unsaved changes'),
        body: t('skills.unsavedFileBody', 'You have unsaved changes in the current file. Discard them?'),
        danger: true,
        confirmText: t('common.discard', 'Discard'),
      })
      if (!ok) return
    }
    setSelectedPath(resource.path)
  }

  // ── tree grouping ───────────────────────────────────────────────────
  const filteredResources = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return resources
    return resources.filter((r) => r.path.toLowerCase().includes(q))
  }, [resources, search])

  const grouped = useMemo(() => {
    const out: Record<SkillTopLevelFolder, SkillBundledResource[]> = {
      scripts: [],
      references: [],
      assets: [],
      other: [],
    }
    for (const resource of filteredResources) {
      const top = topFolderOf(resource.path)
      if (top) out[top].push(resource)
      else out.other.push(resource)
    }
    return out
  }, [filteredResources])

  const selectedResource = selectedPath
    ? resources.find((r) => normalizeResourcePath(r.path) === selectedPath)
    : null

  // ── render ──────────────────────────────────────────────────────────
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.15fr)]">
      <EditorSection
        eyebrow={t('skills.resources', 'Resources')}
        title={t('skills.resourceTree', 'Bundled File Tree')}
        description={t(
          'skills.resourceTreeHint',
          'Browse and manage files packaged alongside SKILL.md.',
        )}
      >
        {/* search + upload */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('skills.searchResources', 'Search files…')}
            className="min-w-40 flex-1 rounded-2xl border border-border-subtle/55 bg-surface-2/75 px-3 py-1.5 text-[12px] text-text-primary outline-none placeholder:text-text-muted/60"
          />
          <select
            aria-label={t('skills.uploadFolder', 'Upload target folder')}
            value={uploadFolder}
            onChange={(event) => setUploadFolder(event.target.value as SkillTopLevelFolder)}
            disabled={!skill.skillRoot}
            className="rounded-2xl border border-border-subtle/55 bg-surface-2/75 px-2 py-1.5 text-[11px] text-text-secondary outline-none disabled:opacity-50"
          >
            {SKILL_TOP_LEVEL_FOLDERS.map((folder) => (
              <option key={folder} value={folder}>
                {folder}/
              </option>
            ))}
          </select>
          <input ref={uploadInputRef} type="file" onChange={handleUpload} className="hidden" />
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            disabled={!skill.skillRoot}
            className="rounded-2xl bg-accent/10 px-3 py-2 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/18 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <IconifyIcon name="lucide:upload" size={12} color="currentColor" />{' '}
            {t('skills.uploadResource', 'Upload')}
          </button>
        </div>

        {!skill.skillRoot && (
          <p className="mb-3 text-[11px] leading-4 text-text-muted">
            {t(
              'skills.saveBeforeResources',
              'Save the skill to disk before editing resources.',
            )}
          </p>
        )}

        <div className="space-y-3">
          {SKILL_TOP_LEVEL_FOLDERS.map((folder) => {
            const entries = grouped[folder]
            const isCreatingHere =
              pendingCreate && normalizeResourcePath(pendingCreate.parent) === folder
            return (
              <div
                key={folder}
                className="rounded-3xl border border-border-subtle/45 bg-surface-0/55 p-3"
              >
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted/60">
                  <IconifyIcon name={TOP_LEVEL_ICON[folder]} size={12} color="currentColor" />
                  {folder}/
                  <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[9px] tabular-nums">
                    {entries.length}
                  </span>
                  <div className="ml-auto flex gap-1">
                    <button
                      type="button"
                      onClick={() => beginCreate(folder, 'file')}
                      title={t('skills.newFile', 'New file')}
                      aria-label={t('skills.newFile', 'New file')}
                      className="rounded-xl px-1.5 py-1 text-text-muted hover:bg-surface-3 hover:text-accent"
                    >
                      <IconifyIcon name="lucide:file-plus" size={12} color="currentColor" />
                    </button>
                    <button
                      type="button"
                      onClick={() => beginCreate(folder, 'folder')}
                      title={t('skills.newFolder', 'New folder')}
                      aria-label={t('skills.newFolder', 'New folder')}
                      className="rounded-xl px-1.5 py-1 text-text-muted hover:bg-surface-3 hover:text-accent"
                    >
                      <IconifyIcon name="lucide:folder-plus" size={12} color="currentColor" />
                    </button>
                  </div>
                </div>

                {isCreatingHere && pendingCreate && (
                  <div className="mb-2 flex items-center gap-2 rounded-2xl bg-surface-2/60 px-3 py-2">
                    <IconifyIcon
                      name={pendingCreate.kind === 'folder' ? 'lucide:folder' : 'lucide:file'}
                      size={12}
                      color="currentColor"
                      className="text-text-muted"
                    />
                    <input
                      autoFocus
                      value={pendingCreate.value}
                      onChange={(e) =>
                        setPendingCreate({ ...pendingCreate, value: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          commitCreate()
                        }
                        if (e.key === 'Escape') cancelCreate()
                      }}
                      placeholder={t('skills.fileNamePlaceholder', 'name…')}
                      className="min-w-0 flex-1 rounded-xl border border-accent/20 bg-surface-0 px-2 py-1 font-mono text-[11px] text-text-primary outline-none"
                    />
                    <button
                      type="button"
                      onClick={commitCreate}
                      className="rounded-xl bg-accent/15 px-2 py-1 text-[10px] font-semibold text-accent hover:bg-accent/25"
                    >
                      {t('common.confirm', 'OK')}
                    </button>
                    <button
                      type="button"
                      onClick={cancelCreate}
                      className="rounded-xl px-2 py-1 text-[10px] text-text-muted hover:text-text-secondary"
                    >
                      {t('common.cancel', 'Cancel')}
                    </button>
                  </div>
                )}

                {entries.length === 0 ? (
                  !isCreatingHere && (
                    <div className="rounded-2xl border border-dashed border-border-subtle/45 px-3 py-2 text-[11px] text-text-muted">
                      {t('common.empty', 'Empty')}
                    </div>
                  )
                ) : (
                  <div className="space-y-1.5">
                    {entries.map((resource) => {
                      const isSelected = resource.path === selectedPath
                      return (
                        <div
                          key={resource.path}
                          className={`group flex items-center gap-2 rounded-2xl px-3 py-2 transition-colors ${
                            isSelected
                              ? 'bg-accent/12 ring-1 ring-accent/35'
                              : 'bg-surface-2/60 hover:bg-surface-2/85'
                          }`}
                        >
                          <IconifyIcon
                            name={
                              resource.type === 'directory'
                                ? 'lucide:folder'
                                : getSkillFileIcon(resource.path, resource.executable)
                            }
                            size={12}
                            color="currentColor"
                            className="text-text-muted"
                          />
                          {renamingPath === resource.path ? (
                            <input
                              value={renameValue}
                              onChange={(event) => setRenameValue(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  commitRename(resource)
                                }
                                if (event.key === 'Escape') cancelRename()
                              }}
                              onBlur={() => commitRename(resource)}
                              autoFocus
                              className="min-w-0 flex-1 rounded-xl border border-accent/20 bg-surface-0 px-2 py-1 font-mono text-[11px] text-text-primary outline-none"
                            />
                          ) : resource.type === 'file' ? (
                            <button
                              type="button"
                              onClick={() => handleSelect(resource)}
                              className={`min-w-0 flex-1 truncate text-left font-mono text-[11px] hover:text-accent ${
                                isSelected ? 'text-accent' : 'text-text-secondary'
                              }`}
                            >
                              {resource.path}
                            </button>
                          ) : (
                            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-text-secondary">
                              {resource.path}/
                            </span>
                          )}
                          {resource.size !== undefined && resource.type === 'file' && (
                            <span className="text-[9px] tabular-nums text-text-muted">
                              {resource.size}b
                            </span>
                          )}
                          {resource.warning && (
                            <IconifyIcon
                              name="lucide:triangle-alert"
                              size={12}
                              color="currentColor"
                              className="text-warning"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => startRename(resource)}
                            aria-label={t('common.rename', 'Rename')}
                            className="opacity-0 transition-opacity group-hover:opacity-100 text-text-muted hover:text-accent"
                          >
                            <IconifyIcon name="lucide:pencil" size={12} color="currentColor" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(resource)}
                            aria-label={t('common.delete', 'Delete')}
                            className="opacity-0 transition-opacity group-hover:opacity-100 text-text-muted hover:text-danger"
                          >
                            <IconifyIcon name="lucide:trash-2" size={12} color="currentColor" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </EditorSection>

      <EditorSection
        eyebrow={t('skills.resourceEditor', 'File')}
        title={selectedPath || t('skills.noFileSelected', 'No file selected')}
        description={
          selectedResource && selectedResource.type === 'file'
            ? `${classifySkillFileKind(selectedResource.path)} · ${selectedResource.size ?? 0}b`
            : t(
                'skills.fileEditorHint',
                'Pick a file from the tree to view or edit its contents.',
              )
        }
      >
        {!selectedPath ? (
          <div className="rounded-3xl border border-dashed border-border-subtle/55 bg-surface-0/45 p-8 text-center text-[12px] text-text-muted">
            {t('skills.noFileSelected', 'No file selected.')}
          </div>
        ) : editorError ? (
          <div className="rounded-3xl border border-danger/20 bg-danger/8 p-4 text-[12px] text-danger">
            {editorError}
          </div>
        ) : selectedResource && !isEditableSkillFile(selectedResource.path) ? (
          <div className="rounded-3xl border border-border-subtle/55 bg-surface-2/60 p-5 text-[12px] text-text-secondary">
            <div className="mb-2 font-semibold text-text-primary">
              {t('skills.cannotEditBinary', 'Binary file — preview only.')}
            </div>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[11px]">
              <dt className="text-text-muted">{t('skills.path', 'Path')}</dt>
              <dd className="font-mono">{selectedResource.path}</dd>
              <dt className="text-text-muted">{t('skills.size', 'Size')}</dt>
              <dd className="font-mono">{selectedResource.size ?? 0} bytes</dd>
              <dt className="text-text-muted">{t('skills.kind', 'Kind')}</dt>
              <dd>{classifySkillFileKind(selectedResource.path)}</dd>
            </dl>
          </div>
        ) : editorLoading ? (
          <div className="rounded-3xl border border-dashed border-border-subtle/55 bg-surface-0/45 p-8 text-center text-[12px] text-text-muted">
            {t('common.loading', 'Loading…')}
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              aria-label={t('skills.fileContent', 'File content')}
              value={editorContent}
              onChange={(event) => setEditorContent(event.target.value)}
              className="h-160 w-full resize-y rounded-3xl border border-border-subtle/55 bg-surface-2/75 p-4 font-mono text-xs leading-6 text-text-secondary outline-none focus:border-accent/50"
              spellCheck={false}
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={saveCurrentFile}
                disabled={!dirty || savingFile || !skill.skillRoot}
                className="rounded-2xl bg-accent px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45"
              >
                {savingFile
                  ? t('common.saving', 'Saving…')
                  : t('skills.saveFile', 'Save file')}
              </button>
              <span
                className={`text-[11px] ${
                  dirty ? 'text-warning' : 'text-text-muted'
                }`}
              >
                {dirty
                  ? t('skills.unsavedChanges', 'Unsaved changes')
                  : t('skills.noChanges', 'No changes')}
              </span>
            </div>
          </div>
        )}
      </EditorSection>
    </div>
  )
}
export function SkillEditor({ skill, onSave, onCancel }: {
  skill: Skill | null
  onSave: (skill: Skill) => void
  onCancel: () => void
}) {
  const [dirty, setDirty] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [activeTab, setActiveTab] = useState<SkillEditorTab>(skill?.bundledResources?.length ? 'resources' : 'metadata')
  const [form, setForm] = useState<Skill>(skill ?? makeDefaultSkill())
  const { t } = useI18n()
  const [showIconPicker, setShowIconPicker] = useState(false)

  const updateForm = (patch: Partial<Skill>) => {
    setDirty(true)
    setForm((f) => ({ ...f, ...patch }))
  }

  const updateFrontmatter = (patch: Partial<SkillFrontmatter>) => {
    setDirty(true)
    setForm((f) => ({
      ...f,
      frontmatter: { ...f.frontmatter, ...patch },
      // Sync top-level fields from frontmatter
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.author !== undefined ? { author: patch.author } : {}),
      ...(patch.version !== undefined ? { version: patch.version } : {}),
      ...(patch.whenToUse !== undefined ? { whenToUse: patch.whenToUse } : {}),
      ...(patch.context !== undefined ? { context: patch.context } : {}),
    }))
  }

  const handleCancel = async () => {
    if (dirty) {
      const ok = await confirm({
        title: t('common.unsavedChanges', 'Unsaved changes'),
        body: t('common.discardChanges', 'You have unsaved changes. Discard them?'),
        danger: true,
        confirmText: t('common.discard', 'Discard'),
      })
      if (!ok) return
    }
    onCancel()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const name = form.name || form.frontmatter.name
    if (!name.trim()) {
      setValidationError(t('skills.skillName', 'Skill name is required.'))
      setActiveTab('metadata')
      return
    }
    // Ensure name is synced
    const final: Skill = {
      ...form,
      name: name.trim(),
      frontmatter: { ...form.frontmatter, name: name.trim() },
    }
    setValidationError('')
    onSave(final)
    setDirty(false)
  }

  const tabCls = (tab: typeof activeTab) =>
    `text-xs px-3.5 py-2 rounded-xl font-semibold transition-all inline-flex items-center gap-1.5 ${
      activeTab === tab
        ? 'bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.14)]'
        : 'text-text-muted hover:text-text-secondary hover:bg-surface-3/60'
    }`

  const previewDocument = generatePreview(form)
  const displayName = (form.frontmatter.name || form.name).trim() || t('skills.untitledSkill', 'Untitled Skill')
  const displayDescription = (form.frontmatter.description || form.description).trim()
    || t('skills.heroFallback', 'A reusable prompt package that can be attached to agents and activated when its trigger conditions match.')
  const activeContext = form.frontmatter.context || form.context || 'inline'
  const allowedToolCount = (form.frontmatter.allowedTools || form.allowedTools || []).length
  const bundledResourceCount = form.bundledResources?.length ?? 0

  return (
    <form onSubmit={handleSubmit} className="module-canvas flex-1 overflow-y-auto">
      <div className="module-content mx-auto flex w-full max-w-432 flex-col gap-6 px-5 py-6 xl:px-8 xl:py-8">
        <section className="rounded-4xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/94 to-surface-2/72 p-6 shadow-[0_24px_70px_rgba(var(--t-accent-rgb),0.08)] xl:p-7">
          <div className="flex flex-col gap-6 2xl:flex-row 2xl:items-start 2xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <button
                type="button"
                onClick={() => setShowIconPicker(true)}
                title={t('skills.pickIcon', 'Pick icon')}
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[28px] border border-accent/15 bg-surface-0/78 shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.14)] transition-colors hover:border-accent/30"
              >
                <SkillIcon icon={form.icon || form.frontmatter.icon || getSkillIconName(form.id)} size={36} />
              </button>

              <div className="min-w-0 flex-1">
                <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">
                  {skill ? t('skills.editSkill', 'Edit Skill') : t('skills.addSkillTitle', 'New Skill')}
                </div>
                <h2 className="mt-2 text-[30px] font-semibold tracking-tight text-text-primary">{displayName}</h2>
                <p className="mt-2 max-w-3xl text-[14px] leading-7 text-text-secondary/82">{displayDescription}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-border-subtle/45 bg-surface-0/78 px-3 py-1 text-[11px] text-text-secondary">
                    {t(`skills.${form.source}`, form.source)}
                  </span>
                  <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] text-accent">
                    {t(`skills.context.${activeContext}`, activeContext)}
                  </span>
                  {form.frontmatter.category && (
                    <span className="rounded-full border border-border-subtle/45 bg-surface-0/78 px-3 py-1 text-[11px] text-text-secondary">
                      {form.frontmatter.category}
                    </span>
                  )}
                  {!form.enabled && (
                    <span className="rounded-full border border-border-subtle/45 bg-surface-0/78 px-3 py-1 text-[11px] text-text-muted">
                      {t('common.off', 'Off')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:w-168 2xl:grid-cols-5">
              <SummaryStat
                label={t('common.version', 'Version')}
                value={form.frontmatter.version || form.version || '1.0.0'}
                hint={t('skills.releaseMarker', 'release marker')}
              />
              <SummaryStat
                label={t('skills.content', 'Content')}
                value={`${(form.content || '').trim().length}`}
                hint={t('skills.characters', 'characters')}
              />
              <SummaryStat
                label={t('skills.allowedTools', 'Allowed Tools')}
                value={`${allowedToolCount}`}
                hint={t('skills.optionalHints', 'optional hints')}
              />
              <SummaryStat
                label={t('skills.resources', 'Resources')}
                value={`${bundledResourceCount}`}
                hint={t('skills.bundledFiles', 'bundled files')}
              />
              <SummaryStat
                label={t('skills.preview', 'Preview')}
                value={`${previewDocument.split('\n').length}`}
                hint={t('skills.lines', 'lines generated')}
              />
            </div>
          </div>

          {showIconPicker && (
            <IconPicker
              value={form.icon}
              onSelect={(iconName) => {
                updateFrontmatter({ icon: iconName })
                setShowIconPicker(false)
              }}
              onClose={() => setShowIconPicker(false)}
            />
          )}
        </section>

        <div className="rounded-[28px] border border-border-subtle/55 bg-surface-1/70 p-3 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={tabCls('metadata')} onClick={() => setActiveTab('metadata')}>
              <IconifyIcon name="lucide:settings-2" size={12} color="currentColor" /> {t('skills.metadata', 'Metadata')}
            </button>
            <button type="button" className={tabCls('content')} onClick={() => setActiveTab('content')}>
              <IconifyIcon name="lucide:file-text" size={12} color="currentColor" /> {t('skills.content', 'Content')}
            </button>
            <button type="button" className={tabCls('resources')} onClick={() => setActiveTab('resources')}>
              <IconifyIcon name="lucide:folder-tree" size={12} color="currentColor" /> {t('skills.resources', 'Resources')}
            </button>
            <button type="button" className={tabCls('preview')} onClick={() => setActiveTab('preview')}>
              <IconifyIcon name="lucide:eye" size={12} color="currentColor" /> {t('skills.preview', 'Preview')}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {activeTab === 'metadata' && (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.95fr)]">
              <EditorSection
                eyebrow={t('skills.metadata', 'Metadata')}
                title={t('skills.identityCard', 'Identity & Metadata')}
                description={t('skills.identityCardHint', 'Set the frontmatter fields that help humans and agents discover, describe, and categorize this skill.')}
              >
                <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
                  <div className="rounded-3xl border border-border-subtle/50 bg-surface-0/55 p-4">
                    <label className={settingsLabelClass}>{t('common.icon', 'Icon')}</label>
                    <button
                      type="button"
                      onClick={() => setShowIconPicker(true)}
                      title={t('skills.pickIcon', 'Pick icon')}
                      className="flex h-24 w-24 items-center justify-center rounded-[26px] border border-border-subtle/55 bg-surface-2/75 transition-colors hover:border-accent/30"
                    >
                      <SkillIcon icon={form.icon || form.frontmatter.icon || getSkillIconName(form.id)} size={34} />
                    </button>
                    <div className="mt-3 text-[11px] leading-relaxed text-text-muted">{form.icon || form.frontmatter.icon || t('skills.clickToChooseIcon', 'Click to choose')}</div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={settingsLabelClass}>{t('common.name', 'Name')}</label>
                      <input
                        type="text"
                        value={form.frontmatter.name || form.name}
                        onChange={(e) => updateFrontmatter({ name: e.target.value })}
                        placeholder={t('skills.nameFieldPlaceholder', 'e.g., frontend-design')}
                        className={skillInputClass}
                      />
                    </div>
                    <div>
                      <label className={settingsLabelClass}>{t('common.version', 'Version')}</label>
                      <input
                        type="text"
                        value={form.frontmatter.version || form.version || ''}
                        onChange={(e) => updateFrontmatter({ version: e.target.value })}
                        placeholder="1.0.0"
                        className={skillInputClass}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={settingsLabelClass}>{t('common.description', 'Description')}</label>
                      <input
                        type="text"
                        value={form.frontmatter.description || form.description}
                        onChange={(e) => updateFrontmatter({ description: e.target.value })}
                        placeholder={t('skills.descriptionFieldPlaceholder', 'What does this skill do?')}
                        className={skillInputClass}
                      />
                    </div>
                    <div>
                      <label className={settingsLabelClass}>{t('skills.category', 'Category')}</label>
                      <select
                        aria-label="Category"
                        value={form.frontmatter.category || form.category || ''}
                        onChange={(e) => updateFrontmatter({ category: e.target.value })}
                        className={skillSelectClass}
                      >
                        <option value="">{t('skills.selectCategory', 'Select category...')}</option>
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={settingsLabelClass}>{t('skills.author', 'Author')}</label>
                      <input
                        type="text"
                        value={form.frontmatter.author || form.author || ''}
                        onChange={(e) => updateFrontmatter({ author: e.target.value })}
                        placeholder={t('skills.authorPlaceholder', 'Your name or organization')}
                        className={skillInputClass}
                      />
                    </div>
                  </div>
                </div>
              </EditorSection>

              <div className="space-y-6">
                <EditorSection
                  eyebrow={t('skills.activation', 'Activation')}
                  title={t('skills.whenToUse', 'When to Use')}
                  description={t('skills.whenToUseHint', 'Helps the AI decide when to activate this skill automatically.')}
                >
                  <div className="space-y-4">
                    <textarea
                      value={form.frontmatter.whenToUse || form.whenToUse || ''}
                      onChange={(e) => updateFrontmatter({ whenToUse: e.target.value })}
                      placeholder={t('skills.whenToUsePlaceholder', 'Describe when this skill should be triggered...')}
                      rows={4}
                      className={`${skillTextAreaClass} resize-none`}
                    />

                    <div>
                      <label className={settingsLabelClass}>{t('skills.executionContext', 'Execution Context')}</label>
                      <div className="space-y-2">
                        {(['inline', 'fork'] as const).map((ctx) => (
                          <label key={ctx} className="flex items-start gap-3 rounded-2xl border border-border-subtle/45 bg-surface-0/60 p-3 cursor-pointer transition-colors hover:border-accent/16">
                            <input
                              type="radio"
                              name="context"
                              value={ctx}
                              checked={(form.frontmatter.context || form.context) === ctx}
                              onChange={() => updateFrontmatter({ context: ctx })}
                              className={`${settingsRadioClass} mt-1 shrink-0`}
                            />
                            <div>
                              <div className="text-sm font-medium text-text-secondary">{t(`skills.context.${ctx}`, ctx)}</div>
                              <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                                {ctx === 'inline'
                                  ? t('skills.contextInlineHint', 'Injected into system prompt directly')
                                  : t('skills.contextForkHint', 'Runs as a separate sub-agent conversation')}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <label className="flex items-center gap-3 rounded-2xl border border-border-subtle/45 bg-surface-0/60 p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.enabled}
                        onChange={(e) => updateForm({ enabled: e.target.checked })}
                        className={settingsCheckboxClass}
                      />
                      <span className="text-sm text-text-secondary">{t('common.enabled', 'Enabled')}</span>
                    </label>
                  </div>
                </EditorSection>

                <EditorSection
                  eyebrow={t('skills.toolHints', 'Tool Hints')}
                  title={t('skills.allowedTools', 'Allowed Tools')}
                  description={t('skills.allowedToolsHint', 'Comma-separated list of tool hints. If empty, the agent autonomously decides which tools to use.')}
                >
                  <input
                    type="text"
                    value={(form.frontmatter.allowedTools || form.allowedTools || []).join(', ')}
                    onChange={(e) => {
                      const tools = e.target.value.split(',').map((tool) => tool.trim()).filter(Boolean)
                      updateFrontmatter({ allowedTools: tools.length > 0 ? tools : undefined })
                      updateForm({ allowedTools: tools.length > 0 ? tools : undefined })
                    }}
                    placeholder={t('skills.allowedToolsPlaceholder', 'Leave empty = agent decides. Or: read_file, web_search, ...')}
                    className={skillMonoInputClass}
                  />
                  <p className="mt-2 text-[11px] leading-relaxed text-text-muted">{t('skills.optional', 'Optional')}: {t('skills.allowedToolsOptionalHint', 'Use this only when the skill needs a clearly bounded tool surface.')}</p>
                </EditorSection>
              </div>
            </div>
          )}

          {activeTab === 'content' && (
            <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
              <EditorSection
                eyebrow={t('skills.content', 'Content')}
                title={t('skills.authoringGuide', 'Authoring Guide')}
                description={t('skills.contentHelp', 'Write the skill\'s markdown instructions. This is the core content that gets injected into the agent\'s system prompt when the skill is active.')}
              >
                <div className="space-y-3 text-[12px] leading-6 text-text-secondary/82">
                  <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/60 p-3">{t('skills.authoringTip1', 'Lead with the exact behavior you want, then add constraints and examples only when they materially improve consistency.')}</div>
                  <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/60 p-3">{t('skills.authoringTip2', 'Use headings and short bullets so the resulting SKILL.md stays readable to both humans and models.')}</div>
                  <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/60 p-3">{t('skills.authoringTip3', 'Keep tool hints sparse. The best skills define judgment and process, not a giant list of commands.')}</div>
                  <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/60 p-3">{t('skills.authoringTip4', 'Folder skills can bundle scripts/, references/, and assets/ next to SKILL.md; mention when to read or run each resource.')}</div>
                </div>
              </EditorSection>

              <EditorSection
                eyebrow={t('skills.markdown', 'Markdown')}
                title={t('skills.instructionsBody', 'Instructions Body')}
                description={t('skills.instructionsBodyHint', 'This content becomes the actual markdown payload saved into SKILL.md.')}
              >
                <MarkdownEditor
                  value={form.content ?? ''}
                  onChange={(value) => updateForm({ content: value })}
                  placeholder={t('skills.contentPlaceholder', '## Instructions\n\nDescribe how the agent should behave when this skill is active...\n\n## Guidelines\n- Be specific about patterns and approaches\n- Include examples when helpful\n- Reference external docs if needed')}
                  rows={24}
                />
              </EditorSection>
            </div>
          )}

          {activeTab === 'resources' && (
            <ResourceTreePanel skill={form} onChange={updateForm} />
          )}

          {activeTab === 'preview' && (
            <EditorSection
              eyebrow={t('skills.preview', 'Preview')}
              title={t('skills.generatedSkillFile', 'Generated SKILL.md')}
              description={t('skills.previewHelp', 'Preview of the generated SKILL.md file:')}
            >
              <pre className="max-h-168 overflow-auto rounded-3xl border border-border-subtle/55 bg-surface-2/75 p-5 font-mono text-xs leading-6 text-text-secondary whitespace-pre-wrap">
                {previewDocument}
              </pre>
            </EditorSection>
          )}

          {validationError && (
            <p className="rounded-2xl border border-danger/20 bg-danger/8 px-4 py-3 text-[12px] text-danger">{validationError}</p>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(var(--t-accent-rgb),0.22)] transition-all hover:bg-accent-hover">
              {skill ? t('skills.saveChanges', 'Save Changes') : t('skills.addSkillTitle', 'Create Skill')}
            </button>
            <button type="button" onClick={handleCancel} className="rounded-2xl bg-surface-3 px-5 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-4">
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

function generatePreview(skill: Skill): string {
  const fm = skill.frontmatter
  const lines: string[] = ['---']
  if (fm.name || skill.name) lines.push(`name: ${fm.name || skill.name}`)
  if (fm.description || skill.description) lines.push(`description: ${fm.description || skill.description}`)
  if (fm.whenToUse || skill.whenToUse) lines.push(`whenToUse: ${fm.whenToUse || skill.whenToUse}`)
  if (fm.version || skill.version) lines.push(`version: ${fm.version || skill.version}`)
  if (fm.author || skill.author) lines.push(`author: ${fm.author || skill.author}`)
  if (fm.icon || skill.icon) lines.push(`icon: ${fm.icon || skill.icon}`)
  if (fm.category || skill.category) lines.push(`category: ${fm.category || skill.category}`)
  if (fm.context || skill.context) lines.push(`context: ${fm.context || skill.context}`)
  if (fm.allowedTools && fm.allowedTools.length > 0) {
    lines.push(`allowedTools: [${fm.allowedTools.join(', ')}]`)
  }
  lines.push('---')
  lines.push('')
  lines.push(skill.content || '')
  return lines.join('\n')
}
