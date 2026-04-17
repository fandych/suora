import { useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'
import { generateId } from '@/utils/helpers'
import { BUILTIN_TOOL_DESCRIPTIONS } from '@/services/tools'
import { AGENT_ICON_NAMES, AgentAvatar, IconifyIcon } from '@/components/icons/IconifyIcons'
import { IconPicker } from '@/components/icons/IconPicker'
import type { Agent } from '@/types'
import { confirm } from '@/services/confirmDialog'

const TOOL_DESCRIPTIONS = BUILTIN_TOOL_DESCRIPTIONS
const AVATARS: string[] = [...AGENT_ICON_NAMES]

export function AgentEditor({ agent, onSave, onCancel, onTest }: {
  agent: Agent | null
  onSave: (agent: Agent) => void
  onCancel: () => void
  onTest?: (agent: Agent) => void
}) {
  const { t } = useI18n()
  const { models, skills, providerConfigs, removeAgentMemory, clearAgentMemories, updateAgent } = useAppStore()
  const [memoryFilter, setMemoryFilter] = useState<'all' | 'insight' | 'preference' | 'correction' | 'knowledge'>('all')
  const [memoryQuery, setMemoryQuery] = useState('')
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)

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
      greeting: 'Hello, I am ready to help.',
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

  return (
    <form onSubmit={handleSubmit} className="flex-1 p-8 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-8 text-text-primary">{agent ? t('agents.editAgent', 'Edit Agent') : t('agents.createAgent', 'Create Agent')}</h2>

      <div className="space-y-6">
        {/* Avatar */}
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('agents.avatar', 'Avatar')}</label>
          <div className="flex gap-2 flex-wrap">
            {AVATARS.map((av) => (
              <button
                key={av}
                type="button"
                title={av}
                onClick={() => updateForm({ avatar: av })}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  form.avatar === av
                    ? 'bg-accent/20 ring-2 ring-accent scale-110'
                    : 'bg-surface-2 hover:bg-surface-3'
                }`}
              >
                <AgentAvatar avatar={av} size={18} />
              </button>
            ))}
            {/* More icons button */}
            <button
              type="button"
              onClick={() => setShowIconPicker(true)}
              title={t('icons.moreIcons', 'Browse more icons')}
              className="w-9 h-9 rounded-lg flex items-center justify-center bg-surface-2 hover:bg-surface-3 text-text-muted hover:text-accent transition-all border border-dashed border-border-subtle"
            >
              <svg width={14} height={14} viewBox="0 0 24 24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg>
            </button>
          </div>
          {/* Show selected custom icon if not in presets */}
          {form.avatar && !AVATARS.includes(form.avatar) && (
            <div className="mt-2 flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-accent/20 ring-2 ring-accent flex items-center justify-center">
                <AgentAvatar avatar={form.avatar} size={18} />
              </div>
              <code className="text-xs text-text-muted">{form.avatar}</code>
            </div>
          )}
          {showIconPicker && (
            <IconPicker
              value={form.avatar}
              onSelect={(icon) => { updateForm({ avatar: icon }); setShowIconPicker(false) }}
              onClose={() => setShowIconPicker(false)}
            />
          )}
        </div>

        {/* Name + Model + Color */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('common.name', 'Name')}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateForm({ name: e.target.value })}
              placeholder={t('agents.namePlaceholder', 'e.g., Code Expert')}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('agents.model', 'Model')}</label>
            <select
              aria-label="Model"
              value={form.modelId}
              onChange={(e) => updateForm({ modelId: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
            >
              <option value="">{t('agents.selectModel', '-- Select Model --')}</option>
              {models.filter((m) => m.enabled).map((m) => {
                const providerName = providerConfigs.find((p) => p.id === m.provider)?.name || m.provider
                return <option key={m.id} value={m.id}>{providerName} / {m.name}</option>
              })}
            </select>
          </div>
        </div>

        {/* Color */}
        <div>
          <label htmlFor="agent-color" className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('agents.color', 'Color')}</label>
          <div className="flex items-center gap-3">
            <input
              id="agent-color"
              type="color"
              value={form.color || '#6366F1'}
              onChange={(e) => updateForm({ color: e.target.value })}
              aria-label={t('agents.color', 'Color')}
              title={t('agents.color', 'Color')}
              className="w-9 h-9 rounded-lg border border-border cursor-pointer bg-transparent"
            />
            <span className="text-xs text-text-muted font-mono">{form.color || '#6366F1'}</span>
            {form.color && (
              <button
                type="button"
                onClick={() => updateForm({ color: undefined })}
                className="text-[11px] text-text-muted hover:text-danger"
              >{t('common.reset', 'Reset')}</button>
            )}
          </div>
        </div>

        {/* System Prompt */}
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('agents.systemPrompt', 'System Prompt')}</label>
          <textarea
            value={form.systemPrompt}
            onChange={(e) => updateForm({ systemPrompt: e.target.value })}
            placeholder={t('agents.systemPromptPlaceholder', 'You are a helpful assistant that...')}
            rows={5}
            className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 resize-none text-sm leading-relaxed"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('agents.greeting', 'Greeting')}</label>
          <input
            type="text"
            value={form.greeting ?? ''}
            onChange={(e) => updateForm({ greeting: e.target.value })}
            placeholder={t('agents.greetingPlaceholder', 'Custom greeting for new chats')}
            className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
          />
        </div>

        {/* When To Use */}
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('agents.whenToUse', 'When To Use')}</label>
          <input
            type="text"
            value={form.whenToUse ?? ''}
            onChange={(e) => updateForm({ whenToUse: e.target.value })}
            placeholder={t('agents.whenToUsePlaceholder', 'e.g., When the user asks about code review or debugging')}
            className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
          />
          <p className="mt-1 text-[11px] text-text-muted">{t('agents.whenToUseHint', 'Describes when this agent should be selected. Helps with automatic agent routing.')}</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('agents.responseStyle', 'Response Style')}</label>
          <select
            aria-label="Response style"
            value={form.responseStyle ?? 'balanced'}
            onChange={(e) => updateForm({ responseStyle: e.target.value as Agent['responseStyle'] })}
            className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
          >
            <option value="concise">{t('agents.concise', 'Concise')}</option>
            <option value="balanced">{t('agents.balanced', 'Balanced')}</option>
            <option value="detailed">{t('agents.detailed', 'Detailed')}</option>
          </select>
        </div>

        {/* Temperature */}
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
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
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-[10px] text-text-muted">
            <span>{t('agents.precise', 'Precise (0)')}</span>
            <span>{t('agents.creative', 'Creative (2)')}</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('agents.maxTokens', 'Max Tokens')}</label>
          <input
            type="number"
            aria-label="Max tokens"
            value={form.maxTokens ?? 4096}
            onChange={(e) => updateForm({ maxTokens: parseInt(e.target.value) || 4096 })}
            min={256}
            max={128000}
            className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
          />
        </div>

        {/* Skills */}
        {skills.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('agents.skills', 'Skills')}</label>
            <div className="space-y-1.5 rounded-xl border border-border p-3 max-h-64 overflow-y-auto">
              {skills.map((skill) => {
                const hasPrompt = !!(skill.prompt?.trim())
                return (
                  <label key={skill.id} className="flex items-start gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form.skills.includes(skill.id)}
                      onChange={() => toggleSkill(skill.id)}
                      className="mt-0.5 w-4 h-4 rounded border-border text-accent focus:ring-accent/30 bg-surface-2 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                          {skill.name}
                        </span>
                        {!skill.enabled && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface-3 text-text-muted">OFF</span>
                        )}
                        {hasPrompt && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">prompt</span>
                        )}
                      </div>
                      {skill.description && (
                        <div className="text-[10px] text-text-muted leading-tight truncate">{skill.description}</div>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('agents.allowedTools', 'Allowed Tools')}</label>
          {availableTools.length === 0 ? (
            <p className="text-xs text-text-muted">{t('agents.selectSkillsFirst', 'Select one or more skills to expose tools.')}</p>
          ) : (
            <div className="space-y-1.5 rounded-xl border border-border p-3 max-h-48 overflow-y-auto">
              {availableTools.map((toolName) => (
                <label key={toolName} className="flex items-start gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={(form.allowedTools ?? []).includes(toolName)}
                    onChange={() => toggleAllowedTool(toolName)}
                    className="mt-0.5 w-4 h-4 rounded border-border text-accent focus:ring-accent/30 bg-surface-2 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-sm text-text-secondary group-hover:text-text-primary transition-colors font-mono">{toolName}</div>
                    {TOOL_DESCRIPTIONS[toolName] && (
                      <div className="text-[10px] text-text-muted leading-tight">{TOOL_DESCRIPTIONS[toolName]}</div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
          <p className="mt-1 text-[11px] text-text-muted">{t('agents.allowAllTools', 'Leave all unchecked to allow all tools from selected skills.')}</p>
        </div>

        {/* Disallowed Tools (denylist) */}
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('agents.disallowedTools', 'Disallowed Tools')}</label>
          <input
            type="text"
            value={(form.disallowedTools ?? []).join(', ')}
            onChange={(e) => {
              const val = e.target.value
              updateForm({
                disallowedTools: val.trim() ? val.split(',').map((s) => s.trim()).filter(Boolean) : [],
              })
            }}
            placeholder="shell, delete_file, git_push"
            className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm font-mono"
          />
          <p className="mt-1 text-[11px] text-text-muted">{t('agents.disallowedToolsHint', 'Comma-separated tool names that are always blocked for this agent.')}</p>
        </div>

        {/* Max Turns & Permission Mode */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('agents.maxTurns', 'Max Turns')}</label>
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
              className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
            />
            <p className="mt-1 text-[11px] text-text-muted">{t('agents.maxTurnsHint', 'Max agentic tool-use turns per request. Tool-enabled agents need at least 2 turns to reply after a tool result.')}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('agents.permissionMode', 'Permission Mode')}</label>
            <select
              aria-label="Permission mode"
              value={form.permissionMode ?? 'default'}
              onChange={(e) => updateForm({ permissionMode: e.target.value as Agent['permissionMode'] })}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
            >
              <option value="default">{t('agents.permDefault', 'Default — ask for dangerous ops')}</option>
              <option value="acceptEdits">{t('agents.permAcceptEdits', 'Accept Edits — auto-accept writes')}</option>
              <option value="plan">{t('agents.permPlan', 'Plan — require plan approval')}</option>
              <option value="bypassPermissions">{t('agents.permBypass', 'Bypass — allow all tools')}</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.autoLearn}
            onChange={(e) => updateForm({ autoLearn: e.target.checked })}
            className="w-4 h-4 rounded border-border text-accent focus:ring-accent/30 bg-surface-2"
          />
          <span className="text-sm text-text-secondary">{t('agents.enableAutoLearn', 'Enable self-learning from user feedback')}</span>
        </label>

        {!!form.memories?.length && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">{t('agents.learnedMemories', 'Learned Memories')}</label>
              <button
                type="button"
                onClick={() => {
                  clearAgentMemories(form.id)
                  updateForm({ memories: [] })
                }}
                className="text-[11px] text-danger hover:text-danger/80"
              >
                {t('agents.clearMemories', 'Clear all')}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select
                aria-label="Memory type filter"
                value={memoryFilter}
                onChange={(e) => setMemoryFilter(e.target.value as 'all' | 'insight' | 'preference' | 'correction' | 'knowledge')}
                className="px-2 py-1.5 rounded-lg bg-surface-2 border border-border text-xs text-text-secondary"
              >
                <option value="all">All types</option>
                <option value="insight">Insight</option>
                <option value="preference">Preference</option>
                <option value="correction">Correction</option>
                <option value="knowledge">Knowledge</option>
              </select>
              <input
                value={memoryQuery}
                onChange={(e) => setMemoryQuery(e.target.value)}
                placeholder={t('agents.searchMemories', 'Search memories')}
                  className="px-2 py-1.5 rounded-lg bg-surface-2 border border-border text-xs text-text-secondary"
              />
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto rounded-xl border border-border p-2">
              {filteredMemories.map((memory) => (
                <div key={memory.id} className="rounded-lg bg-surface-2 p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-text-muted uppercase tracking-wider text-[10px]">{memory.type}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingMemoryId(memory.id)}
                        className="text-text-muted hover:text-accent"
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
                        className="text-text-muted hover:text-danger"
                      >
                        <IconifyIcon name="ui-close" size={14} color="currentColor" />
                      </button>
                    </div>
                  </div>
                  {editingMemoryId === memory.id ? (
                    <div className="mt-1 space-y-1">
                      <textarea
                        aria-label={t('agents.editMemory', 'Edit memory content')}
                        value={memory.content}
                        onChange={(e) => {
                          const updated = form.memories.map((m) =>
                            m.id === memory.id ? { ...m, content: e.target.value } : m
                          )
                          updateForm({ memories: updated })
                        }}
                        rows={2}
                        className="w-full px-2 py-1 rounded-lg bg-surface-0 border border-border text-text-secondary"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          // Persist the edited memory content to the store immediately
                          if (agent) {
                            updateAgent(form.id, { memories: form.memories })
                          }
                          setEditingMemoryId(null)
                        }}
                        className="text-[11px] text-success"
                      >
                        {t('common.done', 'Done')}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 text-text-secondary">{memory.content}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enabled */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => updateForm({ enabled: e.target.checked })}
            className="w-4 h-4 rounded border-border text-accent focus:ring-accent/30 bg-surface-2"
          />
          <span className="text-sm text-text-secondary">{t('common.enabled', 'Enabled')}</span>
        </label>

        {/* Actions */}
        {validationError && (
          <p className="text-xs text-danger">{validationError}</p>
        )}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover hover:shadow-[0_4px_20px_rgba(var(--t-accent-rgb),0.25)] transition-all"
          >
            {agent ? 'Save Changes' : 'Create Agent'}
          </button>
          {agent && onTest && (
            <button
              type="button"
              onClick={() => onTest(form)}
              className="px-5 py-2.5 rounded-xl bg-surface-2 border border-accent/30 text-accent text-sm font-medium hover:bg-accent/10 transition-colors inline-flex items-center gap-1.5"
            >
              <IconifyIcon name="ui-test-tube" size={14} color="currentColor" /> {t('common.test', 'Test')}
            </button>
          )}
          <button
            type="button"
            onClick={handleCancel}
            className="px-5 py-2.5 rounded-xl bg-surface-3 text-text-secondary text-sm font-medium hover:bg-surface-4 transition-colors"
          >
            {t('common.cancel', 'Cancel')}
          </button>
        </div>
      </div>
    </form>
  )
}
