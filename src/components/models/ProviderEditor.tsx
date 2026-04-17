import { useState, useEffect, useCallback } from 'react'
import { useAppStore, saveSettingsToWorkspace } from '@/store/appStore'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { testConnection } from '@/services/aiService'
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

export function ProviderEditor({ providerId, onSaved }: { providerId: string; onSaved: () => void }) {
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
    setSaved(false)
  }, [config])

  const markDirty = () => setSaved(false)

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

    // Validate API key by testing connection if key is present and models exist
    const hasKey = !!apiKey || providerType === 'ollama'
    const firstModel = models.find((m) => m.enabled) || models[0]
    if (hasKey && firstModel) {
      const result = await testConnection(providerType, apiKey, baseUrl || undefined, firstModel.modelId, providerId)
      if (!result.success) {
        setValidationResult({ valid: false, error: result.error || 'API key validation failed' })
        // Still save but warn the user
      } else {
        setValidationResult({ valid: true })
      }
    }

    updateProviderConfig(providerId, { name, providerType, apiKey, baseUrl, models })
    setTimeout(async () => {
      syncModelsFromConfigs()
      if (workspacePath) {
        await saveSettingsToWorkspace()
      }
      setSaving(false)
      setSaved(true)
      onSaved()
    }, 50)
  }, [name, providerType, apiKey, baseUrl, models, providerId, updateProviderConfig, syncModelsFromConfigs, workspacePath, onSaved])

  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
        Select a provider to configure
      </div>
    )
  }

  const isOllama = providerType === 'ollama'
  const hasPresets = !!PRESET_MODELS[providerType]

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div>
        <div className="flex items-center gap-3 mb-8">
          <span className="w-10 h-10 rounded-xl bg-accent/10 text-accent text-sm font-bold flex items-center justify-center">
            {name.slice(0, 2).toUpperCase() || 'PR'}
          </span>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{name || 'New Provider'}</h2>
            <p className="text-xs text-text-muted">{PROVIDER_TYPES.find((t) => t.value === providerType)?.label || providerType}</p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Basic Info */}
          <section className="rounded-2xl border border-border p-6 bg-surface-0/30">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Provider Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); markDirty() }}
                  placeholder="My Provider"
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Provider Type</label>
                <select
                  value={providerType}
                  onChange={(e) => { setProviderType(e.target.value as ProviderConfig['providerType']); markDirty() }}
                  aria-label="Provider type"
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
                >
                  {PROVIDER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Connection */}
          <section className="rounded-2xl border border-border p-6 bg-surface-0/30">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Connection</h3>
            <div className="space-y-4">
              {!isOllama && (
                <div>
                  <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); markDirty() }}
                    placeholder="sk-..."
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                  Base URL {!isOllama && <span className="normal-case">(Optional)</span>}
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => { setBaseUrl(e.target.value); markDirty() }}
                  placeholder={isOllama ? 'http://localhost:11434/v1' : 'https://api.example.com/v1'}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
                />
                <p className="mt-1.5 text-[11px] text-text-muted">
                  {isOllama ? 'Default: http://localhost:11434/v1' : 'Leave empty to use default endpoint.'}
                </p>
              </div>

              {/* Test Connection */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={testing || (!apiKey && !isOllama) || models.length === 0}
                  onClick={async () => {
                    setTesting(true)
                    setTestResult(null)
                    const firstModel = models.find((m) => m.enabled) || models[0]
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
                  className="px-4 py-2 rounded-xl bg-accent/15 text-accent text-sm font-medium hover:bg-accent/25 transition-colors border border-accent/30 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                >
                  {testing ? 'Testing...' : <><IconifyIcon name="ui-plugin" size={14} color="currentColor" /> Test Connection</>}
                </button>
                {testResult && (
                    <span className={`ml-3 text-sm font-medium inline-flex items-center gap-1 ${testResult.success ? 'text-green-500' : 'text-danger'}`}>
                    {testResult.success
                      ? <><IconifyIcon name="ui-check" size={14} color="currentColor" /> Connected ({testResult.latency}ms)</>
                      : <><IconifyIcon name="ui-cross" size={14} color="currentColor" /> {testResult.error?.slice(0, 80)}</>
                    }
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Models */}
          <section className="rounded-2xl border border-border p-6 bg-surface-0/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary">
                Models
                <span className="ml-2 text-xs font-normal text-text-muted">
                  ({models.filter((m) => m.enabled).length} enabled / {models.length} total)
                </span>
              </h3>
              {hasPresets && (
                <button
                  type="button"
                  onClick={addPresetModels}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium"
                >
                  + Add Presets
                </button>
              )}
            </div>

            <div className="space-y-1.5 mb-4">
              {models.length === 0 && (
                <p className="text-sm text-text-muted py-4 text-center">
                  No models added yet.{hasPresets ? ' Click "Add Presets" or add manually below.' : ' Add models manually below.'}
                </p>
              )}
              {models.map((model, index) => {
                const globalModelId = `${providerId}:${model.modelId}`
                const isDefault = selectedModel?.id === globalModelId
                return (
                <div
                  key={model.modelId}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border ${
                    model.enabled
                      ? 'bg-accent/8 border-accent/20'
                      : 'bg-surface-1 border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={model.enabled}
                    onChange={() => toggleModel(index)}
                    aria-label={`Enable ${model.name}`}
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent/30 bg-surface-2 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-text-primary flex items-center gap-1.5">
                      {model.name}
                      {isDefault && (
                        <span className="text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded-full font-semibold">Default</span>
                      )}
                    </div>
                    <div className="text-[11px] text-text-muted truncate">
                      <code>{model.modelId}</code>
                    </div>
                  </div>
                  {model.enabled && !isDefault && (
                    <button
                      onClick={() => {
                        const found = allModels.find((m) => m.id === globalModelId)
                        if (found) setSelectedModel(found)
                      }}
                      title="Set as default model"
                      className="text-[10px] px-2 py-1 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors font-medium flex-shrink-0"
                    >
                      ★ Default
                    </button>
                  )}
                  <button
                    onClick={() => removeModel(index)}
                    className="text-xs text-danger hover:text-danger/80 font-medium flex-shrink-0"
                  >
                    Remove
                  </button>
                </div>
                )
              })}
            </div>

            <div className="pt-3 border-t border-border-subtle">
              <div className="text-xs font-medium text-text-muted mb-2">Add Model</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newModelId}
                  onChange={(e) => setNewModelId(e.target.value)}
                  placeholder="Model ID (e.g. gpt-4o)"
                  className="flex-1 px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
                <input
                  type="text"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addModel() } }}
                  placeholder="Display Name (optional)"
                  className="flex-1 px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
                <button
                  type="button"
                  onClick={addModel}
                  className="px-4 py-2 rounded-xl bg-accent/15 text-accent text-sm font-medium hover:bg-accent/25 transition-colors border border-accent/30"
                >
                  Add
                </button>
              </div>
            </div>
          </section>

          {/* Save */}
          <div className="flex items-center gap-4 pt-2 pb-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover hover:shadow-[0_4px_20px_rgba(var(--t-accent-rgb),0.25)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            {saved && (
              <span className="text-sm text-green-500 font-medium animate-fade-in">
                Saved{workspacePath ? ' to workspace' : ''}
              </span>
            )}
            {validationResult && !validationResult.valid && (
              <span className="text-sm text-yellow-500 font-medium animate-fade-in">
                <IconifyIcon name="ui-warning" size={14} color="currentColor" /> Saved, but API key validation failed: {validationResult.error?.slice(0, 60)}
              </span>
            )}
            {validationResult?.valid && !saved && (
              <span className="text-sm text-green-500 font-medium animate-fade-in">
                <IconifyIcon name="ui-check" size={14} color="currentColor" /> API key valid
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
