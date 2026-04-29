import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import type { Agent, ProviderConfig, Skill, Session } from '@/types'
import { confirm } from '@/services/confirmDialog'
import { toast } from '@/services/toast'
import { safeParse, safeStringify } from '@/utils/safeJson'
import { SettingsSection, SettingsStat, settingsInputClass } from './panelUi'

const PROVIDER_TYPES = new Set<ProviderConfig['providerType']>([
  'anthropic',
  'openai',
  'google',
  'ollama',
  'deepseek',
  'zhipu',
  'minimax',
  'groq',
  'together',
  'fireworks',
  'perplexity',
  'cohere',
  'openai-compatible',
])
const MAX_IMPORTED_PROVIDER_MODELS = 500

function coerceProviderConfig(value: unknown): ProviderConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const config = value as Partial<ProviderConfig>
  if (
    typeof config.id !== 'string'
    || typeof config.name !== 'string'
    || typeof config.apiKey !== 'string'
    || typeof config.baseUrl !== 'string'
    || typeof config.providerType !== 'string'
    || !PROVIDER_TYPES.has(config.providerType as ProviderConfig['providerType'])
    || !Array.isArray(config.models)
    || config.models.length > MAX_IMPORTED_PROVIDER_MODELS
  ) return null

  const models: ProviderConfig['models'] = []
  for (const model of config.models) {
    if (
      !model
      || typeof model !== 'object'
      || typeof model.modelId !== 'string'
      || typeof model.name !== 'string'
      || typeof model.enabled !== 'boolean'
      || (model.temperature !== undefined && typeof model.temperature !== 'number')
      || (model.maxTokens !== undefined && typeof model.maxTokens !== 'number')
    ) return null

    models.push({
      modelId: model.modelId,
      name: model.name,
      enabled: model.enabled,
      ...(model.temperature === undefined ? {} : { temperature: model.temperature }),
      ...(model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens }),
    })
  }

  return {
    id: config.id,
    name: config.name,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    providerType: config.providerType as ProviderConfig['providerType'],
    models,
  }
}

export function DataSettings() {
  const { t } = useI18n()
  const { historyRetentionDays, setHistoryRetentionDays, agents, skills, sessions, providerConfigs, externalDirectories } = useAppStore()

  const customAgentCount = agents.filter((agent) => !agent.id.startsWith('builtin-') && agent.id !== 'default-assistant').length
  const customSkillCount = skills.filter((skill) => skill.type === 'custom').length

  const handleExport = () => {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      agents: agents.filter((agent) => !agent.id.startsWith('builtin-') && agent.id !== 'default-assistant'),
      skills: skills.filter((skill) => skill.type === 'custom'),
      sessions,
      providerConfigs,
      externalDirectories,
    }
    const blob = new Blob([safeStringify(exportData, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `suora-export-${Date.now()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const input = e.target
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const data = safeParse<Record<string, unknown>>(reader.result as string)
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error('Invalid file format — expected a JSON object')
        }
        const importAgents = Array.isArray(data.agents) ? data.agents : []
        const importSkills = Array.isArray(data.skills) ? data.skills : []
        const importSessions = Array.isArray(data.sessions) ? data.sessions : []
        const importProviderConfigs = Array.isArray(data.providerConfigs)
          ? data.providerConfigs.map(coerceProviderConfig).filter((config): config is ProviderConfig => config !== null)
          : []
        const hasProviders = importProviderConfigs.length > 0
        const total = importAgents.length + importSkills.length + importSessions.length + (hasProviders ? 1 : 0)
        if (total === 0) {
          toast.warning(t('settings.importEmpty', 'Nothing to import from this file.'))
          input.value = ''
          return
        }
        const summary = [
          importAgents.length && `${importAgents.length} agent(s)`,
          importSkills.length && `${importSkills.length} skill(s)`,
          importSessions.length && `${importSessions.length} session(s)`,
          hasProviders && 'provider configs (will overwrite current)',
        ].filter(Boolean).join(', ')
        const ok = await confirm({
          title: t('settings.importTitle', 'Import data?'),
          body: t('settings.importBody', `About to import: ${summary}. Existing items with the same IDs may be duplicated or overwritten.`),
          confirmText: t('settings.importConfirm', 'Import'),
        })
        if (!ok) { input.value = ''; return }
        const { addAgent, addSkill, addSession, setProviderConfigs, syncModelsFromConfigs } = useAppStore.getState()
        importAgents.forEach((agent: Agent) => addAgent(agent))
        importSkills.forEach((skill: Skill) => addSkill(skill))
        importSessions.forEach((session: Session) => addSession(session))
        if (hasProviders) { setProviderConfigs(importProviderConfigs); syncModelsFromConfigs() }
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
  }

  const cleanOldSessions = async () => {
    const cutoff = Date.now() - historyRetentionDays * 86400000
    const { sessions: allSessions, removeSession } = useAppStore.getState()
    const old = allSessions.filter((session) => session.updatedAt < cutoff)
    if (old.length === 0) {
      toast.info(t('settings.noOldSessions', 'No sessions older than the retention period.'))
      return
    }
    const ok = await confirm({
      title: t('settings.cleanTitle', 'Delete old conversations?'),
      body: t('settings.cleanBody', `${old.length} session(s) older than ${historyRetentionDays} days will be permanently deleted.`),
      danger: true,
      confirmText: t('common.delete', 'Delete'),
    })
    if (!ok) return
    old.forEach((session) => removeSession(session.id))
    toast.success(t('settings.cleanDone', `Deleted ${old.length} session(s).`))
  }

  const clearAllData = async () => {
    const ok = await confirm({
      title: t('settings.clearTitle', 'Clear all chat history?'),
      body: t('settings.clearConfirm', 'Are you sure you want to delete all chat history? This cannot be undone.'),
      danger: true,
      confirmText: t('common.delete', 'Delete'),
    })
    if (!ok) return
    const { sessions: allSessions } = useAppStore.getState()
    allSessions.forEach((session) => useAppStore.getState().removeSession(session.id))
    toast.success(t('settings.clearDone', 'All chat history has been cleared.'))
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        eyebrow={t('settings.data', 'Data')}
        title={t('settings.backupRetentionAndCleanup', 'Backup, Retention & Cleanup')}
        description={t('settings.backupRetentionAndCleanupHint', 'Move data safely between workspaces, keep history under control, and make destructive actions unmistakably explicit.')}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SettingsStat label={t('settings.agents', 'Agents')} value={String(customAgentCount)} accent />
          <SettingsStat label={t('settings.skills', 'Skills')} value={String(customSkillCount)} />
          <SettingsStat label={t('settings.sessions', 'Sessions')} value={String(sessions.length)} />
          <SettingsStat label={t('settings.providers', 'Providers')} value={String(providerConfigs.length)} />
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.backups', 'Backups')}
        title={t('settings.portableSnapshots', 'Portable Snapshots')}
        description={t('settings.portableSnapshotsHint', 'Export a clean workspace snapshot for migration or safekeeping, then restore it on another machine when needed.')}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.exportData', 'Export Data')}</div>
            <h4 className="mt-2 text-[17px] font-semibold text-text-primary">{t('settings.createBackup', 'Create Backup')}</h4>
            <p className="mt-2 text-[12px] leading-6 text-text-secondary/80">{t('settings.exportDataDesc', 'Export your agents, skills, sessions, and settings to a JSON file for backup or transfer.')}</p>
            <button
              type="button"
              onClick={handleExport}
              className="mt-5 inline-flex items-center gap-1.5 rounded-2xl border border-accent/30 bg-accent/15 px-5 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/25"
            >
              <IconifyIcon name="ui-export" size={14} color="currentColor" /> {t('settings.exportAll', 'Export All Data')}
            </button>
          </div>

          <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.importData', 'Import Data')}</div>
            <h4 className="mt-2 text-[17px] font-semibold text-text-primary">{t('settings.restoreBackup', 'Restore Backup')}</h4>
            <p className="mt-2 text-[12px] leading-6 text-text-secondary/80">{t('settings.importDataDesc', 'Import agents, skills, and settings from a previously exported JSON file.')}</p>
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
              id="import-data-file"
            />
            <label
              htmlFor="import-data-file"
              className="mt-5 inline-flex cursor-pointer items-center gap-1.5 rounded-2xl bg-surface-3 px-5 py-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-4"
            >
              <IconifyIcon name="ui-import" size={14} color="currentColor" /> {t('settings.importData', 'Import Data')}
            </label>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.historyRetention', 'History Retention')}
        title={t('settings.retentionPolicy', 'Retention Policy')}
        description={t('settings.historyRetentionDesc', 'Automatically delete conversations older than the specified number of days. Set to 0 to keep all history.')}
        action={historyRetentionDays > 0 ? (
          <button
            type="button"
            onClick={() => void cleanOldSessions()}
            className="rounded-2xl border border-amber-500/18 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-400 transition-colors hover:bg-amber-500/18"
          >
            {t('settings.cleanNow', 'Clean Now')}
          </button>
        ) : undefined}
      >
        <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="number"
              min={0}
              max={3650}
              value={historyRetentionDays}
              onChange={(e) => setHistoryRetentionDays(Math.max(0, parseInt(e.target.value) || 0))}
              aria-label="History retention days"
              className={`${settingsInputClass} w-32`}
            />
            <span className="text-sm text-text-muted">{t('settings.days', 'days')}</span>
          </div>
          {historyRetentionDays > 0 ? (
            <p className="mt-3 text-[12px] leading-6 text-text-muted">{t('settings.autoCleanDesc', 'Sessions will be auto-cleaned when you open the app.')}</p>
          ) : (
            <p className="mt-3 text-[12px] leading-6 text-text-muted">{t('settings.keepEverything', 'Retention set to 0 means the app keeps all history until you delete it manually.')}</p>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.clearData', 'Clear Data')}
        title={t('settings.dangerZone', 'Danger Zone')}
        description={t('settings.clearDataDesc', 'Permanently delete all chat history and sessions. This cannot be undone.')}
      >
        <div className="rounded-3xl border border-red-500/18 bg-red-500/8 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-[13px] font-semibold text-text-primary">{t('settings.clearAllHistory', 'Clear All Chat History')}</div>
              <p className="mt-2 text-[12px] leading-6 text-text-secondary/80">{t('settings.clearDataDesc', 'Permanently delete all chat history and sessions. This cannot be undone.')}</p>
            </div>
            <button
              type="button"
              onClick={() => void clearAllData()}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-danger/10 px-5 py-3 text-sm font-semibold text-danger transition-colors hover:bg-danger/20"
            >
              <IconifyIcon name="ui-trash" size={14} color="currentColor" /> {t('settings.clearAllHistory', 'Clear All Chat History')}
            </button>
          </div>
        </div>
      </SettingsSection>
    </div>
  )
}
