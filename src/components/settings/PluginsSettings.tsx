import { useState, useEffect, useRef, useMemo } from 'react'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'
import { ICON_DATA, IconifyIcon } from '@/components/icons/IconifyIcons'
import { confirm } from '@/services/confirmDialog'
import type { PluginInfo } from '@/types'
import {
  PLUGIN_TEMPLATES,
  PLUGIN_MARKETPLACE_CATALOG,
  validatePlugin,
  activatePlugin,
  deactivatePlugin,
  checkPluginUpdate,
  getDefaultConfig,
  getPluginToolNames,
  getResolvedPluginEntryPoint,
  loadPluginFromManifest,
  resolvePluginRuntimeModule,
  searchMarketplacePlugins,
  installMarketplacePlugin,
} from '@/services/pluginSystem'
import type { PluginManifestV2 } from '@/types'
import type { MarketplacePlugin } from '@/services/pluginSystem'

export function PluginsSettings() {
  const { t } = useI18n()
  const {
    marketplace, setMarketplace,
    installedPlugins, addInstalledPlugin, updateInstalledPlugin, removeInstalledPlugin,
    pluginTools, setPluginTools, removePluginTools,
  } = useAppStore()

  const [configPluginId, setConfigPluginId] = useState<string | null>(null)
  const [configValues, setConfigValues] = useState<Record<string, unknown>>({})
  const [configSaved, setConfigSaved] = useState(false)
  const configSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [showInstall, setShowInstall] = useState(false)
  const [installTab, setInstallTab] = useState<'template' | 'json'>('template')
  const [jsonInput, setJsonInput] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [pluginTab, setPluginTab] = useState<'installed' | 'marketplace'>('installed')
  const [marketplaceSearch, setMarketplaceSearch] = useState('')
  const [marketplaceCategory, setMarketplaceCategory] = useState<string>('')
  const [sortBy, setSortBy] = useState<'downloads' | 'rating' | 'name'>('downloads')

  useEffect(() => () => { clearTimeout(configSaveTimerRef.current) }, [])

  const filteredMarketplace = useMemo(() => {
    const results = searchMarketplacePlugins(marketplaceSearch, marketplaceCategory ? (marketplaceCategory as MarketplacePlugin['category']) : undefined)
    return results.sort((a, b) => {
      if (sortBy === 'downloads') return b.downloads - a.downloads
      if (sortBy === 'rating') return b.rating - a.rating
      return a.name.localeCompare(b.name)
    })
  }, [marketplaceSearch, marketplaceCategory, sortBy])

  const handleInstallFromMarketplace = (mp: MarketplacePlugin) => {
    if (installedPlugins.some((p) => p.id === mp.id)) return
    const plugin = installMarketplacePlugin(mp)
    addInstalledPlugin(plugin)
  }

  const openConfig = (plugin: PluginInfo) => {
    clearTimeout(configSaveTimerRef.current)
    setConfigPluginId(plugin.id)
    setConfigValues({ ...(plugin.config || {}) })
    setConfigSaved(false)
  }

  const saveConfig = () => {
    if (!configPluginId) return
    clearTimeout(configSaveTimerRef.current)
    updateInstalledPlugin(configPluginId, { config: configValues })
    setConfigSaved(true)
    configSaveTimerRef.current = setTimeout(() => { setConfigSaved(false); setConfigPluginId(null) }, 1200)
  }

  const installFromTemplate = async (template: typeof PLUGIN_TEMPLATES[number]) => {
    const pluginId = `plugin-${template.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
    const plugin: PluginInfo = {
      ...template,
      id: pluginId,
      installedAt: Date.now(),
      config: template.configSchema ? getDefaultConfig(template.configSchema) : (template.config || {}),
      entryPoint: getResolvedPluginEntryPoint(template),
    }
    addInstalledPlugin(plugin)
    const mod = resolvePluginRuntimeModule(plugin)
    if (mod) {
      await activatePlugin(plugin, mod)
      updateInstalledPlugin(pluginId, { status: 'enabled', error: undefined, entryPoint: plugin.entryPoint })
      const toolNames = getPluginToolNames(pluginId)
      if (toolNames.length > 0) setPluginTools(pluginId, toolNames)
      else removePluginTools(pluginId)
    }
    setShowInstall(false)
  }

  const installFromJson = async () => {
    setJsonError('')
    try {
      const manifest = JSON.parse(jsonInput) as PluginManifestV2
      const validation = validatePlugin(manifest)
      if (!validation.valid) { setJsonError(validation.errors.join('; ')); return }
      const plugin = await loadPluginFromManifest(manifest)
      addInstalledPlugin(plugin)
      setJsonInput('')
      setShowInstall(false)
    } catch (e) { setJsonError(e instanceof Error ? e.message : 'Invalid JSON') }
  }

  const togglePlugin = async (plugin: PluginInfo) => {
    if (plugin.status === 'enabled') {
      await deactivatePlugin(plugin.id); removePluginTools(plugin.id); updateInstalledPlugin(plugin.id, { status: 'disabled', error: undefined })
    } else {
      const resolvedEntryPoint = getResolvedPluginEntryPoint(plugin)
      const mod = resolvePluginRuntimeModule(plugin)
      if (!mod) {
        removePluginTools(plugin.id)
        updateInstalledPlugin(plugin.id, {
          status: 'installed',
          error: t('settings.pluginRuntimeUnavailable', 'Runtime module unavailable for this plugin.'),
          ...(resolvedEntryPoint ? { entryPoint: resolvedEntryPoint } : {}),
        })
        return
      }

      try {
        await activatePlugin(plugin, mod)
        const toolNames = getPluginToolNames(plugin.id)
        if (toolNames.length > 0) setPluginTools(plugin.id, toolNames)
        else removePluginTools(plugin.id)
        updateInstalledPlugin(plugin.id, {
          status: 'enabled',
          error: undefined,
          ...(resolvedEntryPoint ? { entryPoint: resolvedEntryPoint } : {}),
        })
      } catch (error) {
        removePluginTools(plugin.id)
        updateInstalledPlugin(plugin.id, {
          status: 'installed',
          error: error instanceof Error ? error.message : String(error),
          ...(resolvedEntryPoint ? { entryPoint: resolvedEntryPoint } : {}),
        })
      }
    }
  }

  const configPlugin = configPluginId ? installedPlugins.find((p) => p.id === configPluginId) : null

  return (
    <div className="space-y-6">
      <div className="flex gap-2 mb-4">
        <button onClick={() => setPluginTab('installed')} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all inline-flex items-center gap-1.5 ${pluginTab === 'installed' ? 'bg-accent/15 border-accent/30 text-accent' : 'bg-surface-2 border-border text-text-muted'}`}>
          <IconifyIcon name="ui-package" size={14} color="currentColor" /> {t('settings.installed', 'Installed')} ({installedPlugins.length})
        </button>
        <button onClick={() => setPluginTab('marketplace')} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all inline-flex items-center gap-1.5 ${pluginTab === 'marketplace' ? 'bg-accent/15 border-accent/30 text-accent' : 'bg-surface-2 border-border text-text-muted'}`}>
          <IconifyIcon name="ui-store" size={14} color="currentColor" /> {t('settings.marketplace', 'Marketplace')} ({PLUGIN_MARKETPLACE_CATALOG.length})
        </button>
      </div>

      {pluginTab === 'installed' && (<>
        <div className="rounded-xl border border-border p-4 bg-surface-0/30">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('settings.marketplaceSource', 'Skill Marketplace Source')}</h3>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button onClick={() => setMarketplace({ source: 'official' })} className={`px-3 py-2.5 rounded-xl text-sm border transition-all ${marketplace.source === 'official' ? 'bg-accent/15 border-accent/30 text-accent' : 'bg-surface-2 border-border text-text-muted'}`}>{t('settings.officialMarket', 'Official Market')}</button>
            <button onClick={() => setMarketplace({ source: 'private' })} className={`px-3 py-2.5 rounded-xl text-sm border transition-all ${marketplace.source === 'private' ? 'bg-accent/15 border-accent/30 text-accent' : 'bg-surface-2 border-border text-text-muted'}`}>{t('settings.privateMarket', 'Private Market')}</button>
          </div>
          {marketplace.source === 'private' && (
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('settings.privateMarketUrl', 'Private Market URL')}</label>
              <input value={marketplace.privateUrl} onChange={(e) => setMarketplace({ privateUrl: e.target.value })} placeholder="https://your-company.example.com/skills.json"
                className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary text-sm" />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border p-4 bg-surface-0/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">{t('settings.installPlugin', 'Install Plugin')}</h3>
            <button onClick={() => setShowInstall(!showInstall)} className="px-3 py-1.5 text-xs font-medium bg-accent/15 text-accent border border-accent/30 rounded-lg hover:bg-accent/25 transition-colors">
              {showInstall ? t('settings.cancel', 'Cancel') : `+ ${t('settings.install', 'Install')}`}
            </button>
          </div>
          {showInstall && (
            <div className="space-y-3">
              <div className="flex gap-2 mb-2">
                <button onClick={() => setInstallTab('template')} className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${installTab === 'template' ? 'bg-accent/15 border-accent/30 text-accent' : 'bg-surface-2 border-border text-text-muted'}`}>{t('settings.fromTemplate', 'From Template')}</button>
                <button onClick={() => setInstallTab('json')} className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${installTab === 'json' ? 'bg-accent/15 border-accent/30 text-accent' : 'bg-surface-2 border-border text-text-muted'}`}>{t('settings.fromJson', 'From JSON')}</button>
              </div>
              {installTab === 'template' && (
                <div className="space-y-2">
                  {PLUGIN_TEMPLATES.map((tpl, idx) => {
                    const alreadyInstalled = installedPlugins.some((p) => p.name === tpl.name)
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-surface-2 border border-border-subtle">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{tpl.icon && ICON_DATA[tpl.icon] ? <IconifyIcon name={tpl.icon} /> : <IconifyIcon name="ui-plugin" />}</span>
                          <div>
                            <span className="text-sm font-medium text-text-primary">{tpl.name}</span>
                            <p className="text-xs text-text-muted">{tpl.description}</p>
                            {tpl.permissions && tpl.permissions.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{tpl.permissions.map((p) => <span key={p} className="px-1.5 py-0.5 text-[10px] bg-surface-3 rounded text-text-muted">{p}</span>)}</div>}
                          </div>
                        </div>
                        <button onClick={() => installFromTemplate(tpl)} disabled={alreadyInstalled} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${alreadyInstalled ? 'bg-surface-3 text-text-muted cursor-not-allowed' : 'bg-accent/15 text-accent hover:bg-accent/25'}`}>
                          {alreadyInstalled ? t('settings.installed', 'Installed') : t('settings.install', 'Install')}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              {installTab === 'json' && (
                <div className="space-y-2">
                  <textarea value={jsonInput} onChange={(e) => setJsonInput(e.target.value)} placeholder={'{\n  "id": "my-plugin",\n  "name": "My Plugin",\n  "version": "1.0.0",\n  "hooks": ["afterResponse"],\n  "permissions": ["messages:read"]\n}'} className="w-full h-36 px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary font-mono text-xs resize-none" />
                  {jsonError && <p className="text-xs text-red-400">{jsonError}</p>}
                  <button onClick={installFromJson} className="px-4 py-2 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors">{t('settings.installFromJson', 'Install from JSON')}</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border p-4 bg-surface-0/30">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('settings.installedPlugins', 'Installed Plugins')} ({installedPlugins.length})</h3>
          {installedPlugins.length === 0 ? (
            <p className="text-xs text-text-muted py-4 text-center">{t('settings.noPlugins', 'No plugins installed yet.')}</p>
          ) : (
            <div className="space-y-2">
              {installedPlugins.map((plugin) => {
                const hasUpdate = plugin.latestVersion ? checkPluginUpdate(plugin, plugin.latestVersion) : false
                const registeredTools = pluginTools[plugin.id] || []
                return (
                  <div key={plugin.id} className="p-3 rounded-lg bg-surface-2 border border-border-subtle">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{plugin.icon && ICON_DATA[plugin.icon] ? <IconifyIcon name={plugin.icon} /> : <IconifyIcon name="ui-plugin" />}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary">{plugin.name}</span>
                            {hasUpdate && <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/15 text-blue-400 rounded">{t('settings.updateAvailable', 'Update Available')}</span>}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-text-muted">
                            <span>v{plugin.version}</span>
                            {plugin.author && <span>{t('settings.byAuthor', 'by')} {plugin.author}</span>}
                            {plugin.permissions && plugin.permissions.length > 0 && <span className="text-[10px]">· {plugin.permissions.length} {t('settings.permissions', 'permissions')}</span>}
                            {registeredTools.length > 0 && <span className="text-[10px] text-accent">· {registeredTools.length} {t('settings.tools', 'tools')}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {plugin.configSchema && Object.keys(plugin.configSchema).length > 0 && (
                          <button onClick={() => openConfig(plugin)} className="px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-surface-3 rounded-md transition-colors" title={t('settings.configure', 'Configure')}><IconifyIcon name="ui-gear" size={14} color="currentColor" /></button>
                        )}
                        <button onClick={() => togglePlugin(plugin)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${plugin.status === 'enabled' ? 'bg-green-500/15 text-green-400 border-green-500/20' : 'bg-surface-3 text-text-muted border-border-subtle'}`}>
                          {plugin.status === 'enabled' ? t('settings.enabled', '● Enabled') : t('settings.disabled', '○ Disabled')}
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await confirm({
                              title: t('settings.uninstallTitle', 'Uninstall plugin?'),
                              body: t(
                                'settings.uninstallBody',
                                `"${plugin.name}" and its registered tools will be removed. Any saved configuration will also be cleared.`,
                              ),
                              danger: true,
                              confirmText: t('settings.uninstall', 'Uninstall'),
                            })
                            if (!ok) return
                            deactivatePlugin(plugin.id)
                            removePluginTools(plugin.id)
                            removeInstalledPlugin(plugin.id)
                          }}
                          className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                        >
                          {t('settings.uninstall', 'Uninstall')}
                        </button>
                      </div>
                    </div>
                    {plugin.description && <p className="text-xs text-text-muted mt-1 ml-9">{plugin.description}</p>}
                    {plugin.error && <p className="text-xs text-red-400 mt-1 ml-9">{plugin.error}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </>)}

      {pluginTab === 'marketplace' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={marketplaceSearch} onChange={(e) => setMarketplaceSearch(e.target.value)} placeholder={t('settings.searchPlugins', 'Search plugins...')} className="flex-1 px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm" />
            <select value={marketplaceCategory} onChange={(e) => setMarketplaceCategory(e.target.value)} title="Category filter" className="px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm">
              <option value="">{t('settings.allCategories', 'All Categories')}</option>
              <option value="communication">{t('settings.communication', 'Communication')}</option>
              <option value="productivity">{t('settings.productivity', 'Productivity')}</option>
              <option value="developer">{t('settings.developer', 'Developer')}</option>
              <option value="ai">{t('settings.ai', 'AI')}</option>
              <option value="utility">{t('settings.utility', 'Utility')}</option>
              <option value="integration">{t('settings.integration', 'Integration')}</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'downloads' | 'rating' | 'name')} title="Sort by" className="px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm">
              <option value="downloads">{t('settings.downloads', 'Downloads')}</option>
              <option value="rating">{t('settings.rating', 'Rating')}</option>
              <option value="name">{t('settings.name', 'Name')}</option>
            </select>
          </div>
          <div className="space-y-2">
            {filteredMarketplace.map((mp) => {
              const isInstalled = installedPlugins.some((p) => p.id === mp.id)
              return (
                <div key={mp.id} className="p-4 rounded-xl bg-surface-2 border border-border-subtle hover:border-border transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{mp.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-text-primary">{mp.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-surface-3 rounded text-text-muted">{mp.category}</span>
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">{mp.description}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted">
                          <span>v{mp.version}</span><span>by {mp.author}</span>
                          <span>{'★'.repeat(Math.round(mp.rating))}{'☆'.repeat(5 - Math.round(mp.rating))} {mp.rating.toFixed(1)}</span>
                          <span className="inline-flex items-center gap-0.5"><IconifyIcon name="ui-download" size={12} color="currentColor" /> {mp.downloads.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">{mp.tags.map((tag) => <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-surface-3 rounded text-text-muted">{tag}</span>)}</div>
                        {mp.permissions.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{mp.permissions.map((perm) => <span key={perm} className="px-1.5 py-0.5 text-[10px] bg-amber-500/10 text-amber-400 rounded">{perm}</span>)}</div>}
                      </div>
                    </div>
                    <button onClick={() => handleInstallFromMarketplace(mp)} disabled={isInstalled} className={`px-4 py-2 text-xs font-medium rounded-lg shrink-0 transition-colors inline-flex items-center gap-1.5 ${isInstalled ? 'bg-green-500/10 text-green-400 cursor-default' : 'bg-accent text-white hover:bg-accent/80'}`}>
                      {isInstalled ? <><IconifyIcon name="ui-check" size={14} color="currentColor" /> {t('settings.installed', 'Installed')}</> : t('settings.install', 'Install')}
                    </button>
                  </div>
                </div>
              )
            })}
            {filteredMarketplace.length === 0 && <p className="text-xs text-text-muted py-8 text-center">{t('settings.noPluginsMatch', 'No plugins match your search criteria.')}</p>}
          </div>
        </div>
      )}

      {configPlugin && configPlugin.configSchema && (
        <div className="rounded-xl border border-accent/30 p-4 bg-accent/5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">{t('settings.configure', 'Configure')}: {configPlugin.name}</h3>
            <button onClick={() => setConfigPluginId(null)} title="Close" className="text-xs text-text-muted hover:text-text-primary"><IconifyIcon name="ui-close" size={14} color="currentColor" /></button>
          </div>
          <div className="space-y-3">
            {Object.entries(configPlugin.configSchema).map(([key, field]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-text-muted mb-1">{field.label || key}</label>
                {field.description && <p className="text-[10px] text-text-muted mb-1">{field.description}</p>}
                {field.type === 'string' && <input value={String(configValues[key] ?? field.default ?? '')} onChange={(e) => setConfigValues({ ...configValues, [key]: e.target.value })} aria-label={field.label || key} className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-text-primary text-sm" />}
                {field.type === 'number' && <input type="number" value={Number(configValues[key] ?? field.default ?? 0)} onChange={(e) => setConfigValues({ ...configValues, [key]: Number(e.target.value) })} aria-label={field.label || key} className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-text-primary text-sm" />}
                {field.type === 'boolean' && <button onClick={() => setConfigValues({ ...configValues, [key]: !configValues[key] })} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${configValues[key] ? 'bg-green-500/15 text-green-400 border-green-500/20' : 'bg-surface-3 text-text-muted border-border-subtle'}`}>{configValues[key] ? t('settings.enabled', '● Enabled') : t('settings.disabled', '○ Disabled')}</button>}
                {field.type === 'select' && field.options && <select value={String(configValues[key] ?? field.default ?? '')} onChange={(e) => setConfigValues({ ...configValues, [key]: e.target.value })} aria-label={field.label || key} className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-text-primary text-sm">{field.options.map((opt) => <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>)}</select>}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button onClick={saveConfig} disabled={configSaved} className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1.5 ${configSaved ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-accent text-white hover:bg-accent/80'}`}>
              {configSaved ? <><IconifyIcon name="ui-check" size={14} color="currentColor" /> {t('settings.savedConfig', 'Saved')}</> : t('settings.saveConfig', 'Save Configuration')}
            </button>
            <button onClick={() => setConfigPluginId(null)} className="px-4 py-2 text-xs font-medium bg-surface-3 text-text-muted rounded-lg hover:bg-surface-2 transition-colors">{t('settings.cancel', 'Cancel')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
