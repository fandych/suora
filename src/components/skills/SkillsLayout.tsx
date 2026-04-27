import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { SidePanel } from '@/components/layout/SidePanel'
import { SkillIcon, IconifyIcon, getSkillIconName, useSkillIconsReady } from '@/components/icons/IconifyIcons'
import { useI18n } from '@/hooks/useI18n'
import type { Skill, RegistrySkillEntry, SkillRegistrySource } from '@/types'
import { loadAllSkills, createBlankSkill, deleteSkillFromDisk, saveSkillToDisk, serializeSkillToMarkdown, parseSkillMarkdown } from '@/services/skillRegistry'
import { browseRegistrySkills, searchRegistrySkills, installSkillFromRegistry, uninstallSkill, getDefaultRegistrySources } from '@/services/skillMarketplace'
import { confirm } from '@/services/confirmDialog'
import { toast } from '@/services/toast'
import { ResizeHandle } from '@/components/layout/ResizeHandle'
import { useResizablePanel } from '@/hooks/useResizablePanel'
import { SkillEditor } from './SkillEditor'
import { settingsInputClass, settingsSoftButtonClass } from '@/components/settings/panelUi'

type ViewMode = 'installed' | 'browse' | 'sources'

const SKILL_VIEW_MODES = new Set<ViewMode>(['installed', 'browse', 'sources'])

const ALL_CATEGORY = 'All'

export function SkillsLayout() {
  const [panelWidth, setPanelWidth] = useResizablePanel('skills', 280)
  const navigate = useNavigate()
  const { view } = useParams<{ view: string }>()
  const { skills, addSkill, updateSkill, removeSkill, workspacePath, marketplace, setMarketplace } = useAppStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const viewMode: ViewMode = view && SKILL_VIEW_MODES.has(view as ViewMode) ? view as ViewMode : 'installed'
  const [registrySkills, setRegistrySkills] = useState<RegistrySkillEntry[]>([])
  const [registryLoading, setRegistryLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { t } = useI18n()
  useSkillIconsReady()

  useEffect(() => {
    if (!view || SKILL_VIEW_MODES.has(view as ViewMode)) return
    navigate('/skills/installed', { replace: true })
  }, [navigate, view])

  const defaultRegistrySources = useMemo(() => getDefaultRegistrySources(), [t])
  const sourceLabels = useMemo<Record<string, string>>(() => ({
    local: t('skills.local', 'Local'),
    project: t('skills.project', 'Project'),
    user: t('skills.user', 'User'),
    registry: t('skills.registry', 'Registry'),
  }), [t])

  // Registry sources (merged: built-in defaults + user-added)
  const allSources = useMemo<SkillRegistrySource[]>(() => {
    const userSources = marketplace?.registrySources ?? []
    const defaultIds = new Set(defaultRegistrySources.map((s) => s.id))
    return [
      ...defaultRegistrySources,
      ...userSources.filter((s) => !defaultIds.has(s.id)),
    ]
  }, [defaultRegistrySources, marketplace?.registrySources])

  const editingSkill = editingId ? skills.find((s) => s.id === editingId) ?? null : null

  // Load skills from disk on mount
  useEffect(() => {
    if (!workspacePath) return
    loadAllSkills(workspacePath).then((incoming) => {
      const storeIds = new Set(useAppStore.getState().skills.map((s) => s.id))
      for (const skill of incoming) {
        if (!storeIds.has(skill.id)) addSkill(skill)
      }
    })
  }, [workspacePath, addSkill])

  // Fetch registry skills when switching to browse
  const fetchRegistry = useCallback(async () => {
    setRegistryLoading(true)
    try {
      const installedNames = new Set(skills.map((s) => s.name))
      const entries = await browseRegistrySkills(allSources, installedNames)
      setRegistrySkills(entries)
    } finally {
      setRegistryLoading(false)
    }
  }, [allSources, skills])

  useEffect(() => {
    if (viewMode === 'browse') fetchRegistry()
  }, [viewMode, fetchRegistry])

  // Filtered / searched lists
  const categories = useMemo(() => {
    const unique = new Set(registrySkills.map((s) => s.category || 'Other'))
    return [ALL_CATEGORY, ...Array.from(unique).sort()]
  }, [registrySkills])

  const filteredRegistry = useMemo(() => {
    let list = registrySkills
    if (selectedCategory !== ALL_CATEGORY) {
      list = list.filter((s) => (s.category || 'Other') === selectedCategory)
    }
    if (search.trim()) {
      list = searchRegistrySkills(list, search)
    }
    return list.sort((a, b) => b.downloads - a.downloads)
  }, [registrySkills, selectedCategory, search])

  const filteredInstalled = useMemo(() => {
    const kw = search.trim().toLowerCase()
    if (!kw) return skills
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(kw) ||
        s.description.toLowerCase().includes(kw),
    )
  }, [skills, search])
  const enabledSkillsCount = skills.filter((skill) => skill.enabled).length
  const localSkillsCount = skills.filter((skill) => skill.source !== 'registry').length
  const enabledSourcesCount = allSources.filter((source) => source.enabled).length

  // ─── Handlers ──────────────────────────────────────────────────

  const handleCreateSkill = () => {
    const newSkill = createBlankSkill(t('skills.addSkillTitle', 'New Skill'))
    addSkill(newSkill)
    setEditingId(newSkill.id)
    setIsAdding(true)
  }

  const handleSave = async (skill: Skill) => {
    if (editingId) updateSkill(editingId, skill)
    else addSkill(skill)
    // Persist to disk for local/project/user skills
    if (skill.source !== 'registry' && skill.skillRoot) {
      await saveSkillToDisk(skill.skillRoot, skill)
    }
    setEditingId(skill.id)
    setIsAdding(false)
  }

  const handleDelete = async (id: string) => {
    const skill = skills.find((s) => s.id === id)
    if (!skill) return
    const ok = await confirm({
      title: t('skills.deleteTitle', 'Delete skill?'),
      body: t('skills.deleteBody', `"${skill.name}" will be permanently removed. This cannot be undone.`),
      danger: true,
      confirmText: t('common.delete', 'Delete'),
    })
    if (!ok) return
    if (skill.filePath) {
      await deleteSkillFromDisk(skill.filePath)
    }
    removeSkill(id)
    if (editingId === id) setEditingId(null)
  }

  const handleToggleEnabled = (id: string) => {
    const skill = skills.find((s) => s.id === id)
    if (skill) updateSkill(id, { enabled: !skill.enabled })
  }

  const handleExportMarkdown = (skill: Skill) => {
    const md = serializeSkillToMarkdown(skill)
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${skill.name.replace(/\s+/g, '-').toLowerCase()}-SKILL.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportMarkdown = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const raw = reader.result as string
      const parsed = parseSkillMarkdown(raw, file.name, 'local')
      if (parsed) {
        addSkill(parsed)
        setEditingId(parsed.id)
        setIsAdding(false)
      } else {
        toast.error(t('skills.parseFailed', 'Failed to parse SKILL.md'), t('skills.parseFailedDetail', 'Make sure the file has YAML frontmatter.'))
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleInstallFromRegistry = async (entry: RegistrySkillEntry) => {
    const targetDir = workspacePath
      ? `${workspacePath}/.suora/skills`
      : undefined
    if (!targetDir) {
      toast.warning(t('skills.workspaceRequired', 'Please set a workspace path first.'))
      return
    }
    try {
      const installed = await installSkillFromRegistry(entry, targetDir)
      if (installed) {
        addSkill(installed)
        setRegistrySkills((prev) =>
          prev.map((s) => (s.id === entry.id ? { ...s, installed: true } : s)),
        )
      }
    } catch (err) {
      toast.error(
        t('skills.installFailed', 'Failed to install skill'),
        err instanceof Error ? err.message : 'Unknown error',
      )
    }
  }

  const handleUninstallFromRegistry = async (skillId: string) => {
    const skill = skills.find((s) => s.id === skillId)
    if (!skill) return
    const ok = await confirm({
      title: t('skills.uninstallTitle', 'Uninstall skill?'),
      body: t(
        'skills.uninstallBody',
        `"${skill.name}" and its files will be removed from this workspace. You can reinstall it later from the registry.`,
      ).replace('{name}', skill.name),
      danger: true,
      confirmText: t('skills.uninstall', 'Uninstall'),
    })
    if (!ok) return
    try {
      await uninstallSkill(skill)
      removeSkill(skillId)
      setRegistrySkills((prev) =>
        prev.map((s) => (s.name === skill.name ? { ...s, installed: false } : s)),
      )
    } catch {
      removeSkill(skillId)
    }
    if (editingId === skillId) setEditingId(null)
  }

  // ─── Source Management ─────────────────────────────────────────

  const [newSourceUrl, setNewSourceUrl] = useState('')
  const [newSourceName, setNewSourceName] = useState('')

  const handleAddSource = () => {
    const url = newSourceUrl.trim()
    const name = newSourceName.trim() || url
    if (!url) return
    const id = `custom-${Date.now()}`
    const newSource: SkillRegistrySource = {
      id,
      name,
      type: url.includes('github.com') ? 'github' : 'custom',
      url,
      enabled: true,
      description: `Custom source from ${url}`,
    }
    const existing = marketplace?.registrySources ?? []
    setMarketplace({ registrySources: [...existing, newSource] })
    setNewSourceUrl('')
    setNewSourceName('')
  }

  const handleRemoveSource = (sourceId: string) => {
    const src = allSources.find((s) => s.id === sourceId)
    if (src?.builtin) return
    const existing = marketplace?.registrySources ?? []
    setMarketplace({ registrySources: existing.filter((s) => s.id !== sourceId) })
  }

  const handleToggleSource = (sourceId: string) => {
    const src = allSources.find((s) => s.id === sourceId)
    if (!src) return
    if (src.builtin) {
      const existing = marketplace?.registrySources ?? []
      const override = existing.find((s) => s.id === sourceId)
      if (override) {
        setMarketplace({
          registrySources: existing.map((s) =>
            s.id === sourceId ? { ...s, enabled: !s.enabled } : s,
          ),
        })
      } else {
        setMarketplace({
          registrySources: [...existing, { ...src, enabled: !src.enabled }],
        })
      }
    } else {
      const existing = marketplace?.registrySources ?? []
      setMarketplace({
        registrySources: existing.map((s) =>
          s.id === sourceId ? { ...s, enabled: !s.enabled } : s,
        ),
      })
    }
  }

  // ─── Render ────────────────────────────────────────────────────

  return (
    <>
      <SidePanel
        title={t('skills.title', 'Skills')}
        width={panelWidth}
        action={
          <div className="flex items-center gap-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              title={t('skills.importSkill', 'Import SKILL.md')}
              className="text-[11px] px-2 py-1 rounded-lg text-text-muted hover:bg-surface-3/60 transition-colors"
            >
              <IconifyIcon name="lucide:upload" size={14} color="currentColor" />
            </button>
            <button
              onClick={handleCreateSkill}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium"
            >
              + {t('common.new', 'New')}
            </button>
          </div>
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown"
          onChange={handleImportMarkdown}
          className="hidden"
          aria-label="Import SKILL.md file"
        />

        {/* Tab toggle */}
        <div className="grid grid-cols-3 gap-1.5 px-3 pb-3 pt-1">
          {(['installed', 'browse', 'sources'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => navigate(`/skills/${mode}`)}
              className={`text-xs py-2 rounded-xl font-semibold transition-all flex items-center justify-center gap-1.5 ${
                viewMode === mode
                  ? 'bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.14)]'
                  : 'bg-surface-3 text-text-muted hover:text-text-secondary'
              }`}
            >
              <IconifyIcon
                name={mode === 'installed' ? 'lucide:package-check' : mode === 'browse' ? 'lucide:store' : 'lucide:link'}
                size={11}
                color="currentColor"
              />
              {mode === 'installed'
                ? t('skills.installed', 'Installed')
                : mode === 'browse'
                ? t('skills.browse', 'Browse')
                : t('skills.sources', 'Sources')}
              {mode === 'installed' && skills.length > 0 && (
                <span className="text-[9px] px-1.5 min-w-4.5 py-0.5 rounded-full bg-accent/20 text-accent tabular-nums">
                  {skills.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="px-3 pb-3">
          {viewMode === 'installed' ? (
            <div className="rounded-3xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/92 to-surface-2/70 p-4 shadow-[0_14px_40px_rgba(var(--t-accent-rgb),0.06)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/55">{t('skills.library', 'Library')}</div>
                  <div className="mt-1 text-[18px] font-semibold text-text-primary">{t('skills.installedSkills', 'Installed Skills')}</div>
                  <p className="mt-1 text-[12px] leading-relaxed text-text-secondary/80">{t('skills.installedSkillsHint', 'Keep your reusable prompt instructions organized, searchable, and ready to attach to agents.')}</p>
                </div>
                <div className="rounded-2xl border border-accent/15 bg-surface-0/70 px-3 py-2 text-right shadow-sm">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('common.total', 'Total')}</div>
                  <div className="text-xl font-semibold text-text-primary tabular-nums">{skills.length}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/45">{t('common.enabled', 'Enabled')}</div>
                  <div className="mt-1 text-[15px] font-semibold text-text-primary tabular-nums">{enabledSkillsCount}</div>
                </div>
                <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/45">{t('skills.local', 'Local')}</div>
                  <div className="mt-1 text-[15px] font-semibold text-text-primary tabular-nums">{localSkillsCount}</div>
                </div>
                <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/45">{t('skills.sources', 'Sources')}</div>
                  <div className="mt-1 text-[15px] font-semibold text-text-primary tabular-nums">{enabledSourcesCount}</div>
                </div>
              </div>
            </div>
          ) : viewMode === 'browse' ? (
            <div className="rounded-3xl border border-border-subtle/55 bg-linear-to-br from-surface-2/95 via-surface-1/85 to-surface-1/65 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.12)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/55">{t('skills.registry', 'Registry')}</div>
                  <div className="mt-1 text-[18px] font-semibold text-text-primary">{t('skills.browseSkills', 'Browse Skills')}</div>
                  <p className="mt-1 text-[12px] leading-relaxed text-text-secondary/80">{t('skills.browseSkillsHint', 'Install published SKILL.md packages and use them as a starting point for custom instructions.')}</p>
                </div>
                <div className="rounded-2xl border border-border-subtle/50 bg-surface-0/70 px-3 py-2 text-right shadow-sm">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('common.search', 'Search')}</div>
                  <div className="text-xl font-semibold text-text-primary tabular-nums">{filteredRegistry.length}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/45">{t('skills.catalog', 'Catalog')}</div>
                  <div className="mt-1 text-[15px] font-semibold text-text-primary tabular-nums">{registrySkills.length}</div>
                </div>
                <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/45">{t('skills.sources', 'Sources')}</div>
                  <div className="mt-1 text-[15px] font-semibold text-text-primary tabular-nums">{enabledSourcesCount}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-border-subtle/55 bg-linear-to-br from-surface-1/92 to-surface-2/65 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
              <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/55">{t('skills.sources', 'Sources')}</div>
              <div className="mt-1 text-[18px] font-semibold text-text-primary">{t('skills.registrySources', 'Registry Sources')}</div>
              <p className="mt-1 text-[12px] leading-relaxed text-text-secondary/80">{t('skills.registrySourcesHint', 'Switch built-in feeds on or off, and add your own GitHub or custom endpoints when you need a different catalog.')}</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/45">{t('common.total', 'Total')}</div>
                  <div className="mt-1 text-[15px] font-semibold text-text-primary tabular-nums">{allSources.length}</div>
                </div>
                <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/45">{t('common.enabled', 'Enabled')}</div>
                  <div className="mt-1 text-[15px] font-semibold text-text-primary tabular-nums">{enabledSourcesCount}</div>
                </div>
                <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/45">{t('skills.custom', 'Custom')}</div>
                  <div className="mt-1 text-[15px] font-semibold text-text-primary tabular-nums">{allSources.filter((source) => !source.builtin).length}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search (for installed + browse tabs) */}
        {viewMode !== 'sources' && (
          <div className="px-3 pb-3">
            <div className="relative">
              <IconifyIcon
                name="lucide:search"
                size={14}
                color="currentColor"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/55 pointer-events-none"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('skills.searchSkills', 'Search skills...')}
                className={`${settingsInputClass} py-2.5 pl-10 pr-3 text-[12px]`}
              />
            </div>
          </div>
        )}

        {/* ── Installed Tab ───────────────────────────────────── */}
        {viewMode === 'installed' && (
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
            {filteredInstalled.length === 0 && (
              <div className="rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-3 border border-border-subtle">
                  <IconifyIcon name="lucide:package" size={20} color="currentColor" className="text-text-muted" />
                </div>
                <p className="text-[12px] text-text-muted leading-relaxed">
                  {search.trim()
                    ? t('skills.noResults', 'No matching skills.')
                    : t('skills.noInstalled', 'No skills yet. Create or install one.')}
                </p>
                <button
                  onClick={() => navigate('/skills/browse')}
                  className="mt-2 text-[11px] text-accent hover:underline"
                >
                  {t('skills.browseSkills', 'Browse Skills')} →
                </button>
              </div>
            )}
            {filteredInstalled.map((skill) => {
              const isActive = editingId === skill.id
              return (
              <div
                key={skill.id}
                tabIndex={0}
                onClick={() => { setEditingId(skill.id); setIsAdding(false) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setEditingId(skill.id)
                    setIsAdding(false)
                  }
                }}
                className={`group rounded-[22px] border px-3.5 py-3.5 cursor-pointer transition-all duration-200 ${
                  isActive
                    ? 'border-accent/20 bg-accent/10 text-text-primary shadow-[0_14px_34px_rgba(var(--t-accent-rgb),0.07)]'
                    : 'border-transparent bg-surface-1/20 text-text-secondary hover:bg-surface-3/55 hover:border-border-subtle/60 hover:text-text-primary'
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 rounded-2xl bg-surface-2/80 items-center justify-center shrink-0 border border-border/40 shadow-sm">
                      <SkillIcon icon={skill.icon || skill.frontmatter?.icon || getSkillIconName(skill.id)} size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold truncate flex items-center gap-1.5 flex-wrap text-text-primary">
                        {skill.name}
                        {!skill.enabled && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface-3 text-text-muted">{t('common.off', 'OFF')}</span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-text-secondary/80 line-clamp-2">{skill.description}</p>
                      <div className="mt-3 text-[10px] text-text-muted flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded-full bg-surface-3/80 text-[9px]">
                          {sourceLabels[skill.source] || skill.source}
                        </span>
                        {skill.category && <span className="px-1.5 py-0.5 rounded-full bg-surface-3/80 text-[9px]">{skill.category}</span>}
                        {skill.frontmatter?.context && <span className="px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-[9px]">{t(`skills.context.${skill.frontmatter.context}`, skill.frontmatter.context)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 shrink-0 transition-opacity ${
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                  }`}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleEnabled(skill.id)
                      }}
                      aria-label={skill.enabled ? t('skills.disable', 'Disable') : t('skills.enable', 'Enable')}
                      title={skill.enabled ? t('skills.disable', 'Disable') : t('skills.enable', 'Enable')}
                      className={`flex h-8 w-8 items-center justify-center rounded-xl bg-surface-0/65 text-xs transition-colors ${
                        skill.enabled
                          ? 'text-success hover:text-text-muted'
                          : 'text-text-muted hover:text-success'
                      }`}
                      tabIndex={isActive ? 0 : -1}
                    >
                      <IconifyIcon
                        name={skill.enabled ? 'lucide:toggle-right' : 'lucide:toggle-left'}
                        size={14}
                        color="currentColor"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleExportMarkdown(skill) }}
                      aria-label={t('common.export', 'Export')}
                      title={t('skills.export', 'Export')}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-0/65 text-text-muted transition-colors hover:text-accent hover:bg-accent/8"
                      tabIndex={isActive ? 0 : -1}
                    >
                      <IconifyIcon name="lucide:download" size={12} color="currentColor" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(skill.id) }}
                      aria-label={t('common.delete', 'Delete')}
                      title={t('common.delete', 'Delete')}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-0/65 text-text-muted transition-colors hover:text-danger hover:bg-danger/8"
                      tabIndex={isActive ? 0 : -1}
                    >
                      <IconifyIcon name="lucide:trash-2" size={12} color="currentColor" />
                    </button>
                  </div>
                </div>
              </div>
            )})}
          </div>
        )}

        {/* ── Browse Tab (Registry / Marketplace) ─────────── */}
        {viewMode === 'browse' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Category pills */}
            <div className="px-3 py-1.5 flex gap-1.5 overflow-x-auto shrink-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-[10px] px-2 py-1 rounded-full whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-accent text-white'
                      : 'bg-surface-3 text-text-muted hover:text-text-secondary hover:bg-surface-3/80'
                  }`}
                >
                  {cat === ALL_CATEGORY ? t('common.all', 'All') : cat}
                </button>
              ))}
            </div>

            {/* Count + refresh */}
            <div className="flex items-center justify-between text-[10px] text-text-muted px-4 pb-2 shrink-0">
              <span>{filteredRegistry.length} {t('skills.found', 'skills')}</span>
              <button
                onClick={fetchRegistry}
                className="text-accent hover:underline"
                title={t('settings.refresh', 'Refresh')}
              >
                <IconifyIcon name="lucide:refresh-cw" size={10} color="currentColor" />
              </button>
            </div>

            {/* Skill cards */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
              {registryLoading && (
                <div className="flex items-center justify-center py-8 gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
                  <span className="text-xs text-text-muted">{t('common.loading', 'Loading...')}</span>
                </div>
              )}
              {!registryLoading && filteredRegistry.length === 0 && (
                <p className="text-xs text-text-muted text-center py-8">
                  {search.trim()
                    ? t('skills.noResults', 'No skills match your search.')
                    : t('skills.emptyRegistry', 'No skills found in registries.')}
                </p>
              )}
              {filteredRegistry.map((entry) => {
                const installed = skills.some((s) => s.name === entry.name)
                return (
                  <div
                    key={entry.id}
                    className="rounded-[22px] border border-border-subtle/60 p-3.5 bg-linear-to-br from-surface-1/92 to-surface-2/55 transition-all duration-200 hover:border-accent/18 hover:shadow-[0_10px_24px_rgba(var(--t-accent-rgb),0.05)] group"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-surface-2 flex items-center justify-center shrink-0 border border-border/40 shadow-sm">
                        <SkillIcon icon={entry.icon} size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-semibold text-text-primary truncate">{entry.name}</span>
                          <span className="text-[9px] text-text-muted shrink-0">v{entry.version}</span>
                        </div>
                        <div className="text-[10px] text-text-muted mt-0.5 truncate">{entry.author}</div>
                      </div>
                      {installed ? (
                        <button
                          onClick={() => {
                            const s = skills.find((sk) => sk.name === entry.name)
                            if (s) handleUninstallFromRegistry(s.id)
                          }}
                          className="text-[10px] px-2 py-1 rounded-lg bg-surface-3 text-text-muted hover:bg-danger/10 hover:text-danger font-medium shrink-0 transition-colors"
                        >
                          {t('common.remove', 'Remove')}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleInstallFromRegistry(entry)}
                          className="text-[10px] px-2.5 py-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 font-semibold shrink-0 transition-colors"
                        >
                          {t('common.install', 'Install')}
                        </button>
                      )}
                    </div>
                    <p className="mt-2.5 text-[12px] text-text-muted/82 line-clamp-2 leading-relaxed">{entry.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1">
                        <IconifyIcon name="lucide:download" size={10} color="currentColor" className="text-text-muted" />
                        <span className="text-[10px] text-text-muted tabular-nums">{entry.downloads.toLocaleString()}</span>
                      </div>
                      {entry.category && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-3 text-text-muted">{entry.category}</span>
                      )}
                      {entry.url && (
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[9px] text-accent hover:underline ml-auto"
                        >
                          {t('skills.viewOnMarketplace', 'View on skills.sh')}
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Sources Tab ─────────────────────────────────────── */}
        {viewMode === 'sources' && (
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
            <p className="text-[10px] text-text-muted px-1 pt-1">
              {t('skills.sourcesDesc', 'Manage skill registries. Add GitHub repos or custom URLs as skill sources.')}
            </p>

            {/* Existing sources */}
            <div className="space-y-1.5">
              {allSources.map((source) => (
                <div
                  key={source.id}
                  className="rounded-[22px] border border-border-subtle/60 p-3 bg-linear-to-br from-surface-1/92 to-surface-2/50 flex items-center gap-3"
                >
                  <div className="w-7 h-7 rounded-lg bg-surface-2 flex items-center justify-center shrink-0 border border-border/40">
                    <IconifyIcon name={source.icon || 'lucide:globe'} size={14} color="currentColor" className="text-text-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-text-primary truncate flex items-center gap-1.5">
                      {source.name}
                      {source.builtin && (
                        <span className="text-[8px] px-1 py-0 rounded bg-accent/10 text-accent">{t('skills.builtinSource', 'built-in')}</span>
                      )}
                    </div>
                    <div className="text-[9px] text-text-muted truncate">{source.url}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleSource(source.id)}
                      className={`p-0.5 rounded transition-colors ${
                        source.enabled ? 'text-success' : 'text-text-muted'
                      }`}
                      title={source.enabled ? t('skills.disable', 'Disable') : t('skills.enable', 'Enable')}
                    >
                      <IconifyIcon
                        name={source.enabled ? 'lucide:toggle-right' : 'lucide:toggle-left'}
                        size={16}
                        color="currentColor"
                      />
                    </button>
                    {!source.builtin && (
                      <button
                        onClick={() => handleRemoveSource(source.id)}
                        className="text-text-muted hover:text-danger p-0.5 rounded transition-colors"
                        title={t('common.remove', 'Remove')}
                      >
                        <IconifyIcon name="lucide:trash-2" size={12} color="currentColor" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add new source */}
            <div className="rounded-3xl border border-dashed border-border/80 p-4 space-y-2.5 bg-surface-0/30">
              <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                {t('skills.addSource', 'Add Source')}
              </div>
              <input
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                placeholder={t('skills.sourceName', 'Source name (optional)')}
                className={`${settingsInputClass} rounded-xl px-3 py-2 text-xs`}
              />
              <input
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                placeholder={t('skills.sourceUrl', 'GitHub repo URL or custom registry URL')}
                className={`${settingsInputClass} rounded-xl px-3 py-2 text-xs`}
              />
              <button
                onClick={handleAddSource}
                disabled={!newSourceUrl.trim()}
                className={`${settingsSoftButtonClass} w-full rounded-xl px-3 py-2 text-[11px]`}
              >
                + {t('skills.addSourceBtn', 'Add Registry Source')}
              </button>
            </div>
          </div>
        )}
      </SidePanel>
      <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={224} maxWidth={360} />

      {/* ── Right pane: Editor or Empty state ────────────────── */}
      {isAdding || editingId ? (
        <SkillEditor
          key={editingId ?? 'new'}
          skill={editingSkill}
          onSave={handleSave}
          onCancel={() => { setIsAdding(false); setEditingId(null) }}
        />
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-8 text-text-muted xl:px-10">
          <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center">
            <div className="w-full rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/94 via-surface-1/88 to-surface-2/72 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.16)] animate-fade-in xl:p-10">
              <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-2xl">
                  <div className="flex h-18 w-18 items-center justify-center rounded-[26px] border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.12)]">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                  </div>
                  <p className="mt-5 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('skills.promptBased', 'Prompt-Based Skills')}</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">{t('skills.promptBasedWorkspace', 'Skill Workspace')}</h2>
                  <p className="mt-3 max-w-xl text-[14px] leading-7 text-text-secondary/82">{t('skills.promptDesc', 'Skills are markdown instructions (SKILL.md) that enhance agent capabilities. No tool specification needed — agents decide which tools to use.')}</p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={() => navigate('/skills/browse')}
                      className="rounded-2xl bg-accent px-5 py-3 text-[13px] font-semibold text-white shadow-[0_10px_30px_rgba(var(--t-accent-rgb),0.22)] transition-all hover:bg-accent-hover"
                    >
                      {t('skills.browseSkills', 'Browse Skills')}
                    </button>
                    <button
                      onClick={handleCreateSkill}
                      className="rounded-2xl border border-border-subtle/60 bg-surface-0/60 px-5 py-3 text-[13px] font-semibold text-text-secondary transition-all hover:border-accent/20 hover:text-text-primary"
                    >
                      {t('skills.createSkill', 'Create Skill')}
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:w-[24rem] xl:grid-cols-1">
                  <div className="rounded-[22px] border border-border-subtle/55 bg-surface-0/60 p-4">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('common.total', 'Total')}</div>
                    <div className="mt-2 text-2xl font-semibold text-text-primary tabular-nums">{skills.length}</div>
                    <div className="mt-1 text-[12px] text-text-muted">{t('skills.installedSkills', 'installed skills')}</div>
                  </div>
                  <div className="rounded-[22px] border border-border-subtle/55 bg-surface-0/60 p-4">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('common.enabled', 'Enabled')}</div>
                    <div className="mt-2 text-2xl font-semibold text-text-primary tabular-nums">{enabledSkillsCount}</div>
                    <div className="mt-1 text-[12px] text-text-muted">{t('skills.readyToAttach', 'ready to attach')}</div>
                  </div>
                  <div className="rounded-[22px] border border-border-subtle/55 bg-surface-0/60 p-4">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('skills.sources', 'Sources')}</div>
                    <div className="mt-2 text-2xl font-semibold text-text-primary tabular-nums">{allSources.length}</div>
                    <div className="mt-1 text-[12px] text-text-muted">{t('skills.activeFeeds', 'available feeds')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

