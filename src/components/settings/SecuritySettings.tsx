import { useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import type { EnvVariable } from '@/types'

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-border/50">
      <IconifyIcon name={icon} size={16} color="currentColor" />
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
    </div>
  )
}

function ListEditor({ items, onAdd, onRemove, placeholder, emptyText }: {
  items: string[]
  onAdd: (val: string) => void
  onRemove: (val: string) => void
  placeholder: string
  emptyText?: string
}) {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-lg bg-surface-2 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = input.trim()
              if (val) { onAdd(val); setInput('') }
            }
          }}
        />
        <button
          onClick={() => { const val = input.trim(); if (val) { onAdd(val); setInput('') } }}
          className="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          {t('settings.add', 'Add')}
        </button>
      </div>
      {items.length === 0 && emptyText && (
        <p className="text-xs text-text-muted">{emptyText}</p>
      )}
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item} className="flex items-center justify-between text-xs bg-surface-2 rounded-lg px-3 py-2">
            <span className="text-text-secondary truncate font-mono">{item}</span>
            <button onClick={() => onRemove(item)} className="text-danger hover:text-danger/80 text-[10px] font-medium shrink-0 ml-2">
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
    if (!trimmedKey) { setKeyError(t('settings.envKeyRequired', 'Variable name is required')); return }
    if (!ENV_KEY_REGEX.test(trimmedKey)) { setKeyError(t('settings.envKeyInvalid', 'Must start with a letter or _ and contain only letters, numbers, _')); return }
    if (envVariables.some((v) => v.key === trimmedKey)) { setKeyError(t('settings.envKeyExists', 'Variable already exists')); return }
    const now = Date.now()
    addEnvVariable({ key: trimmedKey, value: newValue, description: newDesc || undefined, secret: newSecret, createdAt: now, updatedAt: now })
    setNewKey(''); setNewValue(''); setNewDesc(''); setNewSecret(true); setKeyError('')
  }

  const toggleVisible = (key: string) => {
    setVisibleKeys((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })
  }

  const startEditing = (v: EnvVariable) => {
    setEditingKey(v.key); setEditValue(v.value); setEditDesc(v.description || ''); setEditSecret(v.secret)
  }

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="rounded-xl border border-border bg-surface-2/50 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1">{t('settings.envKey', 'Name')}</label>
            <input value={newKey} onChange={(e) => { setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_')); setKeyError('') }} placeholder="API_KEY"
              className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-text-primary text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/30" />
            {keyError && <p className="text-xs text-red-500 mt-1">{keyError}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1">{t('settings.envValue', 'Value')}</label>
            <input type={newSecret ? 'password' : 'text'} value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="••••••••"
              className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-text-primary text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={newSecret} onChange={(e) => setNewSecret(e.target.checked)} className="w-3.5 h-3.5 rounded border-border text-accent focus:ring-accent/30" />
            <span className="text-xs text-text-secondary">{t('settings.envMarkSecret', 'Secret (masked)')}</span>
          </label>
          <button onClick={handleAdd} disabled={!newKey.trim() || !newValue}
            className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-40 transition-colors">
            {t('settings.add', 'Add')}
          </button>
        </div>
      </div>

      {/* Variable list */}
      {envVariables.length === 0 ? (
        <p className="text-xs text-text-muted text-center py-4">{t('settings.noEnvVars', 'No environment variables configured yet.')}</p>
      ) : (
        <div className="space-y-1.5">
          {envVariables.map((v) => (
            <div key={v.key} className="rounded-lg border border-border bg-surface-2/50 px-3 py-2.5">
              {editingKey === v.key ? (
                <div className="space-y-2">
                  <span className="font-mono text-xs font-semibold text-accent">{v.key}</span>
                  <input type={editSecret ? 'password' : 'text'} value={editValue} onChange={(e) => setEditValue(e.target.value)} aria-label="Variable value"
                    className="w-full px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text-primary text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/30" />
                  <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder={t('settings.envDescription', 'Description')}
                    className="w-full px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editSecret} onChange={(e) => setEditSecret(e.target.checked)} className="rounded" />
                      <span className="text-xs text-text-secondary">{t('settings.envMarkSecret', 'Secret (masked)')}</span>
                    </label>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingKey(null)} className="px-3 py-1 rounded-lg text-xs text-text-muted hover:bg-surface-3">{t('common.cancel', 'Cancel')}</button>
                      <button onClick={() => { updateEnvVariable(v.key, { value: editValue, description: editDesc || undefined, secret: editSecret }); setEditingKey(null) }}
                        className="px-3 py-1 rounded-lg bg-accent text-white text-xs font-medium">{t('common.save', 'Save')}</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-text-primary">{v.key}</span>
                      {v.secret && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-600 font-medium uppercase">secret</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[11px] text-text-muted truncate">{v.secret && !visibleKeys.has(v.key) ? '••••••••' : v.value}</span>
                      {v.secret && (
                        <button onClick={() => toggleVisible(v.key)} className="text-[10px] text-text-muted hover:text-accent">
                          {visibleKeys.has(v.key) ? t('settings.hide', 'Hide') : t('settings.show', 'Show')}
                        </button>
                      )}
                    </div>
                    {v.description && <p className="text-[10px] text-text-muted mt-0.5">{v.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <button onClick={() => startEditing(v)} className="p-1 rounded text-text-muted hover:text-accent hover:bg-surface-3" title={t('common.edit', 'Edit')}>
                      <IconifyIcon name="ui-edit" size={13} color="currentColor" />
                    </button>
                    <button onClick={() => removeEnvVariable(v.key)} className="p-1 rounded text-text-muted hover:text-red-500 hover:bg-red-500/10" title={t('common.delete', 'Delete')}>
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
  const { toolSecurity, setToolSecurity } = useAppStore()

  return (
    <div className="space-y-8">
      {/* ─── Tool Execution ─── */}
      <section className="space-y-4">
        <SectionHeader icon="settings-security" title={t('settings.toolExecution', 'Tool Execution')} />
        <div className="rounded-xl border border-border p-4 bg-surface-0/30">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={toolSecurity.requireConfirmation}
              onChange={(e) => setToolSecurity({ requireConfirmation: e.target.checked })}
              className="w-4 h-4 rounded border-border text-accent focus:ring-accent/30 bg-surface-2"
            />
            <span className="text-sm text-text-secondary">{t('settings.requireConfirmation', 'Require confirmation before every tool execution')}</span>
          </label>
        </div>
      </section>

      {/* ─── Directory Whitelist ─── */}
      <section className="space-y-4">
        <SectionHeader icon="settings-directory" title={t('settings.allowedDirs', 'Allowed Directories')} />
        <ListEditor
          items={toolSecurity.allowedDirectories}
          onAdd={(val) => {
            if (!toolSecurity.allowedDirectories.includes(val)) {
              setToolSecurity({ allowedDirectories: [...toolSecurity.allowedDirectories, val] })
            }
          }}
          onRemove={(val) => setToolSecurity({ allowedDirectories: toolSecurity.allowedDirectories.filter((d) => d !== val) })}
          placeholder="C:/Users/Fandy/.suora"
          emptyText={t('settings.emptyNoRestriction', 'Empty means no path restriction.')}
        />
      </section>

      {/* ─── Blocked Commands ─── */}
      <section className="space-y-4">
        <SectionHeader icon="settings-security" title={t('settings.blockedPatterns', 'Blocked Shell Patterns')} />
        <ListEditor
          items={toolSecurity.blockedCommands}
          onAdd={(val) => {
            if (!toolSecurity.blockedCommands.includes(val)) {
              setToolSecurity({ blockedCommands: [...toolSecurity.blockedCommands, val] })
            }
          }}
          onRemove={(val) => setToolSecurity({ blockedCommands: toolSecurity.blockedCommands.filter((c) => c !== val) })}
          placeholder="rm -rf"
        />
      </section>

      {/* ─── Environment Variables ─── */}
      <section className="space-y-4">
        <SectionHeader icon="settings-security" title={t('settings.envVars', 'Environment Variables')} />
        <p className="text-xs text-text-muted">{t('settings.envVarsDesc', 'Store credentials, tokens, and configuration values that agents can access via the env_get tool.')}</p>
        <EnvVarsSection />
      </section>
    </div>
  )
}
