import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { useAppStore } from '@/store/appStore'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { loadTriggers, addTrigger, removeTrigger, resolvePromptTemplate, updateTrigger } from '@/services/eventAutomation'
import { generateId } from '@/utils/helpers'
import type { EventTrigger } from '@/types'
import { SettingsSection, SettingsStat, settingsInputClass, settingsTextAreaClass } from './panelUi'

function getTriggerTypeLabel(type: EventTrigger['type'], t: (key: string, fallback: string) => string) {
  switch (type) {
    case 'clipboard_change':
      return t('settings.clipboardChange', 'Clipboard Change')
    case 'file_change':
      return t('settings.fileChange', 'File Change')
    case 'app_start':
      return t('settings.appStart', 'App Start')
    case 'schedule':
      return t('settings.schedule', 'Schedule')
    default:
      return type
  }
}

function formatRelativeTime(value?: number) {
  if (!value) return 'Never'
  const diff = Date.now() - value
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`
  if (diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))}h ago`
  if (diff < 604_800_000) return `${Math.max(1, Math.floor(diff / 86_400_000))}d ago`
  return new Date(value).toLocaleDateString()
}

export function EventsSettings() {
  const { t } = useI18n()
  const { agents } = useAppStore()
  const [triggers, setTriggers] = useState<EventTrigger[]>([])
  const enabledAgents = useMemo(() => agents.filter((agent) => agent.enabled !== false), [agents])
  const [triggerForm, setTriggerForm] = useState({
    name: '',
    type: 'clipboard_change' as EventTrigger['type'],
    pattern: '',
    agentId: '',
    promptTemplate: '',
  })

  const reloadTriggers = () => setTriggers(loadTriggers())

  useEffect(() => {
    reloadTriggers()
  }, [])

  useEffect(() => {
    if (triggerForm.agentId || enabledAgents.length === 0) return
    setTriggerForm((prev) => (prev.agentId ? prev : { ...prev, agentId: enabledAgents[0]?.id || '' }))
  }, [enabledAgents, triggerForm.agentId])

  const totalTriggers = triggers.length
  const enabledTriggers = triggers.filter((trigger) => trigger.enabled).length
  const activeSchedules = triggers.filter((trigger) => trigger.type === 'schedule').length
  const agentNameMap = useMemo(() => new Map(agents.map((agent) => [agent.id, agent.name])), [agents])
  const preview = triggerForm.promptTemplate
    ? resolvePromptTemplate(triggerForm.promptTemplate, {
        content: '(sample content)',
        file: '/path/to/file.ts',
        previous: '(previous content)',
      })
    : '—'

  const createTrigger = () => {
    if (!triggerForm.name || !triggerForm.agentId || !triggerForm.promptTemplate) return

    addTrigger({
      id: generateId('evt'),
      name: triggerForm.name,
      type: triggerForm.type,
      pattern: triggerForm.pattern || undefined,
      agentId: triggerForm.agentId,
      promptTemplate: triggerForm.promptTemplate,
      enabled: true,
      createdAt: Date.now(),
    })
    reloadTriggers()
    setTriggerForm({
      name: '',
      type: 'clipboard_change',
      pattern: '',
      agentId: enabledAgents[0]?.id || '',
      promptTemplate: '',
    })
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        eyebrow={t('settings.eventTriggers', 'Event Triggers')}
        title={t('settings.automationRules', 'Automation Rules')}
        description={t('settings.eventTriggersDesc', 'Create triggers that automatically send prompts to agents when specific desktop events occur.')}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <SettingsStat label={t('common.total', 'Total')} value={String(totalTriggers)} accent />
          <SettingsStat label={t('settings.enabled', 'Enabled')} value={String(enabledTriggers)} />
          <SettingsStat label={t('settings.schedule', 'Schedule')} value={String(activeSchedules)} />
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.currentRules', 'Current Rules')}
        title={t('settings.liveTriggers', 'Live Triggers')}
        description={t('settings.liveTriggersHint', 'Each trigger maps a system event to an agent prompt, so you can automate routine reactions without opening chat manually.')}
      >
        {triggers.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/65 text-text-muted/60">
              <IconifyIcon name="ui-gear" size={18} color="currentColor" />
            </div>
            <p className="text-[12px] leading-relaxed text-text-muted">{t('settings.noTriggers', 'No event triggers configured.')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {triggers.map((trigger) => {
              const typeLabel = getTriggerTypeLabel(trigger.type, t)
              return (
                <div key={trigger.id} className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-semibold text-text-primary">{trigger.name}</span>
                        <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[10px] font-medium text-accent">{typeLabel}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${trigger.enabled ? 'bg-green-500/12 text-green-400' : 'bg-surface-3 text-text-muted'}`}>{trigger.enabled ? t('settings.enabled', 'Enabled') : t('settings.disabled', 'Disabled')}</span>
                      </div>
                      <div className="mt-2 text-[12px] leading-6 text-text-secondary/80">
                        {t('settings.routesToAgent', 'Routes to')} <span className="font-medium text-text-primary">{agentNameMap.get(trigger.agentId) || trigger.agentId}</span>
                        {trigger.pattern && <span> · {trigger.pattern}</span>}
                      </div>
                      <div className="mt-3 rounded-2xl border border-border-subtle/45 bg-surface-2/70 px-3 py-2 text-[11px] leading-6 text-text-secondary">{trigger.promptTemplate}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { updateTrigger(trigger.id, { enabled: !trigger.enabled }); reloadTriggers() }}
                        className={`rounded-xl border px-3 py-2 text-[11px] font-semibold transition-colors ${trigger.enabled ? 'border-green-500/18 bg-green-500/10 text-green-400 hover:bg-green-500/16' : 'border-border-subtle/55 bg-surface-2/70 text-text-muted hover:bg-surface-3'}`}
                      >
                        {trigger.enabled ? t('settings.pause', 'Pause') : t('settings.enable', 'Enable')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { removeTrigger(trigger.id); reloadTriggers() }}
                        className="rounded-xl border border-red-500/18 bg-red-500/8 px-3 py-2 text-[11px] font-semibold text-red-400 transition-colors hover:bg-red-500/14"
                      >
                        {t('settings.delete', 'Delete')}
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-text-muted/70">
                    <span>{t('settings.created', 'Created')}: {new Date(trigger.createdAt).toLocaleString()}</span>
                    <span>{t('settings.lastTriggered', 'Last triggered')}: {formatRelativeTime(trigger.lastTriggered)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.newTrigger', 'New Trigger')}
        title={t('settings.composeTrigger', 'Compose Trigger')}
        description={t('settings.composeTriggerHint', 'Choose an event source, select the receiving agent, and define the prompt template that should be sent when the rule fires.')}
        action={
          <button
            type="button"
            onClick={createTrigger}
            disabled={!triggerForm.name || !triggerForm.agentId || !triggerForm.promptTemplate}
            className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(var(--t-accent-rgb),0.22)] transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            {t('settings.addTrigger', 'Add Trigger')}
          </button>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('settings.triggerName', 'Trigger name')}</span>
            <input
              value={triggerForm.name}
              onChange={(event) => setTriggerForm({ ...triggerForm, name: event.target.value })}
              placeholder={t('settings.triggerName', 'Trigger name')}
              className={settingsInputClass}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('settings.triggerType', 'Trigger type')}</span>
            <select
              value={triggerForm.type}
              onChange={(event) => setTriggerForm({ ...triggerForm, type: event.target.value as EventTrigger['type'] })}
              aria-label={t('settings.triggerType', 'Trigger type')}
              className={settingsInputClass}
            >
              <option value="clipboard_change">{t('settings.clipboardChange', 'Clipboard Change')}</option>
              <option value="file_change">{t('settings.fileChange', 'File Change')}</option>
              <option value="app_start">{t('settings.appStart', 'App Start')}</option>
              <option value="schedule">{t('settings.schedule', 'Schedule')}</option>
            </select>
          </label>
        </div>

        {(triggerForm.type === 'file_change' || triggerForm.type === 'schedule') && (
          <label className="block">
            <span className="mb-2 block text-[12px] font-medium text-text-muted">{triggerForm.type === 'file_change' ? t('settings.filePattern', 'File pattern') : t('settings.cronExpression', 'Cron expression')}</span>
            <input
              value={triggerForm.pattern}
              onChange={(event) => setTriggerForm({ ...triggerForm, pattern: event.target.value })}
              placeholder={triggerForm.type === 'file_change' ? 'File pattern (e.g., *.json)' : 'Cron expression'}
              className={settingsInputClass}
            />
          </label>
        )}

        <label className="block">
          <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('settings.targetAgent', 'Target agent')}</span>
          <select
            value={triggerForm.agentId}
            onChange={(event) => setTriggerForm({ ...triggerForm, agentId: event.target.value })}
            aria-label={t('settings.targetAgent', 'Target agent')}
            className={settingsInputClass}
          >
            {enabledAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('settings.promptTemplate', 'Prompt template')}</span>
          <textarea
            value={triggerForm.promptTemplate}
            onChange={(event) => setTriggerForm({ ...triggerForm, promptTemplate: event.target.value })}
            placeholder={t('settings.promptTemplatePlaceholder', 'Prompt template (use {{content}}, {{file}}, {{previous}} placeholders)')}
            rows={4}
            className={settingsTextAreaClass}
          />
        </label>

        <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-4 text-[12px] leading-6 text-text-secondary/80">
          <div className="font-medium text-text-primary">{t('settings.placeholders', 'Placeholders')}</div>
          <p className="mt-2"><strong>{'{{content}}'}</strong> = {t('settings.placeholderContent', 'event content')} · <strong>{'{{file}}'}</strong> = {t('settings.placeholderFile', 'file path')} · <strong>{'{{previous}}'}</strong> = {t('settings.placeholderPrevious', 'previous clipboard content')}</p>
          <p className="mt-3 font-medium text-text-primary">{t('settings.preview', 'Preview')}</p>
          <div className="mt-2 rounded-2xl border border-border-subtle/45 bg-surface-2/70 px-3 py-2 text-[11px] text-text-secondary">{preview}</div>
        </div>
      </SettingsSection>
    </div>
  )
}
