import { useMemo, useState } from 'react'
import { useAppStore, loadExternalSkillsAndAgents, saveSettingsToWorkspace } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { SettingsSection, SettingsStat, settingsInputClass } from './panelUi'

export function ExternalDirsSettings() {
  const { t } = useI18n()
  const { externalDirectories, addExternalDirectory, updateExternalDirectory, removeExternalDirectory } = useAppStore()
  const [extDirPath, setExtDirPath] = useState('')
  const [extDirType, setExtDirType] = useState<'agents' | 'skills'>('skills')

  const presetDirectories = [
    { path: '~/.agents/skills', type: 'skills' as const },
    { path: '~/.claude/skills', type: 'skills' as const },
    { path: '~/.agents/agents', type: 'agents' as const },
    { path: '~/.claude/agents', type: 'agents' as const },
  ]

  const enabledCount = useMemo(() => externalDirectories.filter((dir) => dir.enabled).length, [externalDirectories])
  const skillsDirsCount = useMemo(() => externalDirectories.filter((dir) => dir.type === 'skills').length, [externalDirectories])
  const agentsDirsCount = useMemo(() => externalDirectories.filter((dir) => dir.type === 'agents').length, [externalDirectories])

  const addDirectory = async (path: string, type: 'agents' | 'skills') => {
    if (!path.trim()) return
    addExternalDirectory({ path, enabled: true, type })
    await saveSettingsToWorkspace()
    await loadExternalSkillsAndAgents()
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        eyebrow={t('settings.externalDirectories', 'External Directories')}
        title={t('settings.directoryBridge', 'Directory Bridge')}
        description={t('settings.extDirsDesc', 'Configure external directories so Suora can load additional skills and agents from shared local folders such as ~/.agents and ~/.claude.')}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <SettingsStat label={t('common.total', 'Total')} value={String(externalDirectories.length)} accent />
          <SettingsStat label={t('settings.enabled', 'Enabled')} value={String(enabledCount)} />
          <SettingsStat label={t('settings.sources', 'Sources')} value={`${skillsDirsCount}/${agentsDirsCount}`} />
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.addExtDir', 'Add External Directory')}
        title={t('settings.attachDirectory', 'Attach Directory')}
        description={t('settings.attachDirectoryHint', 'Point the workspace to another directory of prompts or agent definitions. Changes are reloaded immediately after saving.')}
        action={
          <button
            type="button"
            onClick={async () => {
              if (!extDirPath.trim()) return
              await addDirectory(extDirPath, extDirType)
              setExtDirPath('')
            }}
            className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(var(--t-accent-rgb),0.22)] transition-colors hover:bg-accent-hover"
          >
            {t('settings.add', 'Add')}
          </button>
        }
      >
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={extDirPath}
            onChange={(event) => setExtDirPath(event.target.value)}
            placeholder="e.g., ~/.agents/skills"
            aria-label={t('settings.externalDirectoryPath', 'External directory path')}
            className={settingsInputClass}
          />
          <select
            value={extDirType}
            onChange={(event) => setExtDirType(event.target.value as 'agents' | 'skills')}
            aria-label={t('settings.directoryType', 'Directory type')}
            className={settingsInputClass}
          >
            <option value="skills">{t('skills.title', 'Skills')}</option>
            <option value="agents">{t('agents.title', 'Agents')}</option>
          </select>
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.configuredDirs', 'Configured Directories')}
        title={t('settings.activeSources', 'Active Sources')}
        description={t('settings.activeSourcesHint', 'Toggle directories on or off without deleting them, or remove them entirely if the workspace should stop indexing that source.')}
      >
        {externalDirectories.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/65 text-text-muted/60">
              <IconifyIcon name="ui-package" size={18} color="currentColor" />
            </div>
            <p className="text-[12px] leading-relaxed text-text-muted">{t('settings.noExtDirs', 'No external directories configured.')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {externalDirectories.map((dir) => (
              <div key={dir.path} className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded-xl bg-surface-2/80 px-3 py-1.5 text-[12px] text-text-primary">{dir.path}</code>
                      <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[10px] font-medium text-accent">{dir.type}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${dir.enabled ? 'bg-green-500/12 text-green-400' : 'bg-surface-3 text-text-muted'}`}>{dir.enabled ? t('settings.enabled', 'Enabled') : t('settings.disabled', 'Disabled')}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        updateExternalDirectory(dir.path, { enabled: !dir.enabled })
                        await saveSettingsToWorkspace()
                        await loadExternalSkillsAndAgents()
                      }}
                      className={`rounded-xl border px-3 py-2 text-[11px] font-semibold transition-colors ${dir.enabled ? 'border-green-500/18 bg-green-500/10 text-green-400 hover:bg-green-500/16' : 'border-border-subtle/55 bg-surface-2/70 text-text-muted hover:bg-surface-3'}`}
                    >
                      {dir.enabled ? t('settings.disable', 'Disable') : t('settings.enable', 'Enable')}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        removeExternalDirectory(dir.path)
                        await saveSettingsToWorkspace()
                        await loadExternalSkillsAndAgents()
                      }}
                      className="rounded-xl border border-red-500/18 bg-red-500/8 px-3 py-2 text-[11px] font-semibold text-red-400 transition-colors hover:bg-red-500/14"
                    >
                      {t('settings.remove', 'Remove')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.quickAddPreset', 'Quick Add Preset Directories')}
        title={t('settings.presetSources', 'Preset Sources')}
        description={t('settings.presetSourcesHint', 'These common paths cover the typical global skill and agent directories used by Claude-style local tooling.')}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {presetDirectories.map(({ path, type }) => {
            const exists = externalDirectories.some((dir) => dir.path === path)
            return (
              <button
                key={path}
                type="button"
                onClick={async () => {
                  if (exists) return
                  await addDirectory(path, type)
                }}
                disabled={exists}
                className={`rounded-3xl border px-4 py-4 text-left transition-colors ${exists ? 'border-green-500/18 bg-green-500/8 text-green-400' : 'border-border-subtle/55 bg-surface-0/45 text-text-primary hover:bg-surface-2/60'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold">{path}</div>
                    <div className="mt-1 text-[11px] text-text-muted/80">{type}</div>
                  </div>
                  {exists ? <IconifyIcon name="ui-check" size={14} color="currentColor" /> : <IconifyIcon name="ui-download" size={14} color="currentColor" />}
                </div>
              </button>
            )
          })}
        </div>
      </SettingsSection>
    </div>
  )
}
