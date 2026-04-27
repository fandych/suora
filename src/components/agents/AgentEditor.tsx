import { useState, type ReactNode } from 'react'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'
import { generateId } from '@/utils/helpers'
import { BUILTIN_TOOL_DESCRIPTIONS } from '@/services/tools'
import { AGENT_ICON_NAMES, AgentAvatar, IconifyIcon } from '@/components/icons/IconifyIcons'
import { IconPicker } from '@/components/icons/IconPicker'
import { AgentFlowDiagram } from '@/components/agents/AgentFlowDiagram'
import { SystemPromptMarkdownEditor } from '@/components/agents/SystemPromptMarkdownEditor'
import { buildAgentMermaidSource } from '@/services/agentMermaid'
import { getAgentCapabilityProfile, validateAgentConfiguration } from '@/services/agentDiagnostics'
import type { Agent } from '@/types'
import { confirm } from '@/services/confirmDialog'
import {
  settingsCheckboxClass,
  settingsInputClass,
  settingsLabelClass,
  settingsMonoInputClass,
  settingsRangeClass,
  settingsSelectClass,
  settingsTextAreaClass,
} from '@/components/settings/panelUi'

const TOOL_DESCRIPTIONS = BUILTIN_TOOL_DESCRIPTIONS
const AVATARS: string[] = [...AGENT_ICON_NAMES]
const editorInputClass = `${settingsInputClass} bg-surface-2/75`
const editorSelectClass = `${settingsSelectClass} bg-surface-2/75`
const editorMonoInputClass = `${settingsMonoInputClass} bg-surface-2/75`
const editorCompactControlClass = `${settingsInputClass} px-3 py-2.5 text-[12px] text-text-secondary`
const editorCompactTextAreaClass = `${settingsTextAreaClass} min-h-0 rounded-2xl bg-surface-0/75 px-3 py-2.5 text-text-secondary`

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

function getBuiltinSkillTranslationKey(skillNameOrId: string): string | null {
  const value = skillNameOrId.toLowerCase()
  if (value.includes('find-skills')) return 'findSkills'
  if (value.includes('skill-creator')) return 'skillCreator'
  return null
}

export function AgentEditor({ agent, onSave, onCancel, onTest }: {
  agent: Agent | null
  onSave: (agent: Agent) => void
  onCancel: () => void
  onTest?: (agent: Agent) => void
}) {
  const { t } = useI18n()
  const { models, skills, providerConfigs, removeAgentMemory, clearAgentMemories, updateAgent, addNotification } = useAppStore()
  const [memoryFilter, setMemoryFilter] = useState<'all' | 'insight' | 'preference' | 'correction' | 'knowledge'>('all')
  const [memoryQuery, setMemoryQuery] = useState('')
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [diagramView, setDiagramView] = useState<'preview' | 'mermaid'>('preview')
  const [copiedAgentMermaid, setCopiedAgentMermaid] = useState(false)

  const getSkillCopy = (skillId: string, skillName: string, skillDescription?: string) => {
    const translationKey = getBuiltinSkillTranslationKey(`${skillId} ${skillName}`)
    if (!translationKey) return { name: skillName, description: skillDescription }

    return {
      name: t(`skills.builtin.${translationKey}.name`, skillName),
      description: t(`skills.builtin.${translationKey}.description`, skillDescription || ''),
    }
  }

  const [form, setForm] = useState<Agent>(
    agent ?? {
      id: generateId('agent'),
      name: '',
      avatar: 'agent-robot',
      systemPrompt: '',
      modelId: '',
      skills: [],
      temperature: 0.7,
      maxTokens: 4096,
      enabled: true,
      greeting: t('agents.defaultGreeting', 'Hello, I am ready to help.'),
      responseStyle: 'balanced',
      allowedTools: [],
      memories: [],
      autoLearn: false,
    }
  )

  const updateForm = (patch: Partial<Agent>) => {
    setDirty(true)
    setForm((f) => ({ ...f, ...patch }))
  }

  const handleCancel = async () => {
    if (dirty) {
      const ok = await confirm({
        title: t('common.unsavedChanges', 'Unsaved changes'),
        body: t('agents.unsavedChanges', 'You have unsaved changes. Discard?'),
        danger: true,
        confirmText: t('common.discard', 'Discard'),
      })
      if (!ok) return
    }
    onCancel()
  }

  const [validationError, setValidationError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setValidationError(t('agents.agentNameRequired', 'Agent name is required.'))
      return
    }
    const blockingDiagnostic = validateAgentConfiguration(form, models, skills).find((diagnostic) => diagnostic.severity === 'error')
    if (blockingDiagnostic) {
      setValidationError(blockingDiagnostic.message)
      return
    }
    setValidationError('')
    onSave(form)
    setDirty(false)
  }

  const toggleSkill = (skillId: string) => {
    updateForm({
      skills: form.skills.includes(skillId)
        ? form.skills.filter((s) => s !== skillId)
        : [...form.skills, skillId],
    })
  }

  const availableTools = Array.from(
    new Set(
      skills
        .filter((s) => form.skills.includes(s.id) && s.enabled)
        .flatMap((s) => (s.tools ?? []).map((t: { name: string }) => t.name))
    )
  )

  const toggleAllowedTool = (toolName: string) => {
    const current = form.allowedTools ?? []
    updateForm({
      allowedTools: current.includes(toolName)
        ? current.filter((t) => t !== toolName)
        : [...current, toolName],
    })
  }

  const filteredMemories = (form.memories || []).filter((m) => {
    const typeOk = memoryFilter === 'all' || m.type === memoryFilter
    const q = memoryQuery.trim().toLowerCase()
    const queryOk = !q || m.content.toLowerCase().includes(q)
    return typeOk && queryOk
  })

  const selectedSkills = skills.filter((skill) => form.skills.includes(skill.id))
  const selectedModel = models.find((model) => model.id === form.modelId) ?? null
  const selectedProviderName = selectedModel
    ? providerConfigs.find((provider) => provider.id === selectedModel.provider)?.name || selectedModel.provider
    : ''
  const selectedModelLabel = selectedModel
    ? `${selectedProviderName} / ${selectedModel.name}`
    : t('agents.selectModel', '-- Select Model --')
  const selectedSkillNames = selectedSkills.map((skill) => getSkillCopy(skill.id, skill.name, skill.description).name)
  const agentDiagnostics = validateAgentConfiguration(form, models, skills)
  const capabilityProfile = getAgentCapabilityProfile(form, models, skills)
  const agentFlowOptions = {
    modelLabel: selectedModelLabel,
    skillNames: selectedSkillNames,
    availableToolNames: availableTools,
  }
  const agentMermaidSource = buildAgentMermaidSource(form, agentFlowOptions)
  const heroTitle = form.name.trim() || t('agents.untitled', 'Untitled Agent')
  const heroDescription = form.whenToUse?.trim()
    || form.greeting?.trim()
    || t('agents.heroFallback', 'Design the agent voice, choose the right skills, and set guardrails before sending it into active use.')
  const promptLength = form.systemPrompt.trim().length

  const copyAgentMermaidSource = async () => {
    try {
      await navigator.clipboard.writeText(agentMermaidSource)
      setCopiedAgentMermaid(true)
      window.setTimeout(() => setCopiedAgentMermaid(false), 1600)
    } catch {
      addNotification({
        id: generateId('notif'),
        type: 'error',
        title: t('agents.agentMermaidCopyFailedTitle', 'Could not copy agent diagram'),
        message: t('agents.agentMermaidCopyFailedBody', 'The Mermaid source could not be copied to the clipboard.'),
        timestamp: Date.now(),
        read: false,
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-448 flex-col gap-6 px-5 py-6 xl:px-8 xl:py-8">
        <section className="rounded-4xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/94 to-surface-2/72 p-6 shadow-[0_24px_70px_rgba(var(--t-accent-rgb),0.08)] xl:p-7">
          <div className="flex flex-col gap-6 2xl:flex-row 2xl:items-start 2xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="relative shrink-0">
                <div className="flex h-20 w-20 items-center justify-center rounded-[28px] border border-accent/15 bg-surface-0/78 shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.14)]">
                  <AgentAvatar avatar={form.avatar} size={42} />
                </div>
                {form.color && (
                  <svg viewBox="0 0 10 10" className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-surface-0 p-0.75" aria-hidden="true">
                    <circle cx="5" cy="5" r="3.5" fill={form.color} />
                  </svg>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">
                  {agent ? t('agents.editAgent', 'Edit Agent') : t('agents.createAgent', 'Create Agent')}
                </div>
                <h2 className="mt-2 text-[30px] font-semibold tracking-tight text-text-primary">{heroTitle}</h2>
                <p className="mt-2 max-w-3xl text-[14px] leading-7 text-text-secondary/82">{heroDescription}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-border-subtle/45 bg-surface-0/78 px-3 py-1 text-[11px] text-text-secondary">
                    {selectedModelLabel}
                  </span>
                  <span className="rounded-full border border-border-subtle/45 bg-surface-0/78 px-3 py-1 text-[11px] text-text-secondary">
                    {t(`agents.${form.responseStyle ?? 'balanced'}`, form.responseStyle ?? 'balanced')}
                  </span>
                  <span className={`rounded-full border px-3 py-1 text-[11px] ${form.enabled ? 'border-success/20 bg-success/10 text-success' : 'border-border-subtle/45 bg-surface-0/78 text-text-muted'}`}>
                    {form.enabled ? t('common.enabled', 'Enabled') : t('common.off', 'Off')}
                  </span>
                  {form.autoLearn && (
                    <span className="rounded-full border border-accent/18 bg-accent/10 px-3 py-1 text-[11px] text-accent">
                      {t('agents.autoLearn', 'Auto-learn')}
                    </span>
                  )}
                  <span className="rounded-full border border-border-subtle/45 bg-surface-0/78 px-3 py-1 text-[11px] text-text-secondary">
                    {selectedSkills.length} {t('agents.skills', 'skills')}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:w-136">
              <SummaryStat
                label={t('agents.systemPrompt', 'System Prompt')}
                value={promptLength > 0 ? `${promptLength}` : '0'}
                hint={t('agents.characters', 'characters')}
              />
              <SummaryStat
                label={t('agents.skills', 'Skills')}
                value={`${selectedSkills.length}`}
                hint={t('agents.linkedCapabilities', 'linked capabilities')}
              />
              <SummaryStat
                label={t('agents.allowedTools', 'Allowed Tools')}
                value={`${form.allowedTools?.length ?? 0}`}
                hint={t('agents.restrictedSet', 'restricted set')}
              />
              <SummaryStat
                label={t('agents.learnedMemories', 'Memories')}
                value={`${form.memories?.length ?? 0}`}
                hint={t('agents.retainedContext', 'retained context')}
              />
            </div>
          </div>
        </section>

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.55fr)_minmax(22rem,0.92fr)]">
          <div className="space-y-6">
            <EditorSection
              eyebrow={t('agents.identity', 'Identity')}
              title={t('agents.identityAndVoice', 'Identity & Voice')}
              description={t('agents.identityAndVoiceHint', 'Shape how this agent looks, which model it runs on, and when users should reach for it.')}
            >
              <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
                <div className="rounded-3xl border border-border-subtle/50 bg-surface-0/55 p-4">
                  <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-3">{t('agents.avatar', 'Avatar')}</label>
                  <div className="flex gap-2 flex-wrap">
                    {AVATARS.map((av) => (
                      <button
                        key={av}
                        type="button"
                        title={av}
                        onClick={() => updateForm({ avatar: av })}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all ${
                          form.avatar === av
                            ? 'border-accent bg-accent/16 text-accent shadow-[0_10px_24px_rgba(var(--t-accent-rgb),0.12)] scale-105'
                            : 'border-border-subtle/55 bg-surface-2/70 hover:border-accent/25 hover:bg-surface-3/70'
                        }`}
                      >
                        <AgentAvatar avatar={av} size={18} />
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowIconPicker(true)}
                      title={t('icons.moreIcons', 'Browse more icons')}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-border-subtle/70 bg-surface-2/70 text-text-muted transition-all hover:border-accent/25 hover:text-accent"
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg>
                    </button>
                  </div>

                  {form.avatar && !AVATARS.includes(form.avatar) && (
                    <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border-subtle/50 bg-surface-2/60 p-2.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/16 text-accent">
                        <AgentAvatar avatar={form.avatar} size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('common.selected', 'Selected')}</div>
                        <code className="block truncate text-[11px] text-text-secondary">{form.avatar}</code>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 border-t border-border-subtle/40 pt-4">
                    <label htmlFor="agent-color" className={settingsLabelClass}>{t('agents.color', 'Color')}</label>
                    <div className="flex items-center gap-3">
                      <input
                        id="agent-color"
                        type="color"
                        value={form.color || '#6366F1'}
                        onChange={(e) => updateForm({ color: e.target.value })}
                        aria-label={t('agents.color', 'Color')}
                        title={t('agents.color', 'Color')}
                        className="h-10 w-10 cursor-pointer rounded-xl border border-border bg-transparent"
                      />
                      <div className="min-w-0">
                        <div className="font-mono text-[12px] text-text-secondary">{form.color || '#6366F1'}</div>
                        <div className="text-[10px] text-text-muted">{t('agents.colorHint', 'Used for quick identification in lists.')}</div>
                      </div>
                      {form.color && (
                        <button
                          type="button"
                          onClick={() => updateForm({ color: undefined })}
                          className="ml-auto text-[11px] text-text-muted transition-colors hover:text-danger"
                        >
                          {t('common.reset', 'Reset')}
                        </button>
                      )}
                    </div>
                  </div>

                  {showIconPicker && (
                    <IconPicker
                      value={form.avatar}
                      onSelect={(icon) => { updateForm({ avatar: icon }); setShowIconPicker(false) }}
                      onClose={() => setShowIconPicker(false)}
                    />
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={settingsLabelClass}>{t('common.name', 'Name')}</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => updateForm({ name: e.target.value })}
                      placeholder={t('agents.namePlaceholder', 'e.g., Code Expert')}
                      className={editorInputClass}
                    />
                  </div>
                  <div>
                    <label className={settingsLabelClass}>{t('agents.model', 'Model')}</label>
                    <select
                      aria-label="Model"
                      value={form.modelId}
                      onChange={(e) => updateForm({ modelId: e.target.value })}
                      className={editorSelectClass}
                    >
                      <option value="">{t('agents.selectModel', '-- Select Model --')}</option>
                      {models.filter((m) => m.enabled).map((m) => {
                        const providerName = providerConfigs.find((p) => p.id === m.provider)?.name || m.provider
                        return <option key={m.id} value={m.id}>{providerName} / {m.name}</option>
                      })}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={settingsLabelClass}>{t('agents.greeting', 'Greeting')}</label>
                    <input
                      type="text"
                      value={form.greeting ?? ''}
                      onChange={(e) => updateForm({ greeting: e.target.value })}
                      placeholder={t('agents.greetingPlaceholder', 'Custom greeting for new chats')}
                      className={editorInputClass}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={settingsLabelClass}>{t('agents.whenToUse', 'When To Use')}</label>
                    <input
                      type="text"
                      value={form.whenToUse ?? ''}
                      onChange={(e) => updateForm({ whenToUse: e.target.value })}
                      placeholder={t('agents.whenToUsePlaceholder', 'e.g., When the user asks about code review or debugging')}
                      className={editorInputClass}
                    />
                    <p className="mt-2 text-[11px] leading-relaxed text-text-muted">{t('agents.whenToUseHint', 'Describes when this agent should be selected. Helps with automatic agent routing.')}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={settingsLabelClass}>{t('agents.responseStyle', 'Response Style')}</label>
                    <select
                      aria-label="Response style"
                      value={form.responseStyle ?? 'balanced'}
                      onChange={(e) => updateForm({ responseStyle: e.target.value as Agent['responseStyle'] })}
                      className={editorSelectClass}
                    >
                      <option value="concise">{t('agents.concise', 'Concise')}</option>
                      <option value="balanced">{t('agents.balanced', 'Balanced')}</option>
                      <option value="detailed">{t('agents.detailed', 'Detailed')}</option>
                    </select>
                  </div>
                </div>
              </div>
            </EditorSection>

            <EditorSection
              eyebrow={t('agents.instructions', 'Instructions')}
              title={t('agents.systemPrompt', 'System Prompt')}
              description={t('agents.systemPromptHint', 'Write Markdown operating instructions that define how this agent reasons, speaks, and applies tools.')}
            >
              <SystemPromptMarkdownEditor
                value={form.systemPrompt}
                onChange={(systemPrompt) => updateForm({ systemPrompt })}
                placeholder={t('agents.systemPromptPlaceholder', '## Role\nYou are a helpful assistant.\n\n## Rules\n- Be clear and specific.\n- Use tools when they help.')}
                rows={10}
              />
            </EditorSection>

            <EditorSection
              eyebrow={t('agents.capabilities', 'Capabilities')}
              title={t('agents.skillsAndTools', 'Skills & Tooling')}
              description={t('agents.skillsAndToolsHint', 'Attach reusable skills, then tighten or relax tool access based on how much autonomy this agent should have.')}
            >
              <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-3xl border border-border-subtle/50 bg-surface-0/55 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold text-text-primary">{t('agents.skills', 'Skills')}</div>
                      <div className="text-[11px] text-text-muted">{selectedSkills.length} {t('agents.selected', 'selected')}</div>
                    </div>
                    <div className="rounded-full bg-surface-3/80 px-2.5 py-1 text-[10px] text-text-muted">
                      {skills.length} {t('common.total', 'total')}
                    </div>
                  </div>

                  {skills.length > 0 ? (
                    <div className="space-y-2 max-h-104 overflow-y-auto pr-1">
                      {skills.map((skill) => {
                        const hasPrompt = !!(skill.prompt?.trim())
                        const skillCopy = getSkillCopy(skill.id, skill.name, skill.description)
                        return (
                          <label key={skill.id} className="flex items-start gap-3 rounded-2xl border border-border-subtle/45 bg-surface-2/60 p-3 cursor-pointer transition-colors hover:border-accent/16 hover:bg-surface-2/85">
                            <input
                              type="checkbox"
                              checked={form.skills.includes(skill.id)}
                              onChange={() => toggleSkill(skill.id)}
                              className="mt-1 h-4 w-4 shrink-0 rounded border-border bg-surface-2 text-accent focus:ring-accent/30"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[13px] font-medium text-text-secondary transition-colors group-hover:text-text-primary">{skillCopy.name}</span>
                                {!skill.enabled && <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[9px] text-text-muted">{t('common.off', 'OFF')}</span>}
                                {hasPrompt && <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] text-accent">{t('agents.promptBadge', 'prompt')}</span>}
                              </div>
                              {skillCopy.description && <div className="mt-1 text-[11px] leading-relaxed text-text-muted line-clamp-2">{skillCopy.description}</div>}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-dashed border-border-subtle/55 bg-surface-2/40 px-4 py-6 text-[12px] text-text-muted">
                      {t('agents.noSkillsAvailable', 'No skills available yet. Create or install skills first to unlock reusable capabilities.')}
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-border-subtle/50 bg-surface-0/55 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold text-text-primary">{t('agents.allowedTools', 'Allowed Tools')}</div>
                        <div className="text-[11px] text-text-muted">{availableTools.length} {t('agents.exposedBySkills', 'exposed by selected skills')}</div>
                      </div>
                      <div className="rounded-full bg-surface-3/80 px-2.5 py-1 text-[10px] text-text-muted">
                        {form.allowedTools?.length ?? 0} {t('agents.restricted', 'restricted')}
                      </div>
                    </div>

                    {availableTools.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-border-subtle/55 bg-surface-2/40 px-4 py-6 text-[12px] text-text-muted">
                        {t('agents.selectSkillsFirst', 'Select one or more skills to expose tools.')}
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {availableTools.map((toolName) => (
                          <label key={toolName} className="flex items-start gap-3 rounded-2xl border border-border-subtle/45 bg-surface-2/60 p-3 cursor-pointer transition-colors hover:border-accent/16 hover:bg-surface-2/85">
                            <input
                              type="checkbox"
                              checked={(form.allowedTools ?? []).includes(toolName)}
                              onChange={() => toggleAllowedTool(toolName)}
                              className="mt-1 h-4 w-4 shrink-0 rounded border-border bg-surface-2 text-accent focus:ring-accent/30"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-mono text-[12px] text-text-secondary">{toolName}</div>
                              {TOOL_DESCRIPTIONS[toolName] && <div className="mt-1 text-[11px] leading-relaxed text-text-muted">{TOOL_DESCRIPTIONS[toolName]}</div>}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                    <p className="mt-3 text-[11px] leading-relaxed text-text-muted">{t('agents.allowAllTools', 'Leave all unchecked to allow all tools from selected skills.')}</p>
                  </div>

                  <div className="rounded-3xl border border-border-subtle/50 bg-surface-0/55 p-4">
                    <label className={settingsLabelClass}>{t('agents.disallowedTools', 'Disallowed Tools')}</label>
                    <input
                      type="text"
                      value={(form.disallowedTools ?? []).join(', ')}
                      onChange={(e) => {
                        const val = e.target.value
                        updateForm({
                          disallowedTools: val.trim() ? val.split(',').map((s) => s.trim()).filter(Boolean) : [],
                        })
                      }}
                      placeholder={t('agents.disallowedToolsPlaceholder', 'shell, delete_file, git_push')}
                      className={editorMonoInputClass}
                    />
                    <p className="mt-2 text-[11px] leading-relaxed text-text-muted">{t('agents.disallowedToolsHint', 'Comma-separated tool names that are always blocked for this agent.')}</p>
                  </div>
                </div>
              </div>
            </EditorSection>
          </div>

          <div className="space-y-6 2xl:sticky 2xl:top-6 self-start">
            <EditorSection
              eyebrow={t('agents.diagnostics', 'Diagnostics')}
              title={t('agents.capabilityProfile', 'Capability Profile')}
              description={t('agents.capabilityProfileHint', 'Validate model, skills, prompt size, tool guardrails, and permission posture before this agent runs.')}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <SummaryStat label={t('agents.tools', 'Tools')} value={String(capabilityProfile.toolCount)} hint={t('agents.toolsHint', 'Effective tool surface')} />
                <SummaryStat label={t('agents.skills', 'Skills')} value={`${capabilityProfile.enabledSkillCount}/${form.skills.length}`} hint={t('agents.skillsHint', 'Enabled assigned skills')} />
                <SummaryStat label={t('agents.prompt', 'Prompt')} value={capabilityProfile.promptChars.toLocaleString()} hint={t('agents.promptChars', 'Prompt + memory chars')} />
                <SummaryStat label={t('agents.model', 'Model')} value={capabilityProfile.modelLabel} hint={t('agents.modelBinding', 'Runtime binding')} />
              </div>

              {agentDiagnostics.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {agentDiagnostics.map((diagnostic) => {
                    const tone = diagnostic.severity === 'error'
                      ? 'border-danger/20 bg-danger/10 text-danger'
                      : diagnostic.severity === 'warning'
                        ? 'border-warning/20 bg-warning/10 text-warning'
                        : 'border-border-subtle bg-surface-2/70 text-text-secondary'
                    return (
                      <div key={`${diagnostic.code}-${diagnostic.message}`} className={`rounded-2xl border px-3 py-2 text-xs ${tone}`}>
                        <span className="font-semibold uppercase">{diagnostic.severity}</span> · {diagnostic.message}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-success/20 bg-success/10 px-3 py-2 text-xs text-success">
                  {t('agents.noDiagnostics', 'No configuration issues detected.')}
                </div>
              )}
            </EditorSection>

            <EditorSection
              eyebrow={t('agents.workflow', 'Workflow')}
              title={t('agents.agentFlowDiagram', 'Agent Flow Diagram')}
              description={t('agents.agentFlowDiagramHint', 'Inspect how input, memory, prompt, skills, tools, model, and output connect for this agent.')}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-2xl border border-border-subtle bg-surface-0/70 p-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDiagramView('preview')}
                    className={`rounded-xl px-3 py-1.5 transition-colors ${diagramView === 'preview' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary'}`}
                  >
                    {t('agents.pipelineDiagramPreview', 'Preview')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiagramView('mermaid')}
                    className={`rounded-xl px-3 py-1.5 transition-colors ${diagramView === 'mermaid' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary'}`}
                  >
                    {t('agents.pipelineDiagramSource', 'Mermaid')}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void copyAgentMermaidSource()}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-border-subtle bg-surface-0/70 px-3 py-2 text-[11px] font-medium text-text-secondary transition-colors hover:border-accent/20 hover:text-accent"
                >
                  <IconifyIcon name={copiedAgentMermaid ? 'ui-check' : 'ui-copy'} size={13} color="currentColor" />
                  {copiedAgentMermaid ? t('common.copied', 'Copied') : t('agents.copyMermaid', 'Copy Mermaid')}
                </button>
              </div>

              {diagramView === 'preview' ? (
                <AgentFlowDiagram agent={form} options={agentFlowOptions} />
              ) : (
                <pre className="max-h-110 overflow-auto rounded-2xl border border-border-subtle bg-surface-0/70 p-4 text-[11px] leading-5 text-text-secondary">
                  <code>{agentMermaidSource}</code>
                </pre>
              )}
            </EditorSection>

            <EditorSection
              eyebrow={t('agents.runtime', 'Runtime')}
              title={t('agents.controlRoom', 'Control Room')}
              description={t('agents.controlRoomHint', 'Tune creativity, budget, turn count, and permission posture before saving the profile.')}
            >
              <div className="space-y-5">
                <div>
                  <label className={settingsLabelClass}>
                    {t('agents.temperature', 'Temperature')}: {form.temperature?.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    aria-label="Temperature"
                    min="0"
                    max="2"
                    step="0.1"
                    value={form.temperature ?? 0.7}
                    onChange={(e) => updateForm({ temperature: parseFloat(e.target.value) })}
                    className={settingsRangeClass}
                  />
                  <div className="mt-2 flex justify-between text-[10px] text-text-muted">
                    <span>{t('agents.precise', 'Precise (0)')}</span>
                    <span>{t('agents.creative', 'Creative (2)')}</span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={settingsLabelClass}>{t('agents.maxTokens', 'Max Tokens')}</label>
                    <input
                      type="number"
                      aria-label="Max tokens"
                      value={form.maxTokens ?? 4096}
                      onChange={(e) => updateForm({ maxTokens: parseInt(e.target.value) || 4096 })}
                      min={256}
                      max={128000}
                      className={editorInputClass}
                    />
                  </div>
                  <div>
                    <label className={settingsLabelClass}>{t('agents.maxTurns', 'Max Turns')}</label>
                    <input
                      type="number"
                      aria-label="Max turns"
                      value={Math.max(2, form.maxTurns ?? 20)}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value, 10)
                        updateForm({ maxTurns: Number.isFinite(parsed) ? Math.max(2, parsed) : 20 })
                      }}
                      min={2}
                      max={100}
                      className={editorInputClass}
                    />
                  </div>
                </div>
                <p className="-mt-2 text-[11px] leading-relaxed text-text-muted">{t('agents.maxTurnsHint', 'Max agentic tool-use turns per request. Tool-enabled agents need at least 2 turns to reply after a tool result.')}</p>

                <div>
                  <label className={settingsLabelClass}>{t('agents.permissionMode', 'Permission Mode')}</label>
                  <select
                    aria-label="Permission mode"
                    value={form.permissionMode ?? 'default'}
                    onChange={(e) => updateForm({ permissionMode: e.target.value as Agent['permissionMode'] })}
                    className={editorSelectClass}
                  >
                    <option value="default">{t('agents.permDefault', 'Default — ask for dangerous ops')}</option>
                    <option value="acceptEdits">{t('agents.permAcceptEdits', 'Accept Edits — auto-accept writes')}</option>
                    <option value="plan">{t('agents.permPlan', 'Plan — require plan approval')}</option>
                    <option value="bypassPermissions">{t('agents.permBypass', 'Bypass — allow all tools')}</option>
                  </select>
                </div>

                <div className="space-y-3 rounded-3xl border border-border-subtle/45 bg-surface-0/55 p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.autoLearn}
                      onChange={(e) => updateForm({ autoLearn: e.target.checked })}
                      className={settingsCheckboxClass}
                    />
                    <span className="text-sm text-text-secondary">{t('agents.enableAutoLearn', 'Enable self-learning from user feedback')}</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      onChange={(e) => updateForm({ enabled: e.target.checked })}
                      className={settingsCheckboxClass}
                    />
                    <span className="text-sm text-text-secondary">{t('common.enabled', 'Enabled')}</span>
                  </label>
                </div>
              </div>
            </EditorSection>

            <EditorSection
              eyebrow={t('agents.memory', 'Memory')}
              title={t('agents.learnedMemories', 'Learned Memories')}
              description={t('agents.memoryHint', 'Review what this agent has retained from previous interactions and prune anything that no longer helps.')}
            >
              {!!form.memories?.length ? (
                <>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-text-muted">{filteredMemories.length} {t('agents.memoryEntries', 'entries shown')}</div>
                    <button
                      type="button"
                      onClick={() => {
                        clearAgentMemories(form.id)
                        updateForm({ memories: [] })
                      }}
                      className="text-[11px] text-danger transition-colors hover:text-danger/80"
                    >
                      {t('agents.clearMemories', 'Clear all')}
                    </button>
                  </div>
                  <div className="mb-3 grid gap-2 sm:grid-cols-2">
                    <select
                      aria-label={t('agents.memoryTypeFilter', 'Memory type filter')}
                      value={memoryFilter}
                      onChange={(e) => setMemoryFilter(e.target.value as 'all' | 'insight' | 'preference' | 'correction' | 'knowledge')}
                      className={editorCompactControlClass}
                    >
                      <option value="all">{t('agents.memoryTypeAll', 'All types')}</option>
                      <option value="insight">{t('agents.memoryTypeInsight', 'Insight')}</option>
                      <option value="preference">{t('agents.memoryTypePreference', 'Preference')}</option>
                      <option value="correction">{t('agents.memoryTypeCorrection', 'Correction')}</option>
                      <option value="knowledge">{t('agents.memoryTypeKnowledge', 'Knowledge')}</option>
                    </select>
                    <input
                      value={memoryQuery}
                      onChange={(e) => setMemoryQuery(e.target.value)}
                      placeholder={t('agents.searchMemories', 'Search memories')}
                      className={editorCompactControlClass}
                    />
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {filteredMemories.map((memory) => (
                      <div key={memory.id} className="rounded-[22px] border border-border-subtle/45 bg-surface-2/65 p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-full bg-surface-3/85 px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">{memory.type}</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingMemoryId(memory.id)}
                              className="text-text-muted transition-colors hover:text-accent"
                            >
                              {t('common.edit', 'Edit')}
                            </button>
                            <button
                              type="button"
                              title={t('agents.removeMemory', 'Remove memory')}
                              onClick={() => {
                                removeAgentMemory(form.id, memory.id)
                                updateForm({ memories: form.memories.filter((m) => m.id !== memory.id) })
                              }}
                              className="text-text-muted transition-colors hover:text-danger"
                            >
                              <IconifyIcon name="ui-close" size={14} color="currentColor" />
                            </button>
                          </div>
                        </div>
                        {editingMemoryId === memory.id ? (
                          <div className="mt-2 space-y-2">
                            <textarea
                              aria-label={t('agents.editMemory', 'Edit memory content')}
                              value={memory.content}
                              onChange={(e) => {
                                const updated = form.memories.map((m) =>
                                  m.id === memory.id ? { ...m, content: e.target.value } : m
                                )
                                updateForm({ memories: updated })
                              }}
                              rows={3}
                              className={editorCompactTextAreaClass}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (agent) {
                                  updateAgent(form.id, { memories: form.memories })
                                }
                                setEditingMemoryId(null)
                              }}
                              className="text-[11px] font-medium text-success"
                            >
                              {t('common.done', 'Done')}
                            </button>
                          </div>
                        ) : (
                          <p className="mt-2 text-[12px] leading-relaxed text-text-secondary">{memory.content}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-3xl border border-dashed border-border-subtle/55 bg-surface-2/40 px-4 py-6 text-[12px] leading-relaxed text-text-muted">
                  {t('agents.noMemoriesYet', 'No learned memories yet. This area will populate when the agent stores useful corrections, preferences, and durable context.')}
                </div>
              )}
            </EditorSection>

            <EditorSection
              eyebrow={t('common.actions', 'Actions')}
              title={t('agents.reviewAndSave', 'Review & Save')}
              description={t('agents.reviewAndSaveHint', 'Save this profile when the model, skills, and permissions match the behavior you want to ship.')}
            >
              {validationError && (
                <p className="mb-4 rounded-2xl border border-danger/20 bg-danger/8 px-4 py-3 text-[12px] text-danger">{validationError}</p>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(var(--t-accent-rgb),0.22)] transition-all hover:bg-accent-hover"
                >
                  {agent ? t('common.saveChanges', 'Save Changes') : t('agents.createAgent', 'Create Agent')}
                </button>
                {agent && onTest && (
                  <button
                    type="button"
                    onClick={() => onTest(form)}
                    className="inline-flex items-center gap-1.5 rounded-2xl border border-accent/25 bg-accent/8 px-5 py-3 text-sm font-medium text-accent transition-colors hover:bg-accent/12"
                  >
                    <IconifyIcon name="ui-test-tube" size={14} color="currentColor" /> {t('common.test', 'Test')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-2xl bg-surface-3 px-5 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-4"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
            </EditorSection>
          </div>
        </div>
      </div>
    </form>
  )
}
