import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { runAgentEdit, type AgentEditTarget } from '@/services/agentEditing'
import { toast } from '@/services/toast'

export function AgentEditAssistant({
  target,
  title,
  currentContent,
  onApply,
}: {
  target: AgentEditTarget
  title: string
  currentContent: string
  onApply: (content: string) => void
}) {
  const { t } = useI18n()
  const { agents, models, skills, selectedAgent, selectedModel } = useAppStore()
  const enabledAgents = useMemo(() => agents.filter((agent) => agent.enabled !== false), [agents])
  const initialAgentId = selectedAgent && enabledAgents.some((agent) => agent.id === selectedAgent.id)
    ? selectedAgent.id
    : enabledAgents[0]?.id ?? ''
  const [agentId, setAgentId] = useState(initialAgentId)
  const [instruction, setInstruction] = useState('')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    if (agentId && enabledAgents.some((agent) => agent.id === agentId)) return
    setAgentId(enabledAgents[0]?.id ?? '')
  }, [agentId, enabledAgents])

  const activeAgent = enabledAgents.find((agent) => agent.id === agentId) ?? null
  const activeModel = activeAgent?.modelId
    ? models.find((model) => model.id === activeAgent.modelId) ?? selectedModel
    : selectedModel
  const canRun = Boolean(activeAgent && activeModel && instruction.trim() && currentContent.trim())

  const handleRun = async () => {
    if (!activeAgent || !activeModel) {
      setError(t('agentEdit.noAgentOrModel', 'Select an agent and model before editing.'))
      return
    }
    setIsRunning(true)
    setError('')
    setDraft('')
    try {
      const next = await runAgentEdit({
        target,
        title,
        currentContent,
        instruction,
        agent: activeAgent,
        model: activeModel,
        skills,
      })
      setDraft(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsRunning(false)
    }
  }

  const handleApply = () => {
    if (!draft.trim()) return
    onApply(draft)
    setDraft('')
    setInstruction('')
    toast.success(t('agentEdit.applied', 'Agent edit applied'))
  }

  return (
    <section className="rounded-3xl border border-accent/15 bg-gradient-to-br from-accent/10 via-surface-0/62 to-surface-2/50 p-4 shadow-[0_16px_42px_rgba(var(--t-accent-rgb),0.08)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-accent/20 bg-accent/12 text-accent">
          <IconifyIcon name="agent-robot" size={20} color="currentColor" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">{t('agentEdit.title', 'Agent Edit')}</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-text-secondary/78">
            {target === 'skill'
              ? t('agentEdit.skillHint', 'Use an agent to rewrite this skill instruction body.')
              : t('agentEdit.documentHint', 'Use an agent to rewrite the current Markdown document.')}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <select
          value={agentId}
          onChange={(event) => setAgentId(event.target.value)}
          className="w-full rounded-2xl border border-border-subtle/60 bg-surface-2/75 px-3 py-2 text-[12px] text-text-primary outline-none focus:border-accent/30 focus:ring-2 focus:ring-accent/10"
          aria-label={t('agentEdit.selectAgent', 'Select agent')}
        >
          {enabledAgents.length === 0 ? (
            <option value="">{t('agentEdit.noAgents', 'No enabled agents')}</option>
          ) : enabledAgents.map((agent) => (
            <option key={agent.id} value={agent.id}>{agent.name}</option>
          ))}
        </select>

        <textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          rows={4}
          className="w-full resize-none rounded-2xl border border-border-subtle/60 bg-surface-2/75 px-3 py-2.5 text-[12px] leading-5 text-text-primary outline-none placeholder:text-text-muted/55 focus:border-accent/30 focus:ring-2 focus:ring-accent/10"
          placeholder={target === 'skill'
            ? t('agentEdit.skillPlaceholder', 'Example: make this skill clearer, add activation rules, and keep it concise…')
            : t('agentEdit.documentPlaceholder', 'Example: reorganize this note, improve clarity, and preserve all facts…')}
        />

        <button
          type="button"
          onClick={handleRun}
          disabled={!canRun || isRunning}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-3 py-2.5 text-[12px] font-semibold text-white shadow-[0_10px_24px_rgba(var(--t-accent-rgb),0.18)] transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45"
        >
          <IconifyIcon name={isRunning ? 'ui-loading' : 'lucide:sparkles'} size={14} color="currentColor" />
          {isRunning ? t('agentEdit.running', 'Editing…') : t('agentEdit.run', 'Edit with Agent')}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-2xl border border-danger/20 bg-danger/8 px-3 py-2 text-[11px] leading-relaxed text-danger">{error}</p>
      )}

      {draft && (
        <div className="mt-4 rounded-3xl border border-border-subtle/55 bg-surface-0/72 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">{t('agentEdit.preview', 'Preview')}</span>
            <button
              type="button"
              onClick={handleApply}
              className="rounded-xl bg-accent/15 px-2.5 py-1.5 text-[11px] font-semibold text-accent hover:bg-accent/25"
            >
              {t('agentEdit.apply', 'Apply')}
            </button>
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl bg-surface-2/72 p-3 font-[var(--font-code)] text-[11px] leading-5 text-text-secondary">
            {draft}
          </pre>
        </div>
      )}
    </section>
  )
}
