import { useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import type { EnvVariable } from '@/types'
import {
  SettingsSection,
  SettingsStat,
  SettingsToggleRow,
  settingsCheckboxClass,
  settingsDangerButtonClass,
  settingsFieldCardClass,
  settingsHintClass,
  settingsInputClass,
  settingsLabelClass,
  settingsMonoInputClass,
  settingsSecondaryButtonClass,
  settingsSoftButtonClass,
  settingsSurfaceCardClass,
} from './panelUi'

function ListEditor({
  items,
  onAdd,
  onRemove,
  placeholder,
  emptyText,
}: {
  items: string[]
  onAdd: (val: string) => void
  onRemove: (val: string) => void
  placeholder: string
  emptyText?: string
}) {
  const { t } = useI18n()
  const [input, setInput] = useState('')

  const commitValue = () => {
    const value = input.trim()
    if (!value) return
    onAdd(value)
    setInput('')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className={`${settingsInputClass} flex-1`}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitValue()
            }
          }}
        />
        <button type="button" onClick={commitValue} className={settingsSoftButtonClass}>
          {t('settings.add', 'Add')}
        </button>
      </div>

      {items.length === 0 && emptyText && <p className={settingsHintClass}>{emptyText}</p>}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className={`${settingsSurfaceCardClass} flex items-center justify-between gap-3`}>
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-text-secondary">{item}</span>
            <button type="button" onClick={() => onRemove(item)} className="shrink-0 text-[11px] font-medium text-danger transition-colors hover:text-danger/80">
              {t('settings.remove', 'Remove')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function EnvVarsSection() {
  const { t } = useI18n()
  const { envVariables, addEnvVariable, updateEnvVariable, removeEnvVariable } = useAppStore()

  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newSecret, setNewSecret] = useState(true)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editSecret, setEditSecret] = useState(true)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const [keyError, setKeyError] = useState('')

  const ENV_KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/

  const handleAdd = () => {
    const trimmedKey = newKey.trim()
    if (!trimmedKey) {
      setKeyError(t('settings.envKeyRequired', 'Variable name is required'))
      return
    }
    if (!ENV_KEY_REGEX.test(trimmedKey)) {
      setKeyError(t('settings.envKeyInvalid', 'Must start with a letter or _ and contain only letters, numbers, _'))
      return
    }
    if (envVariables.some((variable) => variable.key === trimmedKey)) {
      setKeyError(t('settings.envKeyExists', 'Variable already exists'))
      return
    }

    const now = Date.now()
    addEnvVariable({
      key: trimmedKey,
      value: newValue,
      description: newDesc || undefined,
      secret: newSecret,
      createdAt: now,
      updatedAt: now,
    })

    setNewKey('')
    setNewValue('')
    setNewDesc('')
    setNewSecret(true)
    setKeyError('')
  }

  const toggleVisible = (key: string) => {
    setVisibleKeys((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const startEditing = (variable: EnvVariable) => {
    setEditingKey(variable.key)
    setEditValue(variable.value)
    setEditDesc(variable.description || '')
    setEditSecret(variable.secret)
  }

  return (
    <div className="space-y-4">
      <div className={`${settingsFieldCardClass} space-y-4`}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className={settingsLabelClass}>{t('settings.envKey', 'Name')}</label>
            <input
              value={newKey}
              onChange={(e) => {
                setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))
                setKeyError('')
              }}
              placeholder="API_KEY"
              className={settingsMonoInputClass}
            />
            {keyError && <p className="mt-2 text-[11px] text-red-500">{keyError}</p>}
          </div>
          <div>
            <label className={settingsLabelClass}>{t('settings.envValue', 'Value')}</label>
            <input
              type={newSecret ? 'password' : 'text'}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="••••••••"
              className={settingsMonoInputClass}
            />
          </div>
        </div>

        <div>
          <label className={settingsLabelClass}>{t('settings.envDescription', 'Description')}</label>
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder={t('settings.envDescriptionPlaceholder', 'What is this variable used for?')}
            className={settingsInputClass}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-3 text-sm text-text-secondary">
            <input type="checkbox" checked={newSecret} onChange={(e) => setNewSecret(e.target.checked)} className={settingsCheckboxClass} />
            {t('settings.envMarkSecret', 'Secret (masked)')}
          </label>
          <button type="button" onClick={handleAdd} disabled={!newKey.trim() || !newValue} className={settingsSoftButtonClass}>
            {t('settings.add', 'Add')}
          </button>
        </div>
      </div>

      {envVariables.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border-subtle/55 bg-surface-2/40 px-4 py-8 text-center text-[12px] text-text-muted">
          {t('settings.noEnvVars', 'No environment variables configured yet.')}
        </div>
      ) : (
        <div className="space-y-2">
          {envVariables.map((variable) => (
            <div key={variable.key} className={`${settingsFieldCardClass} p-3`}>
              {editingKey === variable.key ? (
                <div className="space-y-3">
                  <span className="font-mono text-[12px] font-semibold text-accent">{variable.key}</span>
                  <input
                    type={editSecret ? 'password' : 'text'}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    aria-label="Variable value"
                    className={settingsMonoInputClass}
                  />
                  <input
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder={t('settings.envDescription', 'Description')}
                    className={settingsInputClass}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-3 text-sm text-text-secondary">
                      <input type="checkbox" checked={editSecret} onChange={(e) => setEditSecret(e.target.checked)} className={settingsCheckboxClass} />
                      {t('settings.envMarkSecret', 'Secret (masked)')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setEditingKey(null)} className={settingsSecondaryButtonClass}>
                        {t('common.cancel', 'Cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateEnvVariable(variable.key, {
                            value: editValue,
                            description: editDesc || undefined,
                            secret: editSecret,
                          })
                          setEditingKey(null)
                        }}
                        className={settingsSoftButtonClass}
                      >
                        {t('common.save', 'Save')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12px] font-semibold text-text-primary">{variable.key}</span>
                      {variable.secret && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-medium uppercase text-amber-600">secret</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-text-muted wrap-break-word">{variable.secret && !visibleKeys.has(variable.key) ? '••••••••' : variable.value}</span>
                      {variable.secret && (
                        <button type="button" onClick={() => toggleVisible(variable.key)} className="text-[11px] text-text-muted transition-colors hover:text-accent">
                          {visibleKeys.has(variable.key) ? t('settings.hide', 'Hide') : t('settings.show', 'Show')}
                        </button>
                      )}
                    </div>
                    {variable.description && <p className="mt-2 text-[11px] leading-relaxed text-text-muted">{variable.description}</p>}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" onClick={() => startEditing(variable)} className="rounded-full p-2 text-text-muted transition-colors hover:bg-surface-2 hover:text-accent" title={t('common.edit', 'Edit')}>
                      <IconifyIcon name="ui-edit" size={13} color="currentColor" />
                    </button>
                    <button type="button" onClick={() => removeEnvVariable(variable.key)} className="rounded-full p-2 text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-500" title={t('common.delete', 'Delete')}>
                      <IconifyIcon name="ui-cross" size={13} color="currentColor" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SecuritySettings() {
  const { t } = useI18n()
  const { toolSecurity, setToolSecurity, envVariables } = useAppStore()

  return (
    <div className="space-y-6">
      <section className="rounded-4xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/94 to-surface-2/72 p-6 shadow-[0_24px_70px_rgba(var(--t-accent-rgb),0.08)] xl:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('settings.security', 'Security')}</div>
            <h2 className="mt-2 text-[30px] font-semibold tracking-tight text-text-primary">{t('settings.guardrailsAndSecrets', 'Guardrails & Secrets')}</h2>
            <p className="mt-2 text-[14px] leading-7 text-text-secondary/82">
              {t('settings.guardrailsAndSecretsDesc', 'Constrain tool execution, lock down risky shell patterns, and keep environment values available to agents without leaking them into prompt text.')}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-md xl:grid-cols-4">
            <SettingsStat label={t('settings.confirmation', 'Confirmation')} value={toolSecurity.requireConfirmation ? t('settings.required', 'Required') : t('settings.relaxed', 'Relaxed')} accent />
            <SettingsStat label={t('settings.allowedDirs', 'Allowed Dirs')} value={String(toolSecurity.allowedDirectories.length)} />
            <SettingsStat label={t('settings.blockedPatterns', 'Blocked')} value={String(toolSecurity.blockedCommands.length)} />
            <SettingsStat label={t('settings.envVars', 'Env Vars')} value={String(envVariables.length)} />
          </div>
        </div>
      </section>

      <SettingsSection
        eyebrow={t('settings.toolExecution', 'Tool Execution')}
        title={t('settings.executionGuardrails', 'Execution Guardrails')}
        description={t('settings.executionGuardrailsDesc', 'Decide whether every tool call must pause for approval before an agent can touch disk, network, or external processes.')}
      >
        <SettingsToggleRow
          label={t('settings.requireConfirmation', 'Require confirmation before every tool execution')}
          description={t('settings.requireConfirmationDesc', 'When enabled, each tool call must be explicitly approved before the agent can proceed.')}
          checked={toolSecurity.requireConfirmation}
          onChange={() => setToolSecurity({ requireConfirmation: !toolSecurity.requireConfirmation })}
        />
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.allowedDirs', 'Allowed Directories')}
        title={t('settings.filesystemAccess', 'Filesystem Access')}
        description={t('settings.filesystemAccessDesc', 'Restrict tool writes and reads to a curated set of folders. Leaving this empty means the app falls back to the current workspace rules.')}
      >
        <ListEditor
          items={toolSecurity.allowedDirectories}
          onAdd={(value) => {
            if (!toolSecurity.allowedDirectories.includes(value)) {
              setToolSecurity({ allowedDirectories: [...toolSecurity.allowedDirectories, value] })
            }
          }}
          onRemove={(value) => setToolSecurity({ allowedDirectories: toolSecurity.allowedDirectories.filter((directory) => directory !== value) })}
          placeholder="C:/Users/Fandy/.suora"
          emptyText={t('settings.emptyNoRestriction', 'Empty means no path restriction.')}
        />
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.blockedPatterns', 'Blocked Shell Patterns')}
        title={t('settings.commandDenylist', 'Command Denylist')}
        description={t('settings.commandDenylistDesc', 'Block known-destructive commands and shorthand patterns so even autonomous flows cannot invoke them accidentally.')}
      >
        <ListEditor
          items={toolSecurity.blockedCommands}
          onAdd={(value) => {
            if (!toolSecurity.blockedCommands.includes(value)) {
              setToolSecurity({ blockedCommands: [...toolSecurity.blockedCommands, value] })
            }
          }}
          onRemove={(value) => setToolSecurity({ blockedCommands: toolSecurity.blockedCommands.filter((command) => command !== value) })}
          placeholder="rm -rf"
        />
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.envVars', 'Environment Variables')}
        title={t('settings.agentSecretsVault', 'Agent Secrets Vault')}
        description={t('settings.agentSecretsVaultDesc', 'Store credentials, tokens, and config values that agents can retrieve at runtime through `env_get` without hardcoding them into prompts or skill files.')}
        action={envVariables.length > 0 ? <button type="button" className={settingsDangerButtonClass}>{t('settings.secretsMasked', 'Secrets masked')}</button> : undefined}
      >
        <EnvVarsSection />
      </SettingsSection>
    </div>
  )
}