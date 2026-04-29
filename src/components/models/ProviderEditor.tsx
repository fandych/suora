import { useState, useEffect, useCallback } from 'react'
import { useAppStore, saveSettingsToWorkspace } from '@/store/appStore'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { testConnection } from '@/services/aiService'
import { useI18n } from '@/hooks/useI18n'
import type { ProviderConfig, ProviderModelEntry } from '@/types'

const PROVIDER_TYPES: { value: ProviderConfig['providerType']; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
]

const PRESET_MODELS: Partial<Record<ProviderConfig['providerType'], { modelId: string; name: string }[]>> = {
  anthropic: [
    { modelId: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { modelId: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    { modelId: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    { modelId: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
  ],
  openai: [
    { modelId: 'gpt-4o', name: 'GPT-4o' },
    { modelId: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { modelId: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { modelId: 'o1', name: 'o1' },
    { modelId: 'o1-mini', name: 'o1 Mini' },
  ],
  google: [
    { modelId: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { modelId: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { modelId: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  ],
  ollama: [
    { modelId: 'llama3', name: 'Llama 3' },
    { modelId: 'mistral', name: 'Mistral' },
    { modelId: 'codellama', name: 'Code Llama' },
  ],
}

function EditorSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/96 via-surface-1/88 to-surface-2/70 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)] xl:p-6">
      <div className="mb-5">
        <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{eyebrow}</div>
        <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">{title}</h3>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-text-secondary/80">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function SummaryStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-3xl border px-4 py-3 ${accent ? 'border-accent/18 bg-accent/10' : 'border-border-subtle/55 bg-surface-0/60'}`}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{label}</div>
      <div className={`mt-2 text-lg font-semibold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</div>
    </div>
  )
}

export function ProviderEditor({ providerId, onSaved }: { providerId: string; onSaved: () => void }) {
  const { t } = useI18n()
  const { providerConfigs, updateProviderConfig, syncModelsFromConfigs, workspacePath, selectedModel, setSelectedModel, models: allModels } = useAppStore()
  const config = providerConfigs.find((p) => p.id === providerId)

  const [name, setName] = useState('')
  const [providerType, setProviderType] = useState<ProviderConfig['providerType']>('openai-compatible')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [models, setModels] = useState<ProviderModelEntry[]>([])
  const [newModelId, setNewModelId] = useState('')
  const [newModelName, setNewModelName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; latency?: number } | null>(null)

  useEffect(() => {
    if (!config) return
    setName(config.name)
    setProviderType(config.providerType)
    setApiKey(config.apiKey)
    setBaseUrl(config.baseUrl)
    setModels([...config.models])
    setNewModelId('')
    setNewModelName('')
    setSaving(false)
    setSaved(false)
    setTesting(false)
    setTestResult(null)
    setValidationResult(null)
  }, [config])

  const markDirty = () => {
    setSaved(false)
    setTestResult(null)
    setValidationResult(null)
  }

  const toggleModel = (index: number) => {
    setModels((prev) => prev.map((m, i) => i === index ? { ...m, enabled: !m.enabled } : m))
    markDirty()
  }

  const removeModel = (index: number) => {
    setModels((prev) => prev.filter((_, i) => i !== index))
    markDirty()
  }

  const addModel = () => {
    const id = newModelId.trim()
    if (!id) return
    if (models.some((m) => m.modelId === id)) return
    setModels((prev) => [...prev, { modelId: id, name: newModelName.trim() || id, enabled: true }])
    setNewModelId('')
    setNewModelName('')
    markDirty()
  }

  const addPresetModels = () => {
    const presets = PRESET_MODELS[providerType]
    if (!presets) return
    const existing = new Set(models.map((m) => m.modelId))
    const toAdd = presets
      .filter((p) => !existing.has(p.modelId))
      .map((p) => ({ modelId: p.modelId, name: p.name, enabled: true }))
    if (toAdd.length > 0) {
      setModels((prev) => [...prev, ...toAdd])
      markDirty()
    }
  }

  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null)

  const handleSave = useCallback(async () => {
    setSaving(true)
    setValidationResult(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setValidationResult({ valid: false, error: t('models.providerNameRequired', 'Provider name is required') })
      setSaving(false)
      return
    }
    if (!models.some((model) => model.enabled)) {
      setValidationResult({ valid: false, error: t('models.enabledModelRequired', 'Enable at least one model before saving') })
      setSaving(false)
      return
    }

    updateProviderConfig(providerId, { name: trimmedName, providerType, apiKey, baseUrl, models })
    syncModelsFromConfigs()
    let savedSuccessfully = true
    if (workspacePath) {
      savedSuccessfully = await saveSettingsToWorkspace()
    }
    setSaving(false)
    if (!savedSuccessfully) {
      setValidationResult({ valid: false, error: t('models.saveFailed', 'Could not save configuration to workspace') })
      return
    }
    setSaved(true)
    onSaved()
  }, [name, providerType, apiKey, baseUrl, models, providerId, updateProviderConfig, syncModelsFromConfigs, workspacePath, onSaved, t])

  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
        {t('models.selectProviderToConfigure', 'Select a provider to configure')}
      </div>
    )
  }

  const isOllama = providerType === 'ollama'
  const hasPresets = !!PRESET_MODELS[providerType]
  const enabledModelCount = models.filter((model) => model.enabled).length
  const connectionState = testing ? 'checking' : testResult?.success ? 'connected' : testResult ? 'disconnected' : 'draft'
  const connectionLabel = connectionState === 'connected'
    ? t('models.connected', 'Connected')
    : connectionState === 'checking'
      ? t('models.checking', 'Checking...')
      : connectionState === 'disconnected'
        ? t('models.disconnected', 'Disconnected')
        : t('common.draft', 'Draft')

  return (
    <div className="flex-1 overflow-y-auto px-5 py-6 xl:px-8 xl:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-4xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/94 to-surface-2/72 p-6 shadow-[0_24px_70px_rgba(var(--t-accent-rgb),0.08)] xl:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex h-18 w-18 shrink-0 items-center justify-center rounded-4xl border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.12)] text-xl font-bold">
                {name.slice(0, 2).toUpperCase() || 'PR'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('models.providerWorkspace', 'Provider Workspace')}</div>
                <h2 className="mt-2 text-[30px] font-semibold tracking-tight text-text-primary">{name || t('models.newProvider', 'New Provider')}</h2>
                <p className="mt-2 max-w-3xl text-[14px] leading-7 text-text-secondary/82">{t('models.providerWorkspaceHint', 'Configure the endpoint, shape the model catalog, and validate the connection before making this provider part of the default stack.')}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-border-subtle/45 bg-surface-0/78 px-3 py-1 text-[11px] text-text-secondary">{PROVIDER_TYPES.find((item) => item.value === providerType)?.label || providerType}</span>
                  <span className={`rounded-full px-3 py-1 text-[11px] ${connectionState === 'connected' ? 'bg-green-500/15 text-green-400' : connectionState === 'checking' ? 'bg-yellow-500/15 text-yellow-400' : connectionState === 'disconnected' ? 'bg-red-500/15 text-red-400' : 'bg-surface-3 text-text-muted'}`}>{connectionLabel}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:w-[24rem] xl:grid-cols-1">
              <SummaryStat label={t('models.enabled', 'Enabled')} value={String(enabledModelCount)} accent />
              <SummaryStat label={t('models.totalConfigured', 'Total Models')} value={String(models.length)} />
              <SummaryStat label={t('models.endpoint', 'Endpoint')} value={baseUrl ? t('models.custom', 'Custom') : t('models.default', 'Default')} />
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            <EditorSection
              eyebrow={t('models.providerInfo', 'Provider Info')}
              title={t('models.identity', 'Identity & Type')}
              description={t('models.identityHint', 'Set the name users see in the workspace and align the provider type with the endpoint you plan to target.')}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-text-muted">{t('models.displayName', 'Display Name')}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); markDirty() }}
                    placeholder={t('models.displayNamePlaceholder', 'My Provider')}
                    className="w-full rounded-2xl border border-border bg-surface-2/75 px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-text-muted">{t('models.providerType', 'Provider Type')}</label>
                  <select
                    value={providerType}
                    onChange={(e) => { setProviderType(e.target.value as ProviderConfig['providerType']); markDirty() }}
                    aria-label={t('models.providerType', 'Provider Type')}
                    className="w-full rounded-2xl border border-border bg-surface-2/75 px-4 py-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    {PROVIDER_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </EditorSection>

            <EditorSection
              eyebrow={t('models.connection', 'Connection')}
              title={t('models.connectionAndHealth', 'Connection & Health')}
              description={t('models.connectionAndHealthHint', 'Use the endpoint and API key that match this provider. Test against an enabled model after the catalog is ready.')}
            >
              <div className="space-y-4">
                {!isOllama && (
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-text-muted">{t('models.apiKey', 'API Key')}</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => { setApiKey(e.target.value); markDirty() }}
                      placeholder="sk-..."
                      className="w-full rounded-2xl border border-border bg-surface-2/75 px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-text-muted">{t('models.baseUrl', 'Base URL')} {!isOllama && <span className="normal-case">({t('models.optional', 'Optional')})</span>}</label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => { setBaseUrl(e.target.value); markDirty() }}
                    placeholder={isOllama ? 'http://localhost:11434/v1' : 'https://api.example.com/v1'}
                    className="w-full rounded-2xl border border-border bg-surface-2/75 px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                  <p className="mt-2 text-[11px] text-text-muted">{isOllama ? t('models.ollamaDefaultHint', 'Default: http://localhost:11434/v1') : t('models.defaultEndpointHint', 'Leave empty to use default endpoint.')}</p>
                </div>

                <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{t('models.testConnection', 'Test Connection')}</div>
                      <p className="mt-1 text-[12px] leading-relaxed text-text-secondary/80">{t('models.testConnectionHint', 'The test uses the first enabled model, so make sure at least one model is available below.')}</p>
                    </div>
                    <button
                      type="button"
                      disabled={testing || (!apiKey && !isOllama) || enabledModelCount === 0}
                      onClick={async () => {
                        setTesting(true)
                        setTestResult(null)
                         const firstModel = models.find((m) => m.enabled)
                        if (!firstModel) { setTesting(false); return }
                        const result = await testConnection(
                          providerType,
                          apiKey,
                          baseUrl || undefined,
                          firstModel.modelId,
                          providerId,
                        )
                        setTestResult(result)
                        setTesting(false)
                      }}
                      className="inline-flex items-center gap-1.5 rounded-2xl border border-accent/30 bg-accent/15 px-4 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {testing ? t('models.testing', 'Testing...') : <><IconifyIcon name="ui-plugin" size={14} color="currentColor" /> {t('models.testConnection', 'Test Connection')}</>}
                    </button>
                  </div>

                  {testResult && (
                    <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${testResult.success ? 'border-green-500/20 bg-green-500/10 text-green-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}`}>
                      <div className="inline-flex items-center gap-1.5 font-medium">
                        <IconifyIcon name={testResult.success ? 'ui-check' : 'ui-cross'} size={14} color="currentColor" />
                        {testResult.success
                          ? t('models.connectedWithLatency', 'Connected ({latency}ms)').replace('{latency}', String(testResult.latency ?? 0))
                          : testResult.error?.slice(0, 120)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </EditorSection>
          </div>

          <div className="space-y-6">
            <EditorSection
              eyebrow={t('models.title', 'Models')}
              title={t('models.catalog', 'Catalog & Defaults')}
              description={t('models.catalogHint', 'Enable only the models you want visible to the workspace. You can also define the provider-level default from here.')}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 px-4 py-3 text-sm text-text-secondary">
                  {t('models.modelsCount', '{enabled} enabled / {total} total').replace('{enabled}', String(enabledModelCount)).replace('{total}', String(models.length))}
                </div>
                {hasPresets && (
                  <button
                    type="button"
                    onClick={addPresetModels}
                    className="rounded-2xl bg-accent/10 px-4 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/20"
                  >
                    + {t('models.addPresets', 'Add Presets')}
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-2 max-h-96 overflow-y-auto pr-1">
                {models.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border-subtle px-4 py-8 text-center text-sm text-text-muted">
                    {hasPresets
                      ? t('models.noModelsAddedWithPresets', 'No models added yet. Click "Add Presets" or add manually below.')
                      : t('models.noModelsAdded', 'No models added yet. Add models manually below.')}
                  </div>
                ) : models.map((model, index) => {
                  const globalModelId = `${providerId}:${model.modelId}`
                  const isDefault = selectedModel?.id === globalModelId

                  return (
                    <div
                      key={model.modelId}
                      className={`rounded-3xl border px-4 py-3 transition-all duration-200 ${model.enabled ? 'border-accent/20 bg-accent/8' : 'border-transparent bg-surface-1'}`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <input
                            type="checkbox"
                            checked={model.enabled}
                            onChange={() => toggleModel(index)}
                            aria-label={t('models.enableModel', `Enable ${model.name}`).replace('{name}', () => model.name)}
                            className="mt-0.5 h-4 w-4 rounded border-border bg-surface-2 text-accent focus:ring-accent/30"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-text-primary">
                              {model.name}
                              {isDefault && <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">{t('models.defaultBadge', 'Default')}</span>}
                            </div>
                            <div className="mt-1 truncate text-[11px] text-text-muted">{model.modelId}</div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {model.enabled && !isDefault && (
                            <button
                              type="button"
                              onClick={() => {
                                const found = allModels.find((item) => item.id === globalModelId)
                                if (found) setSelectedModel(found)
                              }}
                              title={t('models.setDefaultModel', 'Set as default model')}
                              className="rounded-2xl bg-surface-2 px-3 py-1.5 text-[11px] font-semibold text-text-muted transition-colors hover:bg-accent/10 hover:text-accent"
                            >
                              ★ {t('models.defaultBadge', 'Default')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeModel(index)}
                            className="rounded-2xl bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-400 transition-colors hover:bg-red-500/20"
                          >
                            {t('common.remove', 'Remove')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-5 rounded-3xl border border-border-subtle/55 bg-surface-0/60 p-4">
                <div className="mb-3 text-xs font-medium uppercase tracking-wider text-text-muted">{t('models.addModel', 'Add Model')}</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    type="text"
                    value={newModelId}
                    onChange={(e) => setNewModelId(e.target.value)}
                    placeholder={t('models.modelIdPlaceholder', 'Model ID (e.g. gpt-4o)')}
                    className="w-full rounded-2xl border border-border bg-surface-2/75 px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                  <input
                    type="text"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addModel() } }}
                    placeholder={t('models.displayNameOptional', 'Display Name (optional)')}
                    className="w-full rounded-2xl border border-border bg-surface-2/75 px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <button
                  type="button"
                  onClick={addModel}
                  className="mt-3 rounded-2xl border border-accent/30 bg-accent/15 px-4 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/25"
                >
                  {t('common.add', 'Add')}
                </button>
              </div>
            </EditorSection>

            <EditorSection
              eyebrow={t('common.saveChanges', 'Save Changes')}
              title={t('models.reviewAndSave', 'Review & Save')}
              description={t('models.reviewAndSaveHint', 'Save persists the provider definition and refreshes the derived model list used across the workspace.')}
            >
              <div className="space-y-4">
                <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 px-4 py-4 text-sm text-text-secondary">
                  <div>{t('models.reviewSummary', 'Provider')} <span className="font-semibold text-text-primary">{name || t('models.newProvider', 'New Provider')}</span></div>
                  <div className="mt-1">{t('models.modelsCount', '{enabled} enabled / {total} total').replace('{enabled}', String(enabledModelCount)).replace('{total}', String(models.length))}</div>
                  {workspacePath && <div className="mt-2 truncate text-[11px] text-text-muted">{workspacePath}</div>}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-hover hover:shadow-[0_4px_20px_rgba(var(--t-accent-rgb),0.25)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? t('models.saving', 'Saving...') : t('models.saveConfiguration', 'Save Configuration')}
                  </button>
                  {saved && <span className="text-sm font-medium text-green-500 animate-fade-in">{workspacePath ? t('models.savedToWorkspace', 'Saved to workspace') : t('models.saved', 'Saved')}</span>}
                  {validationResult && !validationResult.valid && <span className="text-sm font-medium text-yellow-500 animate-fade-in"><IconifyIcon name="ui-warning" size={14} color="currentColor" /> {t('models.savedWithValidationWarning', 'Saved, but API key validation failed: {error}').replace('{error}', () => validationResult.error?.slice(0, 60) ?? '')}</span>}
                  {validationResult?.valid && !saved && <span className="text-sm font-medium text-green-500 animate-fade-in"><IconifyIcon name="ui-check" size={14} color="currentColor" /> {t('models.apiKeyValid', 'API key valid')}</span>}
                </div>
              </div>
            </EditorSection>
          </div>
        </div>
      </div>
    </div>
  )
}
