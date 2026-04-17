import { useState } from 'react'
import { generateId } from '@/utils/helpers'
import { SkillIcon, IconifyIcon, getSkillIconName } from '@/components/icons/IconifyIcons'
import { IconPicker } from '@/components/icons/IconPicker'
import { useI18n } from '@/hooks/useI18n'
import type { Skill, SkillFrontmatter, SkillSource, SkillExecutionContext } from '@/types'
import { MarkdownEditor } from './SkillEditorPanels'
import { confirm } from '@/services/confirmDialog'

const CATEGORIES = [
  'Frontend', 'Backend', 'Design', 'AI', 'Development', 'Automation',
  'Testing', 'DevOps', 'Documentation', 'Utility', 'Media', 'Other',
]

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

export function SkillEditor({ skill, onSave, onCancel }: {
  skill: Skill | null
  onSave: (skill: Skill) => void
  onCancel: () => void
}) {
  const [dirty, setDirty] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [activeTab, setActiveTab] = useState<'metadata' | 'content' | 'preview'>('metadata')
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
      setValidationError('Skill name is required.')
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
    `text-xs px-3 py-1.5 rounded-lg font-medium transition-all inline-flex items-center gap-1.5 ${
      activeTab === tab
        ? 'bg-accent/15 text-accent'
        : 'text-text-muted hover:text-text-secondary hover:bg-surface-3/60'
    }`

  return (
    <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-8 pt-8 pb-4 shrink-0">
        <h2 className="text-lg font-semibold text-text-primary">
          {skill ? t('skills.editSkill', 'Edit Skill') : t('skills.addSkillTitle', 'New Skill')}
        </h2>
        <div className="flex items-center gap-2">
          {form.source && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-3 text-text-muted border border-border/40">
              {form.source}
            </span>
          )}
          {form.context && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
              {form.context}
            </span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-8 pb-4 shrink-0">
        <button type="button" className={tabCls('metadata')} onClick={() => setActiveTab('metadata')}>
          <IconifyIcon name="lucide:settings-2" size={12} color="currentColor" /> {t('skills.metadata', 'Metadata')}
        </button>
        <button type="button" className={tabCls('content')} onClick={() => setActiveTab('content')}>
          <IconifyIcon name="lucide:file-text" size={12} color="currentColor" /> {t('skills.content', 'Content')}
        </button>
        <button type="button" className={tabCls('preview')} onClick={() => setActiveTab('preview')}>
          <IconifyIcon name="lucide:eye" size={12} color="currentColor" /> {t('skills.preview', 'Preview')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {/* ── Metadata tab ──────────────────────────────────────── */}
        {activeTab === 'metadata' && (
          <div className="space-y-6">
            {/* Name + Description */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('common.name', 'Name')}</label>
                <input
                  type="text"
                  value={form.frontmatter.name || form.name}
                  onChange={(e) => updateFrontmatter({ name: e.target.value })}
                  placeholder="e.g., frontend-design"
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('common.description', 'Description')}</label>
                <input
                  type="text"
                  value={form.frontmatter.description || form.description}
                  onChange={(e) => updateFrontmatter({ description: e.target.value })}
                  placeholder="What does this skill do?"
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
                />
              </div>
            </div>

            {/* Icon, Category, Version */}
            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('common.icon', 'Icon')}</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowIconPicker(true)}
                    title="Pick icon"
                    className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center hover:border-accent/50 transition-colors"
                  >
                    <SkillIcon icon={form.icon || form.frontmatter.icon || getSkillIconName(form.id)} size={24} />
                  </button>
                  <div className="text-xs text-text-muted">
                    {form.icon || form.frontmatter.icon || 'Click to choose'}
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
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('skills.category', 'Category')}</label>
                <select
                  aria-label="Category"
                  value={form.frontmatter.category || form.category || ''}
                  onChange={(e) => updateFrontmatter({ category: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
                >
                  <option value="">Select category...</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('common.version', 'Version')}</label>
                <input
                  type="text"
                  value={form.frontmatter.version || form.version || ''}
                  onChange={(e) => updateFrontmatter({ version: e.target.value })}
                  placeholder="1.0.0"
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
                />
              </div>
            </div>

            {/* When to Use + Author */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                  {t('skills.whenToUse', 'When to Use')}
                </label>
                <textarea
                  value={form.frontmatter.whenToUse || form.whenToUse || ''}
                  onChange={(e) => updateFrontmatter({ whenToUse: e.target.value })}
                  placeholder="Describe when this skill should be triggered..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 resize-none text-sm"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  Helps the AI decide when to activate this skill automatically.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                  {t('skills.author', 'Author')}
                </label>
                <input
                  type="text"
                  value={form.frontmatter.author || form.author || ''}
                  onChange={(e) => updateFrontmatter({ author: e.target.value })}
                  placeholder="Your name or organization"
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
                />
              </div>
            </div>

            {/* Execution Context */}
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                {t('skills.executionContext', 'Execution Context')}
              </label>
              <div className="flex gap-3">
                {(['inline', 'fork'] as const).map((ctx) => (
                  <label key={ctx} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="context"
                      value={ctx}
                      checked={(form.frontmatter.context || form.context) === ctx}
                      onChange={() => updateFrontmatter({ context: ctx })}
                      className="w-4 h-4 text-accent focus:ring-accent/30 bg-surface-2 border-border"
                    />
                    <div>
                      <span className="text-sm text-text-secondary font-medium capitalize">{ctx}</span>
                      <p className="text-[10px] text-text-muted">
                        {ctx === 'inline'
                          ? 'Injected into system prompt directly'
                          : 'Runs as a separate sub-agent conversation'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Allowed Tools hint (optional) */}
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                {t('skills.allowedTools', 'Allowed Tools')}
                <span className="normal-case font-normal ml-1">(optional)</span>
              </label>
              <input
                type="text"
                value={(form.frontmatter.allowedTools || form.allowedTools || []).join(', ')}
                onChange={(e) => {
                  const tools = e.target.value.split(',').map((t) => t.trim()).filter(Boolean)
                  updateFrontmatter({ allowedTools: tools.length > 0 ? tools : undefined })
                  updateForm({ allowedTools: tools.length > 0 ? tools : undefined })
                }}
                placeholder="Leave empty = agent decides. Or: read_file, web_search, ..."
                className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm font-mono"
              />
              <p className="text-[10px] text-text-muted mt-1">
                Comma-separated list of tool hints. If empty, the agent autonomously decides which tools to use.
              </p>
            </div>

            {/* Enabled toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => updateForm({ enabled: e.target.checked })}
                className="w-4 h-4 rounded border-border text-accent focus:ring-accent/30 bg-surface-2"
              />
              <span className="text-sm text-text-secondary">{t('common.enabled', 'Enabled')}</span>
            </label>

            {validationError && (
              <p className="text-xs text-danger">{validationError}</p>
            )}
            <div className="flex gap-3 pt-2">
              <button type="submit" className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover hover:shadow-[0_4px_20px_rgba(var(--t-accent-rgb),0.25)] transition-all">
                {skill ? t('skills.saveChanges', 'Save Changes') : t('skills.addSkillTitle', 'Create Skill')}
              </button>
              <button type="button" onClick={handleCancel} className="px-5 py-2.5 rounded-xl bg-surface-3 text-text-secondary text-sm font-medium hover:bg-surface-4 transition-colors">
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </div>
        )}

        {/* ── Content tab (SKILL.md body) ───────────────────────── */}
        {activeTab === 'content' && (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">
              Write the skill&apos;s markdown instructions. This is the core content that gets injected into the agent&apos;s system prompt when the skill is active.
            </p>
            <MarkdownEditor
              value={form.content ?? ''}
              onChange={(v) => updateForm({ content: v })}
              placeholder="## Instructions&#10;&#10;Describe how the agent should behave when this skill is active...&#10;&#10;## Guidelines&#10;- Be specific about patterns and approaches&#10;- Include examples when helpful&#10;- Reference external docs if needed"
              rows={20}
            />
            <div className="flex gap-3 pt-2">
              <button type="submit" className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-all">
                {skill ? t('skills.saveChanges', 'Save Changes') : t('skills.addSkillTitle', 'Create Skill')}
              </button>
              <button type="button" onClick={handleCancel} className="px-5 py-2.5 rounded-xl bg-surface-3 text-text-secondary text-sm font-medium hover:bg-surface-4 transition-colors">
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </div>
        )}

        {/* ── Preview tab (SKILL.md output) ─────────────────────── */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">
              Preview of the generated SKILL.md file:
            </p>
            <pre className="rounded-xl bg-surface-2 border border-border p-4 text-xs text-text-secondary font-mono whitespace-pre-wrap overflow-auto max-h-[60vh]">
              {generatePreview(form)}
            </pre>
          </div>
        )}
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

