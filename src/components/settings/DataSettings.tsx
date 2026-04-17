import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import type { Agent, Skill, Session } from '@/types'
import { confirm } from '@/services/confirmDialog'
import { toast } from '@/services/toast'

export function DataSettings() {
  const { t } = useI18n()
  const { historyRetentionDays, setHistoryRetentionDays } = useAppStore()

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border p-4 bg-surface-0/30">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{t('settings.exportData', 'Export Data')}</h3>
        <p className="text-xs text-text-muted mb-3">
          {t('settings.exportDataDesc', 'Export your agents, skills, sessions, and settings to a JSON file for backup or transfer.')}
        </p>
        <button
          onClick={() => {
            const { agents, skills, sessions, providerConfigs, externalDirectories } = useAppStore.getState()
            const exportData = {
              version: '1.0',
              exportedAt: new Date().toISOString(),
              agents: agents.filter(a => !a.id.startsWith('builtin-') && a.id !== 'default-assistant'),
              skills: skills.filter(s => s.type === 'custom'),
              sessions,
              providerConfigs,
              externalDirectories,
            }
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `suora-export-${Date.now()}.json`
            a.click()
            URL.revokeObjectURL(url)
          }}
          className="px-5 py-2.5 rounded-xl bg-accent/15 text-accent text-sm font-medium hover:bg-accent/25 transition-colors border border-accent/30 inline-flex items-center gap-1.5"
        >
          <IconifyIcon name="ui-export" size={14} color="currentColor" /> {t('settings.exportAll', 'Export All Data')}
        </button>
      </div>

      <div className="rounded-xl border border-border p-4 bg-surface-0/30">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{t('settings.importData', 'Import Data')}</h3>
        <p className="text-xs text-text-muted mb-3">
          {t('settings.importDataDesc', 'Import agents, skills, and settings from a previously exported JSON file.')}
        </p>
        <input
          type="file"
          accept=".json"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const input = e.target
            const reader = new FileReader()
            reader.onload = async () => {
              try {
                const data = JSON.parse(reader.result as string)
                if (!data || typeof data !== 'object' || Array.isArray(data)) {
                  throw new Error('Invalid file format — expected a JSON object')
                }
                const agents = Array.isArray(data.agents) ? data.agents : []
                const skills = Array.isArray(data.skills) ? data.skills : []
                const sessions = Array.isArray(data.sessions) ? data.sessions : []
                const hasProviders = data.providerConfigs && Array.isArray(data.providerConfigs)
                const total = agents.length + skills.length + sessions.length + (hasProviders ? 1 : 0)
                if (total === 0) {
                  toast.warning(t('settings.importEmpty', 'Nothing to import from this file.'))
                  input.value = ''
                  return
                }
                const summary = [
                  agents.length && `${agents.length} agent(s)`,
                  skills.length && `${skills.length} skill(s)`,
                  sessions.length && `${sessions.length} session(s)`,
                  hasProviders && 'provider configs (will overwrite current)',
                ].filter(Boolean).join(', ')
                const ok = await confirm({
                  title: t('settings.importTitle', 'Import data?'),
                  body: t(
                    'settings.importBody',
                    `About to import: ${summary}. Existing items with the same IDs may be duplicated or overwritten.`,
                  ),
                  confirmText: t('settings.importConfirm', 'Import'),
                })
                if (!ok) { input.value = ''; return }
                const { addAgent, addSkill, addSession, setProviderConfigs, syncModelsFromConfigs } = useAppStore.getState()
                agents.forEach((agent: Agent) => addAgent(agent))
                skills.forEach((skill: Skill) => addSkill(skill))
                sessions.forEach((session: Session) => addSession(session))
                if (hasProviders) { setProviderConfigs(data.providerConfigs); syncModelsFromConfigs() }
                toast.success(t('settings.importSuccess', 'Data imported successfully!'), summary)
                input.value = ''
              } catch (err) {
                toast.error(
                  t('settings.importFailed', 'Failed to import data'),
                  err instanceof Error ? err.message : String(err),
                )
                input.value = ''
              }
            }
            reader.onerror = () => {
              toast.error(
                t('settings.importFailed', 'Failed to import data'),
                reader.error?.message ?? 'Could not read file',
              )
              input.value = ''
            }
            reader.readAsText(file)
          }}
          className="hidden"
          id="import-data-file"
        />
        <label
          htmlFor="import-data-file"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-surface-3 text-text-secondary text-sm font-medium hover:bg-surface-4 transition-colors cursor-pointer"
        >
          <IconifyIcon name="ui-import" size={14} color="currentColor" /> {t('settings.importData', 'Import Data')}
        </label>
      </div>

      <div className="rounded-xl border border-border p-4 bg-surface-0/30">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{t('settings.historyRetention', 'History Retention')}</h3>
        <p className="text-xs text-text-muted mb-3">
          {t('settings.historyRetentionDesc', 'Automatically delete conversations older than the specified number of days. Set to 0 to keep all history.')}
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0} max={3650}
            value={historyRetentionDays}
            onChange={(e) => setHistoryRetentionDays(Math.max(0, parseInt(e.target.value) || 0))}
            aria-label="History retention days"
            className="w-24 px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <span className="text-sm text-text-muted">{t('settings.days', 'days')}</span>
          {historyRetentionDays > 0 && (
            <button
              onClick={async () => {
                const cutoff = Date.now() - historyRetentionDays * 86400000
                const { sessions, removeSession } = useAppStore.getState()
                const old = sessions.filter((s) => s.updatedAt < cutoff)
                if (old.length === 0) { toast.info(t('settings.noOldSessions', 'No sessions older than the retention period.')); return }
                const ok = await confirm({
                  title: t('settings.cleanTitle', 'Delete old conversations?'),
                  body: t('settings.cleanBody', `${old.length} session(s) older than ${historyRetentionDays} days will be permanently deleted.`),
                  danger: true,
                  confirmText: t('common.delete', 'Delete'),
                })
                if (!ok) return
                old.forEach((s) => removeSession(s.id))
                toast.success(t('settings.cleanDone', `Deleted ${old.length} session(s).`))
              }}
              className="px-3 py-2 rounded-xl bg-warning/10 text-warning text-xs font-medium hover:bg-warning/20 transition-colors"
            >
              {t('settings.cleanNow', 'Clean Now')}
            </button>
          )}
        </div>
        {historyRetentionDays > 0 && (
          <p className="mt-2 text-[11px] text-text-muted">{t('settings.autoCleanDesc', 'Sessions will be auto-cleaned when you open the app.')}</p>
        )}
      </div>

      <div className="rounded-xl border border-border p-4 bg-surface-0/30">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{t('settings.clearData', 'Clear Data')}</h3>
        <p className="text-xs text-text-muted mb-3">
          {t('settings.clearDataDesc', 'Permanently delete all chat history and sessions. This cannot be undone.')}
        </p>
        <button
          onClick={async () => {
            const ok = await confirm({
              title: t('settings.clearTitle', 'Clear all chat history?'),
              body: t('settings.clearConfirm', 'Are you sure you want to delete all chat history? This cannot be undone.'),
              danger: true,
              confirmText: t('common.delete', 'Delete'),
            })
            if (!ok) return
            const { sessions } = useAppStore.getState()
            sessions.forEach(session => useAppStore.getState().removeSession(session.id))
            toast.success(t('settings.clearDone', 'All chat history has been cleared.'))
          }}
          className="px-5 py-2.5 rounded-xl bg-danger/10 text-danger text-sm font-medium hover:bg-danger/20 transition-colors inline-flex items-center gap-1.5"
        >
          <IconifyIcon name="ui-trash" size={14} color="currentColor" /> {t('settings.clearAllHistory', 'Clear All Chat History')}
        </button>
      </div>
    </div>
  )
}
