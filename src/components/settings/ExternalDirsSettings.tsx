import { useState } from 'react'
import { useAppStore, loadExternalSkillsAndAgents, saveSettingsToWorkspace } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'

export function ExternalDirsSettings() {
  const { t } = useI18n()
  const { externalDirectories, addExternalDirectory, updateExternalDirectory, removeExternalDirectory } = useAppStore()
  const [extDirPath, setExtDirPath] = useState('')
  const [extDirType, setExtDirType] = useState<'agents' | 'skills'>('skills')

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border p-4 bg-surface-0/30">
        <p className="text-sm text-text-muted mb-4">
          {t('settings.extDirsDesc', 'Configure external directories to load additional skills and agents from')} <code className="px-1.5 py-0.5 rounded bg-surface-2 text-accent">~/.agents/skills</code> and <code className="px-1.5 py-0.5 rounded bg-surface-2 text-accent">~/.claude/skills</code> directories.
        </p>
      </div>

      <div className="rounded-xl border border-border p-4 bg-surface-1/30">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{t('settings.addExtDir', 'Add External Directory')}</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={extDirPath}
            onChange={(e) => setExtDirPath(e.target.value)}
            placeholder="e.g., ~/.agents/skills"
            aria-label="External directory path"
            className="flex-1 px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <select
            value={extDirType}
            onChange={(e) => setExtDirType(e.target.value as 'agents' | 'skills')}
            aria-label="Directory type"
            className="px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="skills">{t('skills.title', 'Skills')}</option>
            <option value="agents">{t('agents.title', 'Agents')}</option>
          </select>
          <button
            onClick={async () => {
              if (!extDirPath.trim()) return
              addExternalDirectory({ path: extDirPath, enabled: true, type: extDirType })
              await saveSettingsToWorkspace()
              await loadExternalSkillsAndAgents()
              setExtDirPath('')
            }}
            className="px-4 py-2 rounded-xl bg-accent/15 text-accent text-sm font-medium hover:bg-accent/25 transition-colors border border-accent/30"
          >
            {t('settings.add', 'Add')}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">{t('settings.configuredDirs', 'Configured Directories')}</h3>
        {externalDirectories.length === 0 ? (
          <div className="rounded-xl border border-border p-4 bg-surface-1/20 text-center text-sm text-text-muted">
            {t('settings.noExtDirs', 'No external directories configured.')}
          </div>
        ) : (
          <div className="space-y-2">
            {externalDirectories.map((dir) => (
              <div key={dir.path} className="rounded-xl border border-border p-3 bg-surface-1/30 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={dir.enabled}
                  onChange={async (e) => {
                    updateExternalDirectory(dir.path, { enabled: e.target.checked })
                    await saveSettingsToWorkspace()
                    await loadExternalSkillsAndAgents()
                  }}
                  aria-label={`Enable directory ${dir.path}`}
                  className="w-4 h-4 rounded border-border bg-surface-2 text-accent focus:ring-2 focus:ring-accent/30"
                />
                <code className="flex-1 text-sm text-text-primary bg-surface-2 px-2 py-1 rounded">{dir.path}</code>
                <span className="px-2 py-1 rounded-lg text-xs font-medium bg-accent/15 text-accent border border-accent/30">{dir.type}</span>
                <button
                  onClick={async () => {
                    removeExternalDirectory(dir.path)
                    await saveSettingsToWorkspace()
                    await loadExternalSkillsAndAgents()
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-medium text-error hover:bg-error/10 transition-colors"
                >
                  {t('settings.remove', 'Remove')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border p-4 bg-surface-0/30">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{t('settings.quickAddPreset', 'Quick Add Preset Directories')}</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { path: '~/.agents/skills', type: 'skills' as const },
            { path: '~/.claude/skills', type: 'skills' as const },
            { path: '~/.agents/agents', type: 'agents' as const },
            { path: '~/.claude/agents', type: 'agents' as const },
          ].map(({ path, type }) => (
            <button
              key={path}
              onClick={async () => {
                if (!externalDirectories.some((d) => d.path === path)) {
                  addExternalDirectory({ path, enabled: true, type })
                  await saveSettingsToWorkspace()
                  await loadExternalSkillsAndAgents()
                }
              }}
              className="px-3 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-primary text-sm border border-border transition-colors"
            >
              {path}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
