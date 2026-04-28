import { useState, type ReactNode } from 'react'
import { generateId } from '@/utils/helpers'
import { SkillIcon, IconifyIcon, getSkillIconName } from '@/components/icons/IconifyIcons'
import { IconPicker } from '@/components/icons/IconPicker'
import { useI18n } from '@/hooks/useI18n'
import type { Skill, SkillFrontmatter, SkillSource, SkillExecutionContext } from '@/types'
import { MarkdownEditor } from './SkillEditorPanels'
import { confirm } from '@/services/confirmDialog'
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

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:w-136">
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
