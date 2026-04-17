import { useState, useEffect } from 'react'
import { useAppStore, loadSettingsFromWorkspace, saveSettingsToWorkspace } from '@/store/appStore'
import { SidePanel } from '@/components/layout/SidePanel'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { testConnection } from '@/services/aiService'
import { confirm } from '@/services/confirmDialog'
import { useI18n } from '@/hooks/useI18n'
import type { ProviderConfig } from '@/types'
import { ProviderEditor } from './ProviderEditor'
import { ModelParamEditor } from './ModelParamEditor'
import { ModelComparisonPanel } from './ModelComparisonPanel'
import { ResizeHandle } from '@/components/layout/ResizeHandle'
import { useResizablePanel } from '@/hooks/useResizablePanel'

function generateId(): string {
  return `provider-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function ModelsLayout() {
  const { t } = useI18n()
  const [panelWidth, setPanelWidth] = useResizablePanel('models', 280)
  const { providerConfigs, addProviderConfig, removeProviderConfig, updateProviderConfig, syncModelsFromConfigs, models, workspacePath } = useAppStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [viewMode, setViewMode] = useState<'providers' | 'models' | 'compare'>('providers')
  const [connectionStatus, setConnectionStatus] = useState<Record<string, 'connected' | 'disconnected' | 'checking'>>({})
  const [editingModelKey, setEditingModelKey] = useState<string | null>(null) // "providerId:modelId"

  // Load settings from workspace on mount
  useEffect(() => {
    if (workspacePath && !loaded) {
      loadSettingsFromWorkspace().then(() => setLoaded(true))
    } else {
      setLoaded(true)
    }
  }, [workspacePath, loaded])

  // Check connection status for all configured providers on load
  useEffect(() => {
    if (!loaded) return
    providerConfigs.forEach((config) => {
      const hasKey = !!config.apiKey || config.providerType === 'ollama'
      const hasModels = config.models.some((m) => m.enabled)
      if (hasKey && hasModels) {
        setConnectionStatus((prev) => ({ ...prev, [config.id]: 'checking' }))
        const firstModel = config.models.find((m) => m.enabled) || config.models[0]
        if (firstModel) {
          testConnection(config.providerType, config.apiKey, config.baseUrl || undefined, firstModel.modelId, config.id)
            .then((result) => {
              setConnectionStatus((prev) => ({ ...prev, [config.id]: result.success ? 'connected' : 'disconnected' }))
            })
            .catch(() => {
              setConnectionStatus((prev) => ({ ...prev, [config.id]: 'disconnected' }))
            })
        }
      } else {
        setConnectionStatus((prev) => ({ ...prev, [config.id]: 'disconnected' }))
      }
    })
  }, [loaded, providerConfigs])

  // Auto-select first provider
  useEffect(() => {
    if (!selectedId && providerConfigs.length > 0) {
      setSelectedId(providerConfigs[0].id)
    }
  }, [providerConfigs, selectedId])

  const handleAddProvider = () => {
    const newConfig: ProviderConfig = {
      id: generateId(),
      name: 'New Provider',
      apiKey: '',
      baseUrl: '',
      providerType: 'openai-compatible',
      models: [],
    }
    addProviderConfig(newConfig)
    setSelectedId(newConfig.id)
  }

  const handleRemoveProvider = async (id: string) => {
    const target = providerConfigs.find((p) => p.id === id)
    if (!target) return
    const modelCount = target.models.length
    const ok = await confirm({
      title: t('models.deleteProviderTitle', 'Delete provider?'),
      body: t(
        'models.deleteProviderBody',
        `"${target.name}" will be removed along with its ${modelCount} model${modelCount === 1 ? '' : 's'} and API key. This cannot be undone.`,
      ),
      danger: true,
      confirmText: t('common.delete', 'Delete'),
    })
    if (!ok) return
    removeProviderConfig(id)
    syncModelsFromConfigs()
    if (selectedId === id) {
      setSelectedId(providerConfigs.find((p) => p.id !== id)?.id ?? null)
    }
  }

  const handleProviderSaved = () => {
    // Re-check connection status for the saved provider
    if (selectedId) {
      const config = providerConfigs.find((p) => p.id === selectedId)
      if (config) {
        const firstModel = config.models.find((m) => m.enabled) || config.models[0]
        if (firstModel && (config.apiKey || config.providerType === 'ollama')) {
          setConnectionStatus((prev) => ({ ...prev, [config.id]: 'checking' }))
          testConnection(config.providerType, config.apiKey, config.baseUrl || undefined, firstModel.modelId, config.id)
            .then((result) => {
              setConnectionStatus((prev) => ({ ...prev, [config.id]: result.success ? 'connected' : 'disconnected' }))
            })
            .catch(() => {
              setConnectionStatus((prev) => ({ ...prev, [config.id]: 'disconnected' }))
            })
        }
      }
    }
  }

  return (
    <>
      <SidePanel
        title="Models"
        width={panelWidth}
        action={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'compare' ? 'providers' : 'compare')}
              className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${viewMode === 'compare' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:bg-surface-3/60'}`}
              title="Compare models"
            >
              <IconifyIcon name="ui-scale" size={14} color="currentColor" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'providers' ? 'models' : 'providers')}
              className="text-[10px] px-2 py-1 rounded-lg text-text-muted hover:bg-surface-3/60 transition-colors"
              title={viewMode === 'providers' ? 'Show all models' : 'Show providers'}
            >
              {viewMode === 'providers' ? <IconifyIcon name="ui-clipboard" size={14} color="currentColor" /> : <IconifyIcon name="ui-building" size={14} color="currentColor" />}
            </button>
            {viewMode === 'providers' && (
              <button
                type="button"
                onClick={handleAddProvider}
                className="w-6 h-6 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 transition-colors flex items-center justify-center text-sm font-bold"
                title="Add Provider"
              >
                +
              </button>
            )}
          </div>
        }
      >
        {viewMode === 'providers' ? (
          <div className="p-2 space-y-1">
            {providerConfigs.length === 0 && (
              <p className="text-xs text-text-muted text-center py-8 px-4">
                No providers configured. Click + to add one.
              </p>
            )}
            {providerConfigs.map((provider) => {
              const enabledCount = provider.models.filter((m) => m.enabled).length
              const isActive = selectedId === provider.id
              const status = connectionStatus[provider.id]
              return (
                <div
                  key={provider.id}
                  tabIndex={0}
                  onClick={() => setSelectedId(provider.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(provider.id) } }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200 group cursor-pointer ${
                    isActive
                      ? 'bg-accent/10 text-text-primary shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.15)]'
                      : 'text-text-secondary hover:bg-surface-3/60 hover:text-text-primary'
                  }`}
                >
                  <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent text-xs font-bold flex items-center justify-center shrink-0">
                    {provider.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{provider.name}</div>
                    <div className="text-[11px] text-text-muted flex items-center gap-1.5">
                      {enabledCount > 0 ? `${enabledCount} model${enabledCount > 1 ? 's' : ''}` : 'Not configured'}
                      {status && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                          status === 'connected' ? 'bg-green-500/15 text-green-400' :
                          status === 'checking' ? 'bg-yellow-500/15 text-yellow-400' :
                          'bg-red-500/15 text-red-400'
                        }`}>
                          {status === 'connected' ? '● Connected' : status === 'checking' ? '○ Checking...' : '● Disconnected'}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveProvider(provider.id) }}
                    className="w-5 h-5 rounded text-text-muted hover:text-danger hover:bg-danger/10 items-center justify-center text-xs hidden group-hover:flex shrink-0"
                    title="Remove provider"
                  >
                    x
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          /* All Models View - grouped by provider */
          <div className="p-2 space-y-3">
            {providerConfigs.length === 0 && (
              <p className="text-xs text-text-muted text-center py-8 px-4">
                No models configured. Switch to Providers view and add one.
              </p>
            )}
            {providerConfigs.map((provider) => {
              const enabledModels = provider.models.filter((m) => m.enabled)
              if (enabledModels.length === 0) return null
              const status = connectionStatus[provider.id]
              return (
                <div key={provider.id}>
                  <div className="flex items-center gap-2 px-2 mb-1">
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">{provider.name}</span>
                    {status && (
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        status === 'connected' ? 'bg-green-400' :
                        status === 'checking' ? 'bg-yellow-400 animate-pulse' :
                        'bg-red-400'
                      }`} />
                    )}
                  </div>
                  {enabledModels.map((model) => {
                    const globalModelId = `${provider.id}:${model.modelId}`
                    const isDefault = models.find((m) => m.id === globalModelId)?.isDefault
                    const isEditing = editingModelKey === globalModelId
                    return (
                      <div
                        key={model.modelId}
                        onClick={() => setEditingModelKey(isEditing ? null : globalModelId)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition-all ${
                          isEditing
                            ? 'bg-accent/10 ring-1 ring-accent/20'
                            : 'hover:bg-surface-2/50'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-accent/50 shrink-0" />
                        <span className="text-text-primary truncate flex-1">{model.name}</span>
                        <code className="text-[10px] text-text-muted truncate max-w-30">{model.modelId}</code>
                        {isDefault && (
                          <span className="text-[9px] text-accent bg-accent/10 px-1.5 py-0.5 rounded-full font-semibold shrink-0">Default</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {/* Summary */}
        <div className="px-4 py-3 border-t border-border-subtle mt-2">
          <div className="text-[11px] text-text-muted">
            <div>{models.length} total model{models.length !== 1 ? 's' : ''} configured</div>
            {workspacePath && (
              <div className="mt-1 truncate" title={workspacePath}>
                {workspacePath}
              </div>
            )}
          </div>
        </div>
      </SidePanel>
      <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={200} maxWidth={480} />

      {viewMode === 'compare' ? (
        <ModelComparisonPanel onClose={() => setViewMode('providers')} />
      ) : viewMode === 'providers' && selectedId ? (
        <ProviderEditor providerId={selectedId} onSaved={handleProviderSaved} />
      ) : viewMode === 'models' ? (
        (() => {
          if (!editingModelKey) {
            return (
              <div className="flex-1 flex items-center justify-center text-text-muted">
                <div className="text-center animate-fade-in">
                  <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-5 border border-border-subtle">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m3.08 3.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m3.08-3.08l4.24-4.24"/></svg>
                  </div>
                  <p className="text-sm text-text-secondary font-medium">All Models</p>
                  <p className="text-xs text-text-muted mt-1">{models.filter((m) => m.enabled).length} enabled across {providerConfigs.length} providers</p>
                  <p className="text-xs text-text-muted mt-3">Click a model to edit its parameters</p>
                </div>
              </div>
            )
          }
          const [editProviderId, editModelId] = editingModelKey.split(':').length > 1
            ? [editingModelKey.substring(0, editingModelKey.indexOf(':')), editingModelKey.substring(editingModelKey.indexOf(':') + 1)]
            : [null, null]
          const provider = editProviderId ? providerConfigs.find((p) => p.id === editProviderId) : null
          const modelEntry = provider?.models.find((m) => m.modelId === editModelId)
          if (!provider || !modelEntry) {
            return <div className="flex-1 flex items-center justify-center text-text-muted text-sm">Model not found</div>
          }
          return (
            <ModelParamEditor
              key={editingModelKey}
              provider={provider}
              model={modelEntry}
              onSave={(updated) => {
                const newModels = provider.models.map((m) =>
                  m.modelId === modelEntry.modelId ? { ...m, ...updated } : m
                )
                updateProviderConfig(provider.id, { models: newModels })
                syncModelsFromConfigs()
                if (workspacePath) saveSettingsToWorkspace()
              }}
              onClose={() => setEditingModelKey(null)}
            />
          )
        })()
      ) : (
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
          {providerConfigs.length === 0 ? 'Add a provider to get started' : 'Select a provider to configure'}
        </div>
      )}
    </>
  )
}
