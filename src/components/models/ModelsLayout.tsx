import { useState, useEffect, useMemo, useDeferredValue } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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

type ModelsViewMode = 'providers' | 'models' | 'compare'

const MODEL_VIEW_MODES = new Set<ModelsViewMode>(['providers', 'models', 'compare'])

function generateId(): string {
  return `provider-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function ModelsLayout() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { view } = useParams<{ view: string }>()
  const [panelWidth, setPanelWidth] = useResizablePanel('models', 280)
  const { providerConfigs, addProviderConfig, removeProviderConfig, updateProviderConfig, syncModelsFromConfigs, models, workspacePath } = useAppStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<Record<string, 'connected' | 'disconnected' | 'checking'>>({})
  const [editingModelKey, setEditingModelKey] = useState<string | null>(null) // "providerId:modelId"
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const viewMode: ModelsViewMode = view && MODEL_VIEW_MODES.has(view as ModelsViewMode) ? view as ModelsViewMode : 'providers'

  useEffect(() => {
    if (!view || MODEL_VIEW_MODES.has(view as ModelsViewMode)) return
    navigate('/models/providers', { replace: true })
  }, [navigate, view])

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

  const connectedProviders = useMemo(() => providerConfigs.filter((provider) => connectionStatus[provider.id] === 'connected').length, [providerConfigs, connectionStatus])
  const enabledModelsCount = useMemo(() => models.filter((model) => model.enabled).length, [models])

  const filteredProviderConfigs = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase()
    if (!query) return providerConfigs

    return providerConfigs.filter((provider) => {
      const providerMatch = [provider.name, provider.providerType, provider.baseUrl].some((value) => value.toLowerCase().includes(query))
      const modelMatch = provider.models.some((model) => [model.name, model.modelId].some((value) => value.toLowerCase().includes(query)))
      return providerMatch || modelMatch
    })
  }, [providerConfigs, deferredSearchQuery])

  const groupedEnabledModels = useMemo(() => filteredProviderConfigs
    .map((provider) => ({
      provider,
      models: provider.models.filter((model) => model.enabled),
    }))
    .filter((entry) => entry.models.length > 0), [filteredProviderConfigs])

  const handleAddProvider = () => {
    const newConfig: ProviderConfig = {
      id: generateId(),
      name: t('models.newProvider', 'New Provider'),
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
        title={t('models.title', 'Models')}
        width={panelWidth}
        action={
          viewMode !== 'compare' ? (
            <button
              type="button"
              onClick={handleAddProvider}
              className="rounded-xl bg-accent/15 px-3 py-1.5 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/25"
              title={t('models.addProvider', 'Add provider')}
            >
              {t('models.addProvider', '+ Provider')}
            </button>
          ) : undefined
        }
      >
        <div className="px-3 pb-3 pt-1 space-y-3">
          <div className="rounded-3xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/92 to-surface-2/70 p-4 shadow-[0_14px_40px_rgba(var(--t-accent-rgb),0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/55">{t('models.workspace', 'Workspace')}</div>
                <div className="mt-1 text-[18px] font-semibold text-text-primary">{viewMode === 'providers' ? t('models.providers', 'Providers') : viewMode === 'models' ? t('models.allModels', 'All Models') : t('models.compare', 'Compare')}</div>
                <p className="mt-1 text-[12px] leading-relaxed text-text-secondary/80">{viewMode === 'providers' ? t('models.providersHeroHint', 'Manage provider credentials, model catalogs, and connection health in one place.') : viewMode === 'models' ? t('models.modelsHeroHint', 'Browse enabled models across every provider and jump straight into parameter tuning.') : t('models.compareHeroHint', 'Compare capability, pricing, and defaults side by side before picking the right model.')}</p>
              </div>
              <div className="rounded-2xl border border-accent/15 bg-surface-0/70 px-3 py-2 text-right shadow-sm">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('common.total', 'Total')}</div>
                <div className="text-xl font-semibold text-text-primary tabular-nums">{viewMode === 'providers' ? providerConfigs.length : enabledModelsCount}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/45">{t('models.providers', 'Providers')}</div>
                <div className="mt-1 text-[15px] font-semibold text-text-primary tabular-nums">{providerConfigs.length}</div>
              </div>
              <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/45">{t('models.connected', 'Connected')}</div>
                <div className="mt-1 text-[15px] font-semibold text-text-primary tabular-nums">{connectedProviders}</div>
              </div>
              <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/45">{t('models.enabled', 'Enabled')}</div>
                <div className="mt-1 text-[15px] font-semibold text-text-primary tabular-nums">{enabledModelsCount}</div>
              </div>
            </div>

            <div className="mt-4 flex gap-2 rounded-2xl border border-border-subtle/55 bg-surface-0/45 p-1.5">
              {([
                { value: 'providers', label: t('models.providers', 'Providers'), icon: 'ui-building' },
                { value: 'models', label: t('models.allModels', 'All Models'), icon: 'ui-clipboard' },
                { value: 'compare', label: t('models.compare', 'Compare'), icon: 'ui-scale' },
              ] as const).map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => navigate(`/models/${mode.value}`)}
                  className={`flex-1 rounded-xl px-3 py-2 text-[11px] font-semibold transition-colors ${viewMode === mode.value ? 'bg-accent/15 text-accent' : 'text-text-muted hover:bg-surface-3/60'}`}
                >
                  <span className="inline-flex items-center gap-1.5"><IconifyIcon name={mode.icon} size={14} color="currentColor" /> {mode.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <div className="relative">
              <IconifyIcon name="ui-search" size={14} color="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/55 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={viewMode === 'providers' ? t('models.searchProviders', 'Search providers or models...') : t('models.searchModels', 'Search models...')}
                className="w-full rounded-2xl border border-border-subtle/55 bg-surface-2/80 py-2.5 pl-10 pr-3 text-[12px] text-text-primary placeholder-text-muted/55 focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted/70">
              <span>{filteredProviderConfigs.length} {t('common.results', 'results')}</span>
              {searchQuery && <span>{providerConfigs.length} {t('common.total', 'total')}</span>}
            </div>
          </div>

          {viewMode === 'compare' ? (
            <div className="rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/65 text-text-muted/60">
                <IconifyIcon name="ui-scale" size={18} color="currentColor" />
              </div>
              <p className="text-[12px] leading-relaxed text-text-muted">{t('models.compareSidebarHint', 'Comparison mode is open in the main panel. Switch back anytime to keep editing providers and parameters.')}</p>
            </div>
          ) : viewMode === 'providers' ? (
            filteredProviderConfigs.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/65 text-text-muted/60">
                  <IconifyIcon name="ui-building" size={18} color="currentColor" />
                </div>
                <p className="text-[12px] leading-relaxed text-text-muted">{searchQuery ? t('models.noMatchingProviders', 'No matching providers.') : t('models.noProvidersConfigured', 'No providers configured. Click + Provider to add one.')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProviderConfigs.map((provider) => {
                  const enabledCount = provider.models.filter((m) => m.enabled).length
                  const isActive = selectedId === provider.id
                  const status = connectionStatus[provider.id]
                  const statusLabel = status === 'connected'
                    ? t('models.connected', 'Connected')
                    : status === 'checking'
                      ? t('models.checking', 'Checking...')
                      : t('models.disconnected', 'Disconnected')

                  return (
                    <div
                      key={provider.id}
                      tabIndex={0}
                      onClick={() => setSelectedId(provider.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(provider.id) } }}
                      className={`group w-full rounded-3xl border px-3.5 py-3.5 text-left transition-all duration-200 cursor-pointer ${isActive ? 'border-accent/20 bg-accent/10 shadow-[0_14px_34px_rgba(var(--t-accent-rgb),0.07)] text-text-primary' : 'border-transparent bg-surface-1/20 text-text-secondary hover:bg-surface-3/55 hover:border-border-subtle/60'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-0/75 text-xs font-bold text-accent shadow-sm">
                            {provider.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate text-[13px] font-semibold text-text-primary">{provider.name}</span>
                              <span className="rounded-full bg-surface-3/80 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-text-muted">{provider.providerType}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-text-secondary/80">{provider.baseUrl || t('models.defaultEndpointHint', 'Leave empty to use default endpoint.')}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-text-muted">
                              <span className="rounded-full bg-surface-3/80 px-2 py-0.5">{enabledCount > 0 ? t('models.enabledModelsCount', '{count} enabled').replace('{count}', String(enabledCount)) : t('models.notConfigured', 'Not configured')}</span>
                              <span className={`rounded-full px-2 py-0.5 ${status === 'connected' ? 'bg-green-500/15 text-green-400' : status === 'checking' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'}`}>{statusLabel}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRemoveProvider(provider.id) }}
                          aria-label={t('models.removeProvider', 'Remove provider')}
                          className="h-8 w-8 shrink-0 rounded-xl text-text-muted hover:text-danger hover:bg-danger/10 flex items-center justify-center text-xs"
                          title={t('models.removeProvider', 'Remove provider')}
                        >
                          <IconifyIcon name="ui-close" size={14} color="currentColor" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : (
            groupedEnabledModels.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/65 text-text-muted/60">
                  <IconifyIcon name="ui-clipboard" size={18} color="currentColor" />
                </div>
                <p className="text-[12px] leading-relaxed text-text-muted">{searchQuery ? t('models.noMatchingModels', 'No matching models.') : t('models.noModelsConfigured', 'No models configured. Switch to Providers view and add one.')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {groupedEnabledModels.map(({ provider, models: providerModels }) => {
                  const status = connectionStatus[provider.id]
                  return (
                    <section key={provider.id} className="rounded-3xl border border-border-subtle/55 bg-surface-0/55 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                      <div className="flex items-center justify-between gap-3 px-1 pb-2">
                        <div>
                          <div className="text-[12px] font-semibold text-text-primary">{provider.name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-text-muted">
                            <span>{providerModels.length} {t('models.enabled', 'enabled')}</span>
                            <span className={`h-1.5 w-1.5 rounded-full ${status === 'connected' ? 'bg-green-400' : status === 'checking' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'}`} />
                          </div>
                        </div>
                        <span className="rounded-full bg-surface-3/80 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-text-muted">{provider.providerType}</span>
                      </div>
                      <div className="space-y-2">
                        {providerModels.map((model) => {
                          const globalModelId = `${provider.id}:${model.modelId}`
                          const isDefault = models.find((item) => item.id === globalModelId)?.isDefault
                          const isEditing = editingModelKey === globalModelId

                          return (
                            <button
                              key={model.modelId}
                              type="button"
                              onClick={() => setEditingModelKey(isEditing ? null : globalModelId)}
                              className={`w-full rounded-[20px] border px-3 py-3 text-left transition-all ${isEditing ? 'border-accent/25 bg-accent/10 shadow-[0_10px_24px_rgba(var(--t-accent-rgb),0.06)]' : 'border-transparent bg-surface-1/35 hover:bg-surface-2/60 hover:border-border-subtle/55'}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="truncate text-[13px] font-medium text-text-primary">{model.name}</span>
                                    {isDefault && <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-semibold text-accent">{t('models.defaultBadge', 'Default')}</span>}
                                  </div>
                                  <div className="mt-1 truncate text-[10px] text-text-muted">{model.modelId}</div>
                                </div>
                                <IconifyIcon name="ui-chevron-right" size={14} color="currentColor" className="shrink-0 text-text-muted" />
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  )
                })}
              </div>
            )
          )}

          <div className="rounded-2xl border border-border-subtle/55 bg-surface-0/45 px-4 py-3 text-[11px] text-text-muted">
            <div>{t('models.totalConfigured', `${models.length} total model${models.length !== 1 ? 's' : ''} configured`).replace('{count}', String(models.length))}</div>
            {workspacePath && (
              <div className="mt-1 truncate" title={workspacePath}>
                {workspacePath}
              </div>
            )}
          </div>
        </div>
      </SidePanel>
      <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={224} maxWidth={360} />

      {viewMode === 'compare' ? (
        <ModelComparisonPanel onClose={() => navigate('/models/providers')} />
      ) : viewMode === 'providers' && selectedId ? (
        <ProviderEditor key={selectedId} providerId={selectedId} onSaved={handleProviderSaved} />
      ) : viewMode === 'models' ? (
        (() => {
          if (!editingModelKey) {
            return (
              <div className="flex-1 overflow-y-auto px-6 py-8 text-text-muted xl:px-10">
                <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center">
                  <div className="w-full rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/94 via-surface-1/88 to-surface-2/72 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.16)] animate-fade-in xl:p-10">
                    <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
                      <div className="max-w-2xl">
                        <div className="flex h-18 w-18 items-center justify-center rounded-[26px] border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.12)]">
                          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m3.08 3.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m3.08-3.08l4.24-4.24"/></svg>
                        </div>
                        <p className="mt-5 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('models.library', 'Library')}</p>
                        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">{t('models.allModels', 'All Models')}</h2>
                        <p className="mt-3 max-w-xl text-[14px] leading-7 text-text-secondary/82">{t('models.clickModelToEdit', 'Click a model to edit its parameters')}</p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3 xl:w-[24rem] xl:grid-cols-1">
                        <div className="rounded-[22px] border border-border-subtle/55 bg-surface-0/60 p-4">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('models.enabled', 'Enabled')}</div>
                          <div className="mt-2 text-2xl font-semibold text-text-primary tabular-nums">{enabledModelsCount}</div>
                        </div>
                        <div className="rounded-[22px] border border-border-subtle/55 bg-surface-0/60 p-4">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('models.providers', 'Providers')}</div>
                          <div className="mt-2 text-2xl font-semibold text-text-primary tabular-nums">{providerConfigs.length}</div>
                        </div>
                        <div className="rounded-[22px] border border-border-subtle/55 bg-surface-0/60 p-4">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('models.connected', 'Connected')}</div>
                          <div className="mt-2 text-2xl font-semibold text-text-primary tabular-nums">{connectedProviders}</div>
                        </div>
                      </div>
                    </div>
                  </div>
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
            return <div className="flex-1 flex items-center justify-center text-text-muted text-sm">{t('models.notFound', 'Model not found')}</div>
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
        <div className="flex-1 overflow-y-auto px-6 py-8 text-text-muted xl:px-10">
          <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center">
            <div className="w-full rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/94 via-surface-1/88 to-surface-2/72 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.16)] animate-fade-in xl:p-10 text-center">
              <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-[26px] border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.12)]">
                <IconifyIcon name="ui-building" size={30} color="currentColor" />
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-text-primary">{providerConfigs.length === 0 ? t('models.addProviderToBegin', 'Add a provider to begin') : t('models.selectProviderToConfigure', 'Select a provider to configure')}</h2>
              <p className="mt-3 text-[14px] leading-7 text-text-secondary/82">{providerConfigs.length === 0 ? t('models.noProvidersConfigured', 'No providers configured. Click + Provider to add one.') : t('models.providerSelectionHint', 'Choose a provider from the left rail to edit credentials, endpoints, and model availability.')}</p>
              {providerConfigs.length === 0 && (
                <button
                  type="button"
                  onClick={handleAddProvider}
                  className="mt-6 rounded-2xl bg-accent px-5 py-3 text-[13px] font-semibold text-white shadow-[0_10px_30px_rgba(var(--t-accent-rgb),0.22)] transition-all hover:bg-accent-hover"
                >
                  {t('models.addProvider', '+ Provider')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
