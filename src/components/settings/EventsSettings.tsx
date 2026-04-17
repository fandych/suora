import { useState, useEffect } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { loadTriggers, addTrigger, removeTrigger, resolvePromptTemplate, getAgentName } from '@/services/eventAutomation'
import { generateId } from '@/utils/helpers'
import type { EventTrigger } from '@/types'

export function EventsSettings() {
  const { t } = useI18n()
  const [triggers, setTriggers] = useState<EventTrigger[]>([])
  const [triggerForm, setTriggerForm] = useState({ name: '', type: 'clipboard_change' as EventTrigger['type'], pattern: '', agentId: '', promptTemplate: '' })

  useEffect(() => {
    setTriggers(loadTriggers())
  }, [])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border p-4 bg-surface-0/30">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{t('settings.eventTriggers', 'Event Triggers')}</h3>
        <p className="text-xs text-text-muted mb-4">{t('settings.eventTriggersDesc', 'Create triggers that automatically send prompts to agents when events occur.')}</p>

        <div className="space-y-2 mb-4">
          {triggers.length === 0 && <p className="text-xs text-text-muted">{t('settings.noTriggers', 'No event triggers configured.')}</p>}
          {triggers.map((tr) => (
            <div key={tr.id} className="flex items-center justify-between bg-surface-2 rounded-lg px-3 py-2 text-xs">
              <div className="flex-1 min-w-0">
                <span className="font-medium text-text-primary">{tr.name}</span>
                <span className="ml-2 px-1.5 py-0.5 rounded bg-accent/15 text-accent font-mono">{tr.type}</span>
                <span className="ml-2 text-text-muted">→ {getAgentName(tr.agentId)}</span>
                {tr.pattern && <span className="ml-2 text-text-muted/60">pattern: {tr.pattern}</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className={`w-2 h-2 rounded-full ${tr.enabled ? 'bg-success' : 'bg-text-muted/30'}`} />
                <button
                  onClick={() => { removeTrigger(tr.id); setTriggers(loadTriggers()) }}
                  className="text-danger hover:text-danger/80 font-medium"
                >
                  {t('settings.delete', 'Delete')}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border-subtle pt-4 space-y-3">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t('settings.newTrigger', 'New Trigger')}</h4>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={triggerForm.name}
              onChange={(e) => setTriggerForm({ ...triggerForm, name: e.target.value })}
              placeholder={t('settings.triggerName', 'Trigger name')}
              className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-text-primary text-sm"
            />
            <select
              value={triggerForm.type}
              onChange={(e) => setTriggerForm({ ...triggerForm, type: e.target.value as EventTrigger['type'] })}
              aria-label="Trigger type"
              className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-text-primary text-sm"
            >
              <option value="clipboard_change">{t('settings.clipboardChange', 'Clipboard Change')}</option>
              <option value="file_change">{t('settings.fileChange', 'File Change')}</option>
              <option value="app_start">{t('settings.appStart', 'App Start')}</option>
              <option value="schedule">{t('settings.schedule', 'Schedule')}</option>
            </select>
          </div>
          {(triggerForm.type === 'file_change' || triggerForm.type === 'schedule') && (
            <input
              value={triggerForm.pattern}
              onChange={(e) => setTriggerForm({ ...triggerForm, pattern: e.target.value })}
              placeholder={triggerForm.type === 'file_change' ? 'File pattern (e.g., *.json)' : 'Cron expression'}
              className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-text-primary text-sm"
            />
          )}
          <input
            value={triggerForm.agentId}
            onChange={(e) => setTriggerForm({ ...triggerForm, agentId: e.target.value })}
            placeholder="Agent ID (e.g., default-assistant)"
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-text-primary text-sm"
          />
          <textarea
            value={triggerForm.promptTemplate}
            onChange={(e) => setTriggerForm({ ...triggerForm, promptTemplate: e.target.value })}
            placeholder="Prompt template (use {{content}}, {{file}} placeholders)"
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-text-primary text-sm resize-none"
          />
          <button
            onClick={() => {
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
              setTriggers(loadTriggers())
              setTriggerForm({ name: '', type: 'clipboard_change', pattern: '', agentId: '', promptTemplate: '' })
            }}
            disabled={!triggerForm.name || !triggerForm.agentId || !triggerForm.promptTemplate}
            className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-40"
          >
            {t('settings.addTrigger', 'Add Trigger')}
          </button>
        </div>
      </div>
      <div className="text-xs text-text-muted">
        <p><strong>Placeholders:</strong> {'{{content}}'} = event content, {'{{file}}'} = file path, {'{{previous}}'} = previous clipboard content</p>
        <p className="mt-1">Example: &quot;Summarize this clipboard content: {'{{content}}'}&quot;</p>
        <p className="mt-1">Preview: {triggerForm.promptTemplate ? resolvePromptTemplate(triggerForm.promptTemplate, { content: '(sample)', file: '/path/to/file' }) : '—'}</p>
      </div>
    </div>
  )
}
