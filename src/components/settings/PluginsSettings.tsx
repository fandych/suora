import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'
import { ICON_DATA, IconifyIcon } from '@/components/icons/IconifyIcons'
import { confirm } from '@/services/confirmDialog'
import type { PluginConfigField, PluginInfo, PluginManifestV2 } from '@/types'
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
import type { MarketplacePlugin } from '@/services/pluginSystem'
import { SettingsSection, SettingsStat, settingsInputClass, settingsTextAreaClass } from './panelUi'

const MARKETPLACE_CATEGORIES: Array<{ value: '' | MarketplacePlugin['category']; label: string }> = [
  { value: '', label: 'All Categories' },
  { value: 'communication', label: 'Communication' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'developer', label: 'Developer' },
  { value: 'ai', label: 'AI' },
  { value: 'utility', label: 'Utility' },
  { value: 'integration', label: 'Integration' },
]

const PANEL_CARD_CLASS = 'rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]'

function TabButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean
  icon: string
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all ${
        active
          ? 'border-accent/20 bg-accent/10 text-accent shadow-[0_10px_24px_rgba(var(--t-accent-rgb),0.08)]'
          : 'border-border-subtle/55 bg-surface-0/72 text-text-secondary hover:bg-surface-2'
      }`}
    >
      <IconifyIcon name={icon} size={15} color="currentColor" />
      <span>{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? 'bg-accent/12 text-accent' : 'bg-surface-3 text-text-muted'}`}>{count}</span>
    </button>
  )
}

function MetaPill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
}) {
  const toneClass =
    tone === 'accent'
      ? 'bg-accent/12 text-accent'
      : tone === 'success'
        ? 'bg-green-500/12 text-green-400'
        : tone === 'warning'
          ? 'bg-amber-500/12 text-amber-400'
          : tone === 'danger'
            ? 'bg-red-500/12 text-red-400'
            : 'bg-surface-3 text-text-muted'

  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${toneClass}`}>{children}</span>
}

function RatingStars({ rating }: { rating: number }) {
  return <span>{'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}</span>
}

function PluginIcon({ icon }: { icon?: string }) {
  if (icon && ICON_DATA[icon]) {
    return <IconifyIcon name={icon} size={20} color="currentColor" />
  }

  if (icon) {
    return <span className="text-lg leading-none">{icon}</span>
  }

  return <IconifyIcon name="ui-plugin" size={20} color="currentColor" />
}

function ConfigFieldControl({
  fieldKey,
  field,
  value,
  onChange,
  t,
}: {
  fieldKey: string
  field: PluginConfigField
  value: unknown
  onChange: (value: unknown) => void
  t: (key: string, fallback: string) => string
}) {
  const resolvedValue = value ?? field.default

  return (
    <div className={PANEL_CARD_CLASS}>
      <label className="block text-[12px] font-medium text-text-primary">{field.label || fieldKey}</label>
      {field.description && <p className="mt-1 text-[11px] leading-5 text-text-muted">{field.description}</p>}
      <div className="mt-3">
        {field.type === 'string' && (
          <input
            value={String(resolvedValue ?? '')}
            onChange={(event) => onChange(event.target.value)}
            aria-label={field.label || fieldKey}
            className={settingsInputClass}
          />
        )}
        {field.type === 'number' && (
          <input
            type="number"
            value={Number(resolvedValue ?? 0)}
            onChange={(event) => onChange(Number(event.target.value))}
            aria-label={field.label || fieldKey}
            className={settingsInputClass}
          />
        )}
        {field.type === 'boolean' && (
          <button
            type="button"
            onClick={() => onChange(!Boolean(resolvedValue))}
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${resolvedValue ? 'border-green-500/18 bg-green-500/10 text-green-400 hover:bg-green-500/16' : 'border-border-subtle/55 bg-surface-2/70 text-text-secondary hover:bg-surface-3'}`}
          >
            {resolvedValue ? t('settings.enabled', 'Enabled') : t('settings.disabled', 'Disabled')}
          </button>
        )}
        {field.type === 'select' && field.options && (
          <select
            value={String(resolvedValue ?? '')}
            onChange={(event) => onChange(event.target.value)}
            aria-label={field.label || fieldKey}
            className={settingsInputClass}
          >
            {field.options.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>{option.label}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}

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
  const deferredMarketplaceSearch = useDeferredValue(marketplaceSearch)

  useEffect(() => () => { clearTimeout(configSaveTimerRef.current) }, [])

  const filteredMarketplace = useMemo(() => {
    const results = searchMarketplacePlugins(deferredMarketplaceSearch, marketplaceCategory ? (marketplaceCategory as MarketplacePlugin['category']) : undefined)
    return [...results].sort((a, b) => {
      if (sortBy === 'downloads') return b.downloads - a.downloads
      if (sortBy === 'rating') return b.rating - a.rating
      return a.name.localeCompare(b.name)
    })
  }, [deferredMarketplaceSearch, marketplaceCategory, sortBy])

  const installedPluginIds = useMemo(() => new Set(installedPlugins.map((plugin) => plugin.id)), [installedPlugins])
  const enabledPluginsCount = useMemo(() => installedPlugins.filter((plugin) => plugin.status === 'enabled').length, [installedPlugins])
  const updateCount = useMemo(() => installedPlugins.filter((plugin) => plugin.latestVersion && checkPluginUpdate(plugin, plugin.latestVersion)).length, [installedPlugins])
  const totalToolCount = useMemo(() => Object.values(pluginTools).reduce((sum, tools) => sum + tools.length, 0), [pluginTools])

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
      <SettingsSection
        eyebrow={t('settings.plugins', 'Plugins')}
        title={t('settings.pluginControlCenter', 'Plugin Control Center')}
        description={t('settings.pluginControlCenterHint', 'Manage install sources, browse the marketplace, enable runtime extensions, and tune plugin-specific configuration from one structured control surface.')}
        action={
          <div className="flex flex-wrap gap-2">
            <TabButton active={pluginTab === 'installed'} icon="ui-package" label={t('settings.installed', 'Installed')} count={installedPlugins.length} onClick={() => setPluginTab('installed')} />
            <TabButton active={pluginTab === 'marketplace'} icon="ui-store" label={t('settings.marketplace', 'Marketplace')} count={PLUGIN_MARKETPLACE_CATALOG.length} onClick={() => setPluginTab('marketplace')} />
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SettingsStat label={t('settings.installed', 'Installed')} value={String(installedPlugins.length)} accent />
          <SettingsStat label={t('settings.enabled', 'Enabled')} value={String(enabledPluginsCount)} />
          <SettingsStat label={t('settings.tools', 'Tools')} value={String(totalToolCount)} />
          <SettingsStat label={t('settings.updateAvailable', 'Updates')} value={String(updateCount)} />
        </div>
      </SettingsSection>

      {pluginTab === 'installed' && (
        <>
          <SettingsSection
            eyebrow={t('settings.installPlugin', 'Install Plugin')}
            title={t('settings.sourcesAndInstaller', 'Sources and Installer')}
            description={t('settings.sourcesAndInstallerHint', 'Choose where plugin definitions come from, then install either from built-in templates or a raw manifest payload.')}
            action={
              <button
                type="button"
                onClick={() => setShowInstall((value) => !value)}
                className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(var(--t-accent-rgb),0.22)] transition-colors hover:bg-accent-hover"
              >
                {showInstall ? t('settings.hideInstaller', 'Hide Installer') : `+ ${t('settings.install', 'Install')}`}
              </button>
            }
          >
            <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
              <div className={PANEL_CARD_CLASS}>
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.marketplaceSource', 'Marketplace Source')}</div>
                <h4 className="mt-2 text-[16px] font-semibold text-text-primary">{t('settings.pluginRegistry', 'Plugin Registry')}</h4>
                <p className="mt-2 text-[12px] leading-6 text-text-secondary/80">{t('settings.pluginRegistryHint', 'Use the official catalog by default, or switch to a private manifest endpoint when running an internal plugin marketplace.')}</p>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMarketplace({ source: 'official' })}
                    className={`rounded-2xl border px-4 py-3 text-left transition-colors ${marketplace.source === 'official' ? 'border-accent/20 bg-accent/10 text-accent' : 'border-border-subtle/55 bg-surface-2/70 text-text-secondary hover:bg-surface-3'}`}
                  >
                    <div className="text-[13px] font-semibold">{t('settings.officialMarket', 'Official Market')}</div>
                    <div className="mt-1 text-[11px] leading-5 text-current/75">{t('settings.officialMarketHint', 'Use the bundled marketplace catalog that ships with the app.')}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarketplace({ source: 'private' })}
                    className={`rounded-2xl border px-4 py-3 text-left transition-colors ${marketplace.source === 'private' ? 'border-accent/20 bg-accent/10 text-accent' : 'border-border-subtle/55 bg-surface-2/70 text-text-secondary hover:bg-surface-3'}`}
                  >
                    <div className="text-[13px] font-semibold">{t('settings.privateMarket', 'Private Market')}</div>
                    <div className="mt-1 text-[11px] leading-5 text-current/75">{t('settings.privateMarketHint', 'Point the app at a company-hosted manifest feed or plugin catalog.')}</div>
                  </button>
                </div>

                {marketplace.source === 'private' && (
                  <div className="mt-4">
                    <label className="mb-2 block text-[12px] font-medium text-text-muted">{t('settings.privateMarketUrl', 'Private Market URL')}</label>
                    <input
                      value={marketplace.privateUrl}
                      onChange={(event) => setMarketplace({ privateUrl: event.target.value })}
                      placeholder="https://your-company.example.com/plugins.json"
                      className={settingsInputClass}
                    />
                  </div>
                )}
              </div>

              <div className={PANEL_CARD_CLASS}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.installer', 'Installer')}</div>
                    <h4 className="mt-2 text-[16px] font-semibold text-text-primary">{t('settings.installFlow', 'Install Flow')}</h4>
                    <p className="mt-2 text-[12px] leading-6 text-text-secondary/80">{t('settings.installFlowHint', 'Choose a starter template for common plugin patterns, or paste a manifest when you already have a plugin spec.')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setInstallTab('template')}
                      className={`rounded-2xl border px-3 py-2 text-[11px] font-semibold transition-colors ${installTab === 'template' ? 'border-accent/20 bg-accent/10 text-accent' : 'border-border-subtle/55 bg-surface-2/70 text-text-secondary hover:bg-surface-3'}`}
                    >
                      {t('settings.fromTemplate', 'From Template')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstallTab('json')}
                      className={`rounded-2xl border px-3 py-2 text-[11px] font-semibold transition-colors ${installTab === 'json' ? 'border-accent/20 bg-accent/10 text-accent' : 'border-border-subtle/55 bg-surface-2/70 text-text-secondary hover:bg-surface-3'}`}
                    >
                      {t('settings.fromJson', 'From JSON')}
                    </button>
                  </div>
                </div>

                {!showInstall ? (
                  <div className="mt-5 rounded-3xl border border-dashed border-border-subtle/60 bg-surface-2/35 px-4 py-10 text-center">
                    <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-0/72 text-text-muted/60">
                      <IconifyIcon name="ui-download" size={18} color="currentColor" />
                    </div>
                    <p className="text-[12px] leading-relaxed text-text-muted">{t('settings.openInstallerHint', 'Open the installer to add a built-in template plugin or paste a JSON manifest.')}</p>
                  </div>
                ) : installTab === 'template' ? (
                  <div className="mt-5 grid gap-3">
                    {PLUGIN_TEMPLATES.map((template, index) => {
                      const alreadyInstalled = installedPlugins.some((plugin) => plugin.name === template.name)
                      return (
                        <div key={`${template.name}-${index}`} className="rounded-3xl border border-border-subtle/55 bg-surface-2/55 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-0/72 text-accent shadow-sm">
                                <PluginIcon icon={template.icon} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-[13px] font-semibold text-text-primary">{template.name}</div>
                                  {template.permissions && template.permissions.length > 0 && <MetaPill>{template.permissions.length} {t('settings.permissions', 'permissions')}</MetaPill>}
                                </div>
                                <p className="mt-1 text-[12px] leading-6 text-text-secondary/80">{template.description}</p>
                                {template.permissions && template.permissions.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    {template.permissions.map((permission) => (
                                      <MetaPill key={permission}>{permission}</MetaPill>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => void installFromTemplate(template)}
                              disabled={alreadyInstalled}
                              className={`rounded-2xl px-4 py-3 text-[11px] font-semibold transition-colors ${alreadyInstalled ? 'bg-surface-3 text-text-muted cursor-not-allowed' : 'bg-accent text-white hover:bg-accent-hover'}`}
                            >
                              {alreadyInstalled ? t('settings.installed', 'Installed') : t('settings.install', 'Install')}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    <textarea
                      value={jsonInput}
                      onChange={(event) => setJsonInput(event.target.value)}
                      placeholder={'{\n  "id": "my-plugin",\n  "name": "My Plugin",\n  "version": "1.0.0",\n  "hooks": ["afterResponse"],\n  "permissions": ["messages:read"]\n}'}
                      className={`${settingsTextAreaClass} h-44 font-mono text-xs`}
                    />
                    {jsonError && <div className="rounded-2xl border border-red-500/18 bg-red-500/8 px-4 py-3 text-[12px] leading-6 text-red-400">{jsonError}</div>}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => void installFromJson()}
                        className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(var(--t-accent-rgb),0.22)] transition-colors hover:bg-accent-hover"
                      >
                        {t('settings.installFromJson', 'Install from JSON')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            eyebrow={t('settings.installedPlugins', 'Installed Plugins')}
            title={t('settings.pluginInventory', 'Plugin Inventory')}
            description={t('settings.pluginInventoryHint', 'Inspect runtime status, permissions, registered tools, and update availability for every installed plugin in the workspace.')}
          >
            {installedPlugins.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/65 text-text-muted/60">
                  <IconifyIcon name="ui-package" size={18} color="currentColor" />
                </div>
                <p className="text-[12px] leading-relaxed text-text-muted">{t('settings.noPlugins', 'No plugins installed yet.')}</p>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {installedPlugins.map((plugin) => {
                  const hasUpdate = plugin.latestVersion ? checkPluginUpdate(plugin, plugin.latestVersion) : false
                  const registeredTools = pluginTools[plugin.id] || []
                  const hasConfig = Boolean(plugin.configSchema && Object.keys(plugin.configSchema).length > 0)

                  return (
                    <article key={plugin.id} className={PANEL_CARD_CLASS}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-0/72 text-accent shadow-sm">
                            <PluginIcon icon={plugin.icon} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-[15px] font-semibold text-text-primary">{plugin.name}</h4>
                              {hasUpdate && <MetaPill tone="accent">{t('settings.updateAvailable', 'Update Available')}</MetaPill>}
                              {plugin.error && <MetaPill tone="danger">{t('common.error', 'Error')}</MetaPill>}
                              <MetaPill tone={plugin.status === 'enabled' ? 'success' : plugin.status === 'disabled' ? 'neutral' : plugin.status === 'error' ? 'danger' : 'warning'}>{plugin.status}</MetaPill>
                            </div>
                            <p className="mt-2 text-[12px] leading-6 text-text-secondary/82">{plugin.description}</p>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              <MetaPill>v{plugin.version}</MetaPill>
                              {plugin.author && <MetaPill>{t('settings.byAuthor', 'by')} {plugin.author}</MetaPill>}
                              {registeredTools.length > 0 && <MetaPill tone="accent">{registeredTools.length} {t('settings.tools', 'tools')}</MetaPill>}
                              {plugin.permissions && plugin.permissions.length > 0 && <MetaPill>{plugin.permissions.length} {t('settings.permissions', 'permissions')}</MetaPill>}
                            </div>
                          </div>
                        </div>
                      </div>

                      {plugin.permissions && plugin.permissions.length > 0 && (
                        <div className="mt-4">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.permissions', 'Permissions')}</div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {plugin.permissions.map((permission) => (
                              <MetaPill key={permission}>{permission}</MetaPill>
                            ))}
                          </div>
                        </div>
                      )}

                      {registeredTools.length > 0 && (
                        <div className="mt-4">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.tools', 'Tools')}</div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {registeredTools.map((toolName) => (
                              <MetaPill key={toolName} tone="accent">{toolName}</MetaPill>
                            ))}
                          </div>
                        </div>
                      )}

                      {plugin.error && <div className="mt-4 rounded-2xl border border-red-500/18 bg-red-500/8 px-4 py-3 text-[12px] leading-6 text-red-400">{plugin.error}</div>}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {hasConfig && (
                          <button
                            type="button"
                            onClick={() => openConfig(plugin)}
                            className="rounded-2xl border border-border-subtle/55 bg-surface-0/72 px-4 py-3 text-[11px] font-semibold text-text-secondary transition-colors hover:bg-surface-2"
                            title={t('settings.configure', 'Configure')}
                          >
                            <span className="inline-flex items-center gap-1.5"><IconifyIcon name="ui-gear" size={14} color="currentColor" /> {t('settings.configure', 'Configure')}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void togglePlugin(plugin)}
                          className={`rounded-2xl border px-4 py-3 text-[11px] font-semibold transition-colors ${plugin.status === 'enabled' ? 'border-green-500/18 bg-green-500/10 text-green-400 hover:bg-green-500/16' : 'border-border-subtle/55 bg-surface-2/70 text-text-secondary hover:bg-surface-3'}`}
                        >
                          {plugin.status === 'enabled' ? t('settings.disable', 'Disable') : t('settings.enable', 'Enable')}
                        </button>
                        <button
                          type="button"
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
                            void deactivatePlugin(plugin.id)
                            removePluginTools(plugin.id)
                            removeInstalledPlugin(plugin.id)
                          }}
                          className="rounded-2xl border border-red-500/18 bg-red-500/8 px-4 py-3 text-[11px] font-semibold text-red-400 transition-colors hover:bg-red-500/14"
                        >
                          {t('settings.uninstall', 'Uninstall')}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </SettingsSection>
        </>
      )}

      {pluginTab === 'marketplace' && (
        <>
          <SettingsSection
            eyebrow={t('settings.marketplace', 'Marketplace')}
            title={t('settings.discoverPlugins', 'Discover Plugins')}
            description={t('settings.discoverPluginsHint', 'Filter the bundled plugin marketplace by keyword, category, and ranking to find the next extension worth enabling.')}
          >
            <div className="grid gap-3 lg:grid-cols-[1.2fr_0.7fr_0.5fr]">
              <input
                value={marketplaceSearch}
                onChange={(event) => setMarketplaceSearch(event.target.value)}
                placeholder={t('settings.searchPlugins', 'Search plugins...')}
                className={settingsInputClass}
              />
              <select
                value={marketplaceCategory}
                onChange={(event) => setMarketplaceCategory(event.target.value)}
                title={t('settings.categoryFilter', 'Category filter')}
                className={settingsInputClass}
              >
                {MARKETPLACE_CATEGORIES.map((category) => (
                  <option key={category.label} value={category.value}>{t(`settings.${category.value || 'allCategories'}`, category.label)}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as 'downloads' | 'rating' | 'name')}
                title={t('settings.sortBy', 'Sort by')}
                className={settingsInputClass}
              >
                <option value="downloads">{t('settings.downloads', 'Downloads')}</option>
                <option value="rating">{t('settings.rating', 'Rating')}</option>
                <option value="name">{t('settings.name', 'Name')}</option>
              </select>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-text-muted/75">
              <span>{t('common.results', 'Results')}: {filteredMarketplace.length}</span>
              <span>{t('settings.installed', 'Installed')}: {installedPlugins.length}</span>
              <span>{t('settings.marketplace', 'Marketplace')}: {PLUGIN_MARKETPLACE_CATALOG.length}</span>
            </div>
          </SettingsSection>

          <SettingsSection
            eyebrow={t('settings.marketplaceCatalog', 'Marketplace Catalog')}
            title={t('settings.curatedCatalog', 'Curated Catalog')}
            description={t('settings.curatedCatalogHint', 'Browse a denser catalog view with ratings, downloads, permissions, and tags surfaced before you install.')}
          >
            {filteredMarketplace.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/65 text-text-muted/60">
                  <IconifyIcon name="ui-search" size={18} color="currentColor" />
                </div>
                <p className="text-[12px] leading-relaxed text-text-muted">{t('settings.noPluginsMatch', 'No plugins match your search criteria.')}</p>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {filteredMarketplace.map((plugin) => {
                  const isInstalled = installedPluginIds.has(plugin.id)

                  return (
                    <article key={plugin.id} className={PANEL_CARD_CLASS}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-0/72 text-accent shadow-sm">
                            <PluginIcon icon={plugin.icon} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-[15px] font-semibold text-text-primary">{plugin.name}</h4>
                              <MetaPill>{plugin.category}</MetaPill>
                              {isInstalled && <MetaPill tone="success">{t('settings.installed', 'Installed')}</MetaPill>}
                            </div>
                            <p className="mt-2 text-[12px] leading-6 text-text-secondary/82">{plugin.description}</p>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              <MetaPill>v{plugin.version}</MetaPill>
                              <MetaPill>{t('settings.byAuthor', 'by')} {plugin.author}</MetaPill>
                              <MetaPill tone="accent"><RatingStars rating={plugin.rating} /> {plugin.rating.toFixed(1)}</MetaPill>
                              <MetaPill>{plugin.downloads.toLocaleString()} {t('settings.downloads', 'downloads')}</MetaPill>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleInstallFromMarketplace(plugin)}
                          disabled={isInstalled}
                          className={`rounded-2xl px-4 py-3 text-[11px] font-semibold transition-colors ${isInstalled ? 'bg-green-500/10 text-green-400 cursor-default' : 'bg-accent text-white hover:bg-accent-hover'}`}
                        >
                          {isInstalled ? t('settings.installed', 'Installed') : t('settings.install', 'Install')}
                        </button>
                      </div>

                      {plugin.tags.length > 0 && (
                        <div className="mt-4">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.tags', 'Tags')}</div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {plugin.tags.map((tag) => (
                              <MetaPill key={tag}>{tag}</MetaPill>
                            ))}
                          </div>
                        </div>
                      )}

                      {plugin.permissions.length > 0 && (
                        <div className="mt-4">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.permissions', 'Permissions')}</div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {plugin.permissions.map((permission) => (
                              <MetaPill key={permission} tone="warning">{permission}</MetaPill>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </SettingsSection>
        </>
      )}

      {configPlugin && configPlugin.configSchema && (
        <SettingsSection
          eyebrow={t('settings.configure', 'Configure')}
          title={`${t('settings.configure', 'Configure')}: ${configPlugin.name}`}
          description={t('settings.pluginConfigHint', 'These fields come from the plugin manifest config schema. Changes are saved back into the installed plugin record for future sessions.')}
          action={
            <button
              type="button"
              onClick={() => setConfigPluginId(null)}
              title={t('common.close', 'Close')}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border-subtle/55 bg-surface-0/72 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
            >
              <IconifyIcon name="ui-close" size={16} color="currentColor" />
            </button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <SettingsStat label={t('settings.status', 'Status')} value={configPlugin.status} accent={configPlugin.status === 'enabled'} />
            <SettingsStat label={t('settings.fields', 'Fields')} value={String(Object.keys(configPlugin.configSchema).length)} />
            <SettingsStat label={t('settings.tools', 'Tools')} value={String((pluginTools[configPlugin.id] || []).length)} />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {Object.entries(configPlugin.configSchema).map(([fieldKey, field]) => (
              <ConfigFieldControl
                key={fieldKey}
                fieldKey={fieldKey}
                field={field}
                value={configValues[fieldKey]}
                onChange={(value) => setConfigValues({ ...configValues, [fieldKey]: value })}
                t={t}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveConfig}
              disabled={configSaved}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${configSaved ? 'border border-green-500/20 bg-green-500/15 text-green-400' : 'bg-accent text-white shadow-[0_10px_30px_rgba(var(--t-accent-rgb),0.22)] hover:bg-accent-hover'}`}
            >
              {configSaved ? t('settings.savedConfig', 'Saved') : t('settings.saveConfig', 'Save Configuration')}
            </button>
            <button
              type="button"
              onClick={() => setConfigPluginId(null)}
              className="rounded-2xl border border-border-subtle/55 bg-surface-0/72 px-4 py-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-2"
            >
              {t('settings.cancel', 'Cancel')}
            </button>
          </div>
        </SettingsSection>
      )}
    </div>
  )
}
