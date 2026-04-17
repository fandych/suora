// Plugin System Core
//
// Provides lifecycle management (install → enable → disable → uninstall),
// event hook registration, plugin execution, permission enforcement,
// dynamic loading, and AI SDK tool registration.
//
// Plugins are declarative configuration objects stored in the Zustand store.
// Hook execution is coordinated through a central EventBus.

import type { PluginInfo, PluginHookType, PluginStatus, PluginPermission, PluginAPIContext, PluginManifestV2, PluginConfigField } from '@/types'
import { readCached } from '@/services/fileStorage'
import type { ToolSet } from 'ai'
import { z } from 'zod'

// ─── Hook Registry ─────────────────────────────────────────────────

type HookHandler = (...args: unknown[]) => Promise<unknown> | unknown

const hookRegistry = new Map<PluginHookType, Map<string, HookHandler>>()

const ALL_HOOKS: PluginHookType[] = [
  'beforeMessage',
  'afterResponse',
  'onAgentExecute',
  'onSessionCreate',
  'onSessionDelete',
  'onAppStart',
  'onAppStop',
]

// Initialise registry buckets
for (const hook of ALL_HOOKS) {
  hookRegistry.set(hook, new Map())
}

// ─── Permission Registry ───────────────────────────────────────────

const pluginPermissions = new Map<string, Set<PluginPermission>>()

export function grantPermissions(pluginId: string, permissions: PluginPermission[]): void {
  pluginPermissions.set(pluginId, new Set(permissions))
}

export function revokePermissions(pluginId: string): void {
  pluginPermissions.delete(pluginId)
}

export function hasPermission(pluginId: string, permission: PluginPermission): boolean {
  const perms = pluginPermissions.get(pluginId)
  return perms?.has(permission) ?? false
}

export function getPluginPermissions(pluginId: string): PluginPermission[] {
  const perms = pluginPermissions.get(pluginId)
  return perms ? Array.from(perms) : []
}

function requirePermission(pluginId: string, permission: PluginPermission): void {
  if (!hasPermission(pluginId, permission)) {
    throw new Error(`Plugin "${pluginId}" lacks required permission: ${permission}`)
  }
}

// ─── Plugin-Registered Tools (AI SDK) ──────────────────────────────

const pluginToolRegistry = new Map<string, ToolSet>()

export function registerPluginTools(pluginId: string, tools: ToolSet): void {
  requirePermission(pluginId, 'tools:register')
  pluginToolRegistry.set(pluginId, tools)
}

export function unregisterPluginTools(pluginId: string): void {
  pluginToolRegistry.delete(pluginId)
}

export function getPluginTools(): ToolSet {
  const merged: ToolSet = {}
  for (const [, tools] of pluginToolRegistry) {
    Object.assign(merged, tools)
  }
  return merged
}

export function getPluginToolNames(pluginId: string): string[] {
  const tools = pluginToolRegistry.get(pluginId)
  return tools ? Object.keys(tools) : []
}

// ─── Plugin API Context Factory ────────────────────────────────────

export function createPluginAPIContext(pluginId: string, permissions: PluginPermission[]): PluginAPIContext {
  // Lazy helpers that read store without circular dependency
  function getStoreState(): Record<string, unknown> {
    try {
      const raw = readCached('suora-store')
      return raw ? (JSON.parse(raw) as { state?: Record<string, unknown> }).state || {} : {}
    } catch {
      return {}
    }
  }

  return {
    pluginId,
    permissions,
    api: {
      messages: {
        getHistory: (sessionId: string) => {
          requirePermission(pluginId, 'messages:read')
          const state = getStoreState()
          const sessions = (state.sessions || []) as Array<{ id: string; messages: Array<{ role: string; content: string }> }>
          const session = sessions.find((s) => s.id === sessionId)
          return (session?.messages || []).map((m) => ({ role: m.role, content: m.content }))
        },
        sendToAgent: async (agentId: string, message: string) => {
          requirePermission(pluginId, 'messages:write')
          // Plugins can enqueue a message to an agent; the host will process it
          await executeHook('beforeMessage', { agentId, message, source: pluginId })
          return `Message queued for agent ${agentId}: ${message.slice(0, 100)}`
        },
      },
      agents: {
        list: () => {
          requirePermission(pluginId, 'agents:read')
          const state = getStoreState()
          return ((state.agents || []) as Array<{ id: string; name: string }>).map((a) => ({ id: a.id, name: a.name }))
        },
        getById: (id: string) => {
          requirePermission(pluginId, 'agents:read')
          const state = getStoreState()
          const agents = (state.agents || []) as Array<{ id: string; name: string; systemPrompt: string }>
          const agent = agents.find((a) => a.id === id)
          return agent ? { id: agent.id, name: agent.name, systemPrompt: agent.systemPrompt } : null
        },
      },
      sessions: {
        getCurrent: () => {
          requirePermission(pluginId, 'sessions:read')
          const state = getStoreState()
          const activeId = state.activeSessionId as string | null
          const sessions = (state.sessions || []) as Array<{ id: string; title: string }>
          const session = activeId ? sessions.find((s) => s.id === activeId) : null
          return session ? { id: session.id, title: session.title } : null
        },
        create: (title: string) => {
          requirePermission(pluginId, 'sessions:write')
          const id = `plugin-session-${Date.now()}`
          // Session creation is handled by the host via hooks
          executeHook('onSessionCreate', { id, title, source: pluginId })
          return id
        },
      },
      settings: {
        get: (key: string) => {
          requirePermission(pluginId, 'settings:read')
          const state = getStoreState()
          return state[key]
        },
        set: (key: string, value: unknown) => {
          requirePermission(pluginId, 'settings:write')
          // Settings mutation is done via store; plugins can only set their own config
          const state = getStoreState()
          const plugins = (state.plugins || {}) as Record<string, unknown>
          plugins[`${pluginId}:${key}`] = value
        },
      },
      tools: {
        register: (name: string, definition: unknown) => {
          requirePermission(pluginId, 'tools:register')
          const existingTools = pluginToolRegistry.get(pluginId) || {}
          pluginToolRegistry.set(pluginId, { ...existingTools, [name]: definition as ToolSet[string] })
        },
        unregister: (name: string) => {
          requirePermission(pluginId, 'tools:register')
          const existingTools = pluginToolRegistry.get(pluginId)
          if (existingTools) {
            const { [name]: _, ...rest } = existingTools
            pluginToolRegistry.set(pluginId, rest)
          }
        },
      },
      ui: {
        showNotification: (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
          requirePermission(pluginId, 'ui:extend')
          // Dispatch a custom event that the UI can listen for
          window.dispatchEvent(new CustomEvent('plugin-notification', {
            detail: { pluginId, message, type },
          }))
        },
      },
    },
  }
}

// ─── Dynamic Plugin Loader ─────────────────────────────────────────

export interface LoadedPlugin {
  manifest: PluginManifestV2
  module: PluginModule
}

export interface PluginModule {
  activate?: (ctx: PluginAPIContext) => void | Promise<void>
  deactivate?: () => void | Promise<void>
  hooks?: Partial<Record<PluginHookType, HookHandler>>
  tools?: ToolSet
  settingsPanel?: () => unknown
  messageRenderer?: (msg: { content: string; role: string }) => unknown
  uiExtensions?: Omit<UIExtension, 'pluginId'>[]
  agentExtension?: Omit<AgentExtension, 'pluginId'>
}

const loadedPlugins = new Map<string, LoadedPlugin>()

export const BUILTIN_PLUGIN_ENTRY_PREFIX = 'builtin:'

export function getBuiltinPluginEntryPoint(pluginName: string): string {
  return `${BUILTIN_PLUGIN_ENTRY_PREFIX}${pluginName}`
}

export function getResolvedPluginEntryPoint(plugin: Pick<PluginInfo, 'name' | 'entryPoint'>): string | undefined {
  const normalizedEntryPoint = plugin.entryPoint?.trim()
  if (normalizedEntryPoint) {
    return normalizedEntryPoint
  }

  if (BUILTIN_PLUGIN_MODULES[plugin.name]) {
    return getBuiltinPluginEntryPoint(plugin.name)
  }

  return undefined
}

export function resolvePluginRuntimeModule(plugin: Pick<PluginInfo, 'name' | 'entryPoint'>): PluginModule | undefined {
  const resolvedEntryPoint = getResolvedPluginEntryPoint(plugin)
  if (resolvedEntryPoint) {
    if (resolvedEntryPoint.startsWith(BUILTIN_PLUGIN_ENTRY_PREFIX)) {
      return BUILTIN_PLUGIN_MODULES[resolvedEntryPoint.slice(BUILTIN_PLUGIN_ENTRY_PREFIX.length)]
    }

    const builtinModule = BUILTIN_PLUGIN_MODULES[resolvedEntryPoint]
    if (builtinModule) {
      return builtinModule
    }
  }

  return BUILTIN_PLUGIN_MODULES[plugin.name]
}

export async function loadPluginFromManifest(manifest: PluginManifestV2): Promise<PluginInfo> {
  const validation = validateManifest(manifest)
  if (!validation.valid) {
    throw new Error(`Invalid manifest: ${validation.errors.join(', ')}`)
  }

  const plugin: PluginInfo = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    author: manifest.author,
    description: manifest.description,
    status: 'installed' as PluginStatus,
    hooks: manifest.hooks,
    config: manifest.config ? getDefaultConfig(manifest.config) : {},
    installedAt: Date.now(),
    icon: manifest.icon,
    homepage: manifest.homepage,
    permissions: manifest.permissions,
    configSchema: manifest.config,
    settingsUI: manifest.settingsUI,
    messageRenderer: manifest.messageRenderer,
    entryPoint: manifest.entryPoint,
  }

  return plugin
}

export async function activatePlugin(plugin: PluginInfo, pluginModule?: PluginModule): Promise<void> {
  const permissions = plugin.permissions || []
  grantPermissions(plugin.id, permissions)

  if (pluginModule) {
    const ctx = createPluginAPIContext(plugin.id, permissions)

    // Register plugin hooks
    if (pluginModule.hooks) {
      enablePlugin(plugin.id, plugin.hooks, pluginModule.hooks as Record<string, HookHandler>)
    }

    // Register plugin tools
    if (pluginModule.tools && permissions.includes('tools:register')) {
      registerPluginTools(plugin.id, pluginModule.tools)
    }

    // Register UI extensions
    if (pluginModule.uiExtensions && permissions.includes('ui:extend')) {
      for (const ext of pluginModule.uiExtensions) {
        registerUIExtension(plugin.id, ext)
      }
    }

    // Register agent extension
    if (pluginModule.agentExtension && permissions.includes('agents:write')) {
      registerAgentExtension(plugin.id, pluginModule.agentExtension)
    }

    // Register settings panel
    if (pluginModule.settingsPanel && permissions.includes('ui:extend')) {
      registerSettingsPanel(plugin.id, pluginModule.settingsPanel)
    }

    // Register message renderer
    if (pluginModule.messageRenderer && permissions.includes('ui:extend')) {
      registerMessageRenderer(plugin.id, pluginModule.messageRenderer)
    }

    // Store loaded plugin
    loadedPlugins.set(plugin.id, {
      manifest: {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        author: plugin.author,
        description: plugin.description,
        hooks: plugin.hooks,
        permissions,
        icon: plugin.icon,
      },
      module: pluginModule,
    })

    // Call activate lifecycle method
    if (pluginModule.activate) {
      await pluginModule.activate(ctx)
    }
  }
}

export async function deactivatePlugin(pluginId: string): Promise<void> {
  const loaded = loadedPlugins.get(pluginId)
  if (loaded?.module.deactivate) {
    await loaded.module.deactivate()
  }

  disablePlugin(pluginId)
  cleanupPluginExtensions(pluginId)
  revokePermissions(pluginId)
  loadedPlugins.delete(pluginId)
}

export function getLoadedPlugin(pluginId: string): LoadedPlugin | undefined {
  return loadedPlugins.get(pluginId)
}

export function getLoadedPlugins(): Map<string, LoadedPlugin> {
  return new Map(loadedPlugins)
}

export interface PluginRuntimeRestoreOptions {
  setPluginTools?: (pluginId: string, tools: string[]) => void
  removePluginTools?: (pluginId: string) => void
}

export interface PluginRuntimeRestoreResult {
  pluginId: string
  status: 'restored' | 'already-active' | 'skipped-no-module' | 'failed'
  toolNames: string[]
  resolvedEntryPoint?: string
  error?: string
}

function syncPluginToolState(
  pluginId: string,
  toolNames: string[],
  options: PluginRuntimeRestoreOptions,
): void {
  if (toolNames.length > 0) {
    options.setPluginTools?.(pluginId, toolNames)
    return
  }

  options.removePluginTools?.(pluginId)
}

export async function restoreInstalledPluginRuntime(
  installedPlugins: PluginInfo[],
  options: PluginRuntimeRestoreOptions = {},
): Promise<PluginRuntimeRestoreResult[]> {
  const results: PluginRuntimeRestoreResult[] = []

  for (const plugin of installedPlugins) {
    if (plugin.status !== 'enabled') {
      options.removePluginTools?.(plugin.id)
      continue
    }

    const resolvedEntryPoint = getResolvedPluginEntryPoint(plugin)

    const existing = getLoadedPlugin(plugin.id)
    if (existing) {
      const toolNames = getPluginToolNames(plugin.id)
      syncPluginToolState(plugin.id, toolNames, options)
      results.push({
        pluginId: plugin.id,
        status: 'already-active',
        toolNames,
        resolvedEntryPoint,
      })
      continue
    }

    const pluginModule = resolvePluginRuntimeModule(plugin)
    if (!pluginModule) {
      options.removePluginTools?.(plugin.id)
      results.push({
        pluginId: plugin.id,
        status: 'skipped-no-module',
        toolNames: [],
        resolvedEntryPoint,
        error: 'Runtime module unavailable for this plugin.',
      })
      continue
    }

    try {
      await activatePlugin(plugin, pluginModule)
    } catch (error) {
      await deactivatePlugin(plugin.id).catch(() => {})
      options.removePluginTools?.(plugin.id)
      results.push({
        pluginId: plugin.id,
        status: 'failed',
        toolNames: [],
        resolvedEntryPoint,
        error: error instanceof Error ? error.message : String(error),
      })
      continue
    }

    const toolNames = getPluginToolNames(plugin.id)
    syncPluginToolState(plugin.id, toolNames, options)

    let startupError: string | undefined
    if (plugin.hooks.includes('onAppStart') && pluginModule.hooks?.onAppStart) {
      try {
        await pluginModule.hooks.onAppStart()
      } catch (error) {
        startupError = error instanceof Error ? error.message : String(error)
      }
    }

    results.push({
      pluginId: plugin.id,
      status: 'restored',
      toolNames,
      resolvedEntryPoint,
      ...(startupError ? { error: startupError } : {}),
    })
  }

  return results
}

// ─── Plugin Lifecycle ──────────────────────────────────────────────

export function installPlugin(plugin: PluginInfo): PluginInfo {
  return {
    ...plugin,
    status: 'installed' as PluginStatus,
    installedAt: Date.now(),
  }
}

export function enablePlugin(pluginId: string, hooks: PluginHookType[], handlers: Record<string, HookHandler>): void {
  for (const hook of hooks) {
    const bucket = hookRegistry.get(hook)
    if (bucket && handlers[hook]) {
      bucket.set(pluginId, handlers[hook])
    }
  }
}

export function disablePlugin(pluginId: string): void {
  for (const [, bucket] of hookRegistry) {
    bucket.delete(pluginId)
  }
}

export function uninstallPlugin(pluginId: string): void {
  deactivatePlugin(pluginId)
}

// ─── Hook Execution ────────────────────────────────────────────────

export async function executeHook(hookType: PluginHookType, ...args: unknown[]): Promise<unknown[]> {
  const bucket = hookRegistry.get(hookType)
  if (!bucket || bucket.size === 0) return []

  const results: unknown[] = []
  for (const [pluginId, handler] of bucket) {
    try {
      const result = await handler(...args)
      results.push({ pluginId, result })
    } catch (err) {
      results.push({ pluginId, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return results
}

export function getRegisteredHooks(): Record<PluginHookType, string[]> {
  const result: Record<string, string[]> = {}
  for (const [hook, bucket] of hookRegistry) {
    result[hook] = Array.from(bucket.keys())
  }
  return result as Record<PluginHookType, string[]>
}

// ─── Plugin Validation ─────────────────────────────────────────────

export interface PluginValidation {
  valid: boolean
  errors: string[]
}

export function validatePlugin(plugin: Partial<PluginInfo>): PluginValidation {
  const errors: string[] = []
  if (!plugin.id) errors.push('Plugin must have an id')
  if (!plugin.name || plugin.name.length < 2) errors.push('Plugin name must be at least 2 characters')
  if (!plugin.version) errors.push('Plugin must have a version')
  if (!plugin.hooks || plugin.hooks.length === 0) errors.push('Plugin must declare at least one hook')
  if (plugin.hooks) {
    for (const h of plugin.hooks) {
      if (!ALL_HOOKS.includes(h)) errors.push(`Unknown hook type: ${h}`)
    }
  }
  return { valid: errors.length === 0, errors }
}

export function validateManifest(manifest: Partial<PluginManifestV2>): PluginValidation {
  const errors: string[] = []
  if (!manifest.id) errors.push('Manifest must have an id')
  if (!manifest.name || manifest.name.length < 2) errors.push('Plugin name must be at least 2 characters')
  if (!manifest.version) errors.push('Manifest must have a version')
  if (!manifest.hooks || manifest.hooks.length === 0) errors.push('Manifest must declare at least one hook')
  if (manifest.hooks) {
    for (const h of manifest.hooks) {
      if (!ALL_HOOKS.includes(h)) errors.push(`Unknown hook type: ${h}`)
    }
  }
  if (manifest.permissions) {
    const validPerms: PluginPermission[] = [
      'messages:read', 'messages:write', 'agents:read', 'agents:write',
      'skills:read', 'skills:write', 'sessions:read', 'sessions:write',
      'settings:read', 'settings:write', 'tools:register', 'ui:extend',
      'network:outbound', 'filesystem:read', 'filesystem:write',
    ]
    for (const p of manifest.permissions) {
      if (!validPerms.includes(p)) errors.push(`Unknown permission: ${p}`)
    }
  }
  return { valid: errors.length === 0, errors }
}

// ─── Plugin Update Detection ───────────────────────────────────────

export function checkPluginUpdate(current: PluginInfo, latestVersion: string): boolean {
  if (!current.version || !latestVersion) return false
  return compareVersions(latestVersion, current.version) > 0
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

export { compareVersions }

// ─── Plugin Config Helpers ─────────────────────────────────────────

export function getDefaultConfig(schema: Record<string, PluginConfigField>): Record<string, unknown> {
  const config: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(schema)) {
    if (field.default !== undefined) {
      config[key] = field.default
    }
  }
  return config
}

export function validateConfig(config: Record<string, unknown>, schema: Record<string, PluginConfigField>): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  for (const [key, field] of Object.entries(schema)) {
    const value = config[key]
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field.label || key} is required`)
    }
    if (value !== undefined && value !== null) {
      if (field.type === 'number' && typeof value !== 'number') {
        errors.push(`${field.label || key} must be a number`)
      }
      if (field.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`${field.label || key} must be a boolean`)
      }
      if (field.type === 'select' && field.options) {
        const validValues = field.options.map((o) => o.value)
        if (!validValues.includes(value)) {
          errors.push(`${field.label || key} must be one of: ${validValues.join(', ')}`)
        }
      }
    }
  }
  return { valid: errors.length === 0, errors }
}

// ─── Settings / Message Extension Points ───────────────────────────

const settingsExtensions = new Map<string, () => unknown>()
const messageRenderers = new Map<string, (msg: { content: string; role: string }) => unknown>()

export function registerSettingsPanel(pluginId: string, panel: () => unknown): void {
  requirePermission(pluginId, 'ui:extend')
  settingsExtensions.set(pluginId, panel)
}

export function unregisterSettingsPanel(pluginId: string): void {
  settingsExtensions.delete(pluginId)
}

export function getSettingsExtensions(): Map<string, () => unknown> {
  return new Map(settingsExtensions)
}

export function registerMessageRenderer(pluginId: string, renderer: (msg: { content: string; role: string }) => unknown): void {
  requirePermission(pluginId, 'ui:extend')
  messageRenderers.set(pluginId, renderer)
}

export function unregisterMessageRenderer(pluginId: string): void {
  messageRenderers.delete(pluginId)
}

export function getMessageRenderers(): Map<string, (msg: { content: string; role: string }) => unknown> {
  return new Map(messageRenderers)
}

// ─── Plugin Templates ──────────────────────────────────────────────

export const PLUGIN_TEMPLATES: Omit<PluginInfo, 'id' | 'installedAt'>[] = [
  {
    name: 'Message Logger',
    version: '1.0.0',
    author: 'System',
    description: 'Logs all messages to console for debugging',
    status: 'installed',
    hooks: ['beforeMessage', 'afterResponse'],
    config: {},
    icon: 'settings-logs',
    permissions: ['messages:read'],
    configSchema: {
      logLevel: { type: 'select', label: 'Log Level', default: 'info', options: [{ label: 'Info', value: 'info' }, { label: 'Debug', value: 'debug' }, { label: 'Verbose', value: 'verbose' }] },
      includeTimestamps: { type: 'boolean', label: 'Include Timestamps', default: true },
    },
  },
  {
    name: 'Session Backup',
    version: '1.0.0',
    author: 'System',
    description: 'Automatically backs up sessions to disk',
    status: 'installed',
    hooks: ['onSessionCreate', 'onSessionDelete'],
    config: { interval: 300 },
    icon: 'settings-data',
    permissions: ['sessions:read', 'filesystem:write'],
    configSchema: {
      interval: { type: 'number', label: 'Backup Interval (seconds)', default: 300 },
      maxBackups: { type: 'number', label: 'Max Backups', default: 10 },
    },
  },
  {
    name: 'Response Filter',
    version: '1.0.0',
    author: 'System',
    description: 'Filters and sanitizes AI responses',
    status: 'installed',
    hooks: ['afterResponse'],
    config: { maxLength: 10000 },
    icon: 'settings-security',
    permissions: ['messages:read', 'messages:write'],
    configSchema: {
      maxLength: { type: 'number', label: 'Max Response Length', default: 10000 },
      filterProfanity: { type: 'boolean', label: 'Filter Profanity', default: false },
    },
  },
  {
    name: 'Auto-Tag Agent',
    version: '1.0.0',
    author: 'System',
    description: 'Registers a tool that auto-tags conversations by topic',
    status: 'installed',
    hooks: ['afterResponse'],
    config: {},
    icon: 'skill-agent-comm',
    permissions: ['messages:read', 'tools:register', 'sessions:read'],
    configSchema: {},
  },
]

// ─── Built-in Plugin Modules ───────────────────────────────────────

export const BUILTIN_PLUGIN_MODULES: Record<string, PluginModule> = {
  'Message Logger': {
    hooks: {
      beforeMessage: (...args: unknown[]) => {
        console.log('[Plugin: Message Logger] beforeMessage:', args)
        return { logged: true }
      },
      afterResponse: (...args: unknown[]) => {
        console.log('[Plugin: Message Logger] afterResponse:', args)
        return { logged: true }
      },
    },
  },
  'Session Backup': {
    hooks: {
      onSessionCreate: (...args: unknown[]) => {
        console.log('[Plugin: Session Backup] onSessionCreate:', args)
        return { backedUp: true }
      },
      onSessionDelete: (...args: unknown[]) => {
        console.log('[Plugin: Session Backup] onSessionDelete:', args)
        return { cleaned: true }
      },
    },
  },
  'Response Filter': {
    hooks: {
      afterResponse: (...args: unknown[]) => {
        const [response] = args as [{ content?: string }]
        if (response?.content) {
          const maxLength = 10000
          if (response.content.length > maxLength) {
            response.content = response.content.slice(0, maxLength) + '... [truncated by Response Filter]'
          }
        }
        return { filtered: true }
      },
    },
  },
  'Auto-Tag Agent': {
    hooks: {
      afterResponse: (...args: unknown[]) => {
        console.log('[Plugin: Auto-Tag Agent] afterResponse:', args)
        return { tagged: true }
      },
    },
  },
  'Slack Integration': {
    hooks: {
      afterResponse: (...args: unknown[]) => {
        const [response] = args as [{ content?: string; sessionId?: string }]
        console.log('[Plugin: Slack] Would forward response to Slack:', response?.content?.slice(0, 100))
        return { forwarded: true, platform: 'slack' }
      },
    },
    tools: {
      slack_send_message: {
        description: 'Send a message to a Slack channel',
        inputSchema: z.object({
          channel: z.string().describe('Slack channel ID or name'),
          text: z.string().describe('Message text to send'),
          threadTs: z.string().optional().describe('Thread timestamp for replies'),
        }),
        execute: async ({ channel, text }) => {
          return `[Slack] Message queued for channel ${channel}: ${text.slice(0, 100)}`
        },
      },
    },
  },
  'Telegram Bot': {
    hooks: {
      afterResponse: (...args: unknown[]) => {
        const [response] = args as [{ content?: string }]
        console.log('[Plugin: Telegram] Would send to Telegram:', response?.content?.slice(0, 100))
        return { sent: true, platform: 'telegram' }
      },
    },
    tools: {
      telegram_send_message: {
        description: 'Send a message via Telegram Bot API',
        inputSchema: z.object({
          chatId: z.string().describe('Telegram chat ID'),
          text: z.string().describe('Message text'),
          parseMode: z.enum(['Markdown', 'HTML', 'Plain']).optional().describe('Message parse mode'),
        }),
        execute: async ({ chatId, text }) => {
          return `[Telegram] Message queued for chat ${chatId}: ${text.slice(0, 100)}`
        },
      },
    },
  },
  'Email Assistant': {
    hooks: {
      onAppStart: () => {
        console.log('[Plugin: Email] Email check service initialized')
        return { initialized: true }
      },
      afterResponse: (...args: unknown[]) => {
        const [response] = args as [{ content?: string }]
        console.log('[Plugin: Email] Response available for email forwarding:', response?.content?.slice(0, 50))
        return { available: true }
      },
    },
    tools: {
      email_send: {
        description: 'Compose and send an email',
        inputSchema: z.object({
          to: z.string().describe('Recipient email address'),
          subject: z.string().describe('Email subject'),
          body: z.string().describe('Email body text'),
        }),
        execute: async ({ to, subject }) => {
          return `[Email] Draft created: To=${to}, Subject="${subject}"`
        },
      },
      email_check: {
        description: 'Check for new emails',
        inputSchema: z.object({
          folder: z.string().optional().describe('IMAP folder to check (default: INBOX)'),
          limit: z.number().optional().describe('Max emails to retrieve'),
        }),
        execute: async ({ folder }) => {
          return `[Email] Would check ${folder || 'INBOX'} for new messages`
        },
      },
    },
  },
  'Notion Sync': {
    hooks: {
      afterResponse: (...args: unknown[]) => {
        const [response] = args as [{ content?: string; sessionId?: string }]
        console.log('[Plugin: Notion] Would sync to Notion:', response?.content?.slice(0, 50))
        return { synced: true }
      },
      onSessionCreate: (...args: unknown[]) => {
        console.log('[Plugin: Notion] New session created, tracking for sync:', args)
        return { tracked: true }
      },
    },
    tools: {
      notion_create_page: {
        description: 'Create a new page in Notion',
        inputSchema: z.object({
          title: z.string().describe('Page title'),
          content: z.string().describe('Page content in markdown'),
          databaseId: z.string().optional().describe('Target database ID'),
        }),
        execute: async ({ title }) => {
          return `[Notion] Page "${title}" would be created`
        },
      },
      notion_query_database: {
        description: 'Query a Notion database',
        inputSchema: z.object({
          databaseId: z.string().describe('Database ID to query'),
          filter: z.string().optional().describe('Filter expression as JSON'),
        }),
        execute: async ({ databaseId }) => {
          return `[Notion] Would query database ${databaseId}`
        },
      },
    },
  },
  'WeChat Personal': {
    hooks: {
      beforeMessage: (...args: unknown[]) => {
        console.log('[Plugin: WeChat] Incoming message check:', args)
        return { checked: true }
      },
      afterResponse: (...args: unknown[]) => {
        const [response] = args as [{ content?: string }]
        console.log('[Plugin: WeChat Personal] Would forward to WeChat:', response?.content?.slice(0, 50))
        return { forwarded: true, platform: 'wechat-personal' }
      },
    },
  },
  'Custom Webhook': {
    hooks: {
      afterResponse: (...args: unknown[]) => {
        const [response] = args as [{ content?: string }]
        console.log('[Plugin: Webhook] Would POST to webhook:', response?.content?.slice(0, 50))
        return { posted: true }
      },
    },
    tools: {
      webhook_send: {
        description: 'Send data to a custom webhook endpoint',
        inputSchema: z.object({
          url: z.string().describe('Webhook URL endpoint'),
          payload: z.string().describe('JSON payload to send'),
          method: z.enum(['POST', 'PUT']).optional().describe('HTTP method'),
        }),
        execute: async ({ url, method }) => {
          return `[Webhook] Would ${method || 'POST'} to ${url}`
        },
      },
    },
  },
  'Feishu Deep Integration': {
    hooks: {
      beforeMessage: (...args: unknown[]) => {
        console.log('[Plugin: Feishu Deep] Processing message:', args)
        return { processed: true }
      },
      afterResponse: (...args: unknown[]) => {
        const [response] = args as [{ content?: string }]
        console.log('[Plugin: Feishu Deep] Response available:', response?.content?.slice(0, 50))
        return { available: true }
      },
    },
    tools: {
      feishu_create_calendar_event: {
        description: 'Create a calendar event in Feishu',
        inputSchema: z.object({
          summary: z.string().describe('Event title'),
          startTime: z.string().describe('Start time (ISO 8601)'),
          endTime: z.string().describe('End time (ISO 8601)'),
          attendees: z.string().optional().describe('Comma-separated attendee emails'),
        }),
        execute: async ({ summary, startTime }) => {
          return `[Feishu] Calendar event "${summary}" at ${startTime} would be created`
        },
      },
      feishu_create_doc: {
        description: 'Create a document in Feishu',
        inputSchema: z.object({
          title: z.string().describe('Document title'),
          content: z.string().describe('Document content (markdown)'),
          folderId: z.string().optional().describe('Target folder ID'),
        }),
        execute: async ({ title }) => {
          return `[Feishu] Document "${title}" would be created`
        },
      },
      feishu_create_approval: {
        description: 'Create an approval request in Feishu',
        inputSchema: z.object({
          approvalCode: z.string().describe('Approval definition code'),
          formContent: z.string().describe('Form content as JSON'),
        }),
        execute: async ({ approvalCode }) => {
          return `[Feishu] Approval ${approvalCode} would be submitted`
        },
      },
    },
  },
  'DingTalk Deep Integration': {
    hooks: {
      beforeMessage: (...args: unknown[]) => {
        console.log('[Plugin: DingTalk Deep] Processing message:', args)
        return { processed: true }
      },
      afterResponse: (...args: unknown[]) => {
        const [response] = args as [{ content?: string }]
        console.log('[Plugin: DingTalk Deep] Response available:', response?.content?.slice(0, 50))
        return { available: true }
      },
    },
    tools: {
      dingtalk_create_approval: {
        description: 'Create an approval process instance in DingTalk',
        inputSchema: z.object({
          processCode: z.string().describe('Approval process code'),
          originatorUserId: z.string().describe('Initiator user ID'),
          formValues: z.string().describe('Form values as JSON'),
        }),
        execute: async ({ processCode }) => {
          return `[DingTalk] Approval process ${processCode} would be initiated`
        },
      },
      dingtalk_get_calendar: {
        description: 'Get calendar events from DingTalk',
        inputSchema: z.object({
          userId: z.string().describe('User ID'),
          startDate: z.string().describe('Start date (ISO 8601)'),
          endDate: z.string().describe('End date (ISO 8601)'),
        }),
        execute: async ({ userId, startDate, endDate }) => {
          return `[DingTalk] Would fetch calendar for ${userId} from ${startDate} to ${endDate}`
        },
      },
      dingtalk_get_attendance: {
        description: 'Get attendance records from DingTalk',
        inputSchema: z.object({
          userId: z.string().describe('User ID'),
          date: z.string().describe('Date (YYYY-MM-DD)'),
        }),
        execute: async ({ userId, date }) => {
          return `[DingTalk] Would fetch attendance for ${userId} on ${date}`
        },
      },
    },
  },
}

// ─── Plugin Execution Sandbox ──────────────────────────────────────

export interface SandboxOptions {
  timeout?: number       // max execution time in ms (default: 5000)
  maxMemoryMB?: number   // soft memory limit hint (advisory; not enforced in renderer)
}

export interface SandboxResult {
  success: boolean
  result?: unknown
  error?: string
  executionTimeMs: number
}

interface SandboxStats {
  execCount: number
  errorCount: number
  totalTimeMs: number
}

/** Per-plugin execution statistics */
const sandboxStatsMap = new Map<string, SandboxStats>()

/** Globals that must be shadowed inside the sandbox */
const BLOCKED_GLOBALS: string[] = [
  'document',
  'window',
  'globalThis',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'Worker',
  'SharedWorker',
  'ServiceWorker',
  'eval',
  'Function',
  'importScripts',
  'navigator',
  'location',
  'history',
  'crypto',
  'performance',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'queueMicrotask',
  'alert',
  'confirm',
  'prompt',
  'open',
  'close',
  'postMessage',
]

/**
 * Build a restricted API object that only contains methods the plugin is
 * allowed to use based on its granted permissions.
 */
function buildSandboxAPI(ctx: PluginAPIContext): Record<string, unknown> {
  const api: Record<string, unknown> = {}
  const perms = new Set(ctx.permissions)

  if (perms.has('messages:read') || perms.has('messages:write')) {
    api.messages = ctx.api.messages
  }
  if (perms.has('agents:read') || perms.has('agents:write')) {
    api.agents = ctx.api.agents
  }
  if (perms.has('sessions:read') || perms.has('sessions:write')) {
    api.sessions = ctx.api.sessions
  }
  if (perms.has('settings:read') || perms.has('settings:write')) {
    api.settings = ctx.api.settings
  }
  if (perms.has('tools:register')) {
    api.tools = ctx.api.tools
  }
  if (perms.has('ui:extend')) {
    api.ui = ctx.api.ui
  }

  return api
}

function ensureStats(pluginId: string): SandboxStats {
  let stats = sandboxStatsMap.get(pluginId)
  if (!stats) {
    stats = { execCount: 0, errorCount: 0, totalTimeMs: 0 }
    sandboxStatsMap.set(pluginId, stats)
  }
  return stats
}

/**
 * Create a reusable sandbox bound to a specific plugin and its permissions.
 * The returned object exposes an `execute` method that runs arbitrary code
 * strings inside a restricted environment.
 */
export interface PluginSandbox {
  pluginId: string
  execute: (code: string, options?: SandboxOptions) => Promise<SandboxResult>
}

export function createPluginSandbox(pluginId: string, permissions: PluginPermission[]): PluginSandbox {
  const ctx = createPluginAPIContext(pluginId, permissions)
  const api = buildSandboxAPI(ctx)

  return {
    pluginId,
    execute: (code: string, options?: SandboxOptions) =>
      runInSandbox(pluginId, code, api, options),
  }
}

/**
 * One-shot convenience: create a temporary sandbox and execute code.
 */
export async function executeSandboxed(
  pluginId: string,
  code: string,
  options?: SandboxOptions,
): Promise<SandboxResult> {
  const permissions = getPluginPermissions(pluginId)
  const sandbox = createPluginSandbox(pluginId, permissions)
  return sandbox.execute(code, options)
}

/**
 * Return a snapshot of execution statistics for every plugin that has used
 * the sandbox at least once.
 */
export function getSandboxStats(): Map<string, SandboxStats> {
  return new Map(sandboxStatsMap)
}

// ─── Internal sandbox runner ───────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 5000

async function runInSandbox(
  pluginId: string,
  code: string,
  api: Record<string, unknown>,
  options?: SandboxOptions,
): Promise<SandboxResult> {
  const timeoutMs = options?.timeout ?? DEFAULT_TIMEOUT_MS
  const stats = ensureStats(pluginId)
  const start = Date.now()

  stats.execCount += 1

  try {
    // Build the shadow declarations that neutralise dangerous globals.
    // Each blocked name is declared as an `undefined` parameter so any
    // reference inside `code` resolves to `undefined` rather than the
    // real global.
    const shadowParams = BLOCKED_GLOBALS.join(', ')

    // The sandbox function receives a single `pluginAPI` argument that
    // carries the permitted PluginAPIContext surface.
    const wrappedSource = `"use strict";
return (async function sandboxedPlugin(pluginAPI${shadowParams ? ', ' + shadowParams : ''}) {
${code}
});`

    const factory = new Function(wrappedSource)
    const sandboxedFn = factory()
    if (typeof sandboxedFn !== 'function') {
      throw new Error('Sandbox compilation failed: factory did not return a callable function')
    }

    // Prepare shadow values — all undefined.
    const shadowArgs = new Array<undefined>(BLOCKED_GLOBALS.length).fill(undefined)

    // Race the plugin code against a timeout.
    const resultPromise = sandboxedFn(api, ...shadowArgs)

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      const id = globalThis.setTimeout(() => {
        reject(new Error(`Plugin "${pluginId}" execution timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      // Ensure the timer doesn't prevent GC of the promise if the plugin finishes first.
      resultPromise.finally(() => globalThis.clearTimeout(id))
    })

    const result = await Promise.race([resultPromise, timeoutPromise])

    const elapsed = Date.now() - start
    stats.totalTimeMs += elapsed

    return { success: true, result, executionTimeMs: elapsed }
  } catch (err: unknown) {
    const elapsed = Date.now() - start
    stats.totalTimeMs += elapsed
    stats.errorCount += 1

    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message, executionTimeMs: elapsed }
  }
}

// ─── Plugin Extension Registry ─────────────────────────────────────

export type ExtensionSlot =
  | 'sidebar'           // sidebar panel
  | 'toolbar'           // toolbar button
  | 'settings-tab'      // settings page tab
  | 'message-action'    // message action button
  | 'chat-footer'       // chat footer widget
  | 'agent-panel'       // agent detail panel section

export interface UIExtension {
  pluginId: string
  slot: ExtensionSlot
  label: string
  icon?: string
  component: () => unknown    // React component factory
  priority?: number           // sort order (lower = first)
}

export interface AgentExtension {
  pluginId: string
  /** Modifies the system prompt before sending to AI */
  systemPromptModifier?: (prompt: string, agentId: string) => string
  /** Pre-processes user messages before sending */
  messagePreProcessor?: (message: string, agentId: string) => string
  /** Post-processes AI responses */
  responsePostProcessor?: (response: string, agentId: string) => string
  /** Additional context to inject */
  contextProvider?: (agentId: string) => string
}

// Registry maps
const uiExtensions = new Map<string, UIExtension[]>()
const agentExtensions = new Map<string, AgentExtension>()

// UI Extensions
export function registerUIExtension(pluginId: string, extension: Omit<UIExtension, 'pluginId'>): void {
  requirePermission(pluginId, 'ui:extend')
  const existing = uiExtensions.get(pluginId) || []
  existing.push({ ...extension, pluginId })
  uiExtensions.set(pluginId, existing)
}

export function unregisterUIExtensions(pluginId: string): void {
  uiExtensions.delete(pluginId)
}

const byPriority = (a: UIExtension, b: UIExtension) => (a.priority ?? 99) - (b.priority ?? 99)

export function getUIExtensions(slot?: ExtensionSlot): UIExtension[] {
  const all: UIExtension[] = []
  for (const extensions of uiExtensions.values()) {
    all.push(...extensions)
  }
  if (slot) return all.filter(e => e.slot === slot).sort(byPriority)
  return all.sort(byPriority)
}

// Agent Extensions
export function registerAgentExtension(pluginId: string, extension: Omit<AgentExtension, 'pluginId'>): void {
  requirePermission(pluginId, 'agents:write')
  agentExtensions.set(pluginId, { ...extension, pluginId })
}

export function unregisterAgentExtension(pluginId: string): void {
  agentExtensions.delete(pluginId)
}

export function getAgentExtensions(): AgentExtension[] {
  return Array.from(agentExtensions.values())
}

// Apply agent extensions to system prompt
export function applyAgentExtensions(systemPrompt: string, agentId: string): string {
  let modified = systemPrompt
  for (const ext of agentExtensions.values()) {
    if (ext.systemPromptModifier) {
      modified = ext.systemPromptModifier(modified, agentId)
    }
    if (ext.contextProvider) {
      const ctx = ext.contextProvider(agentId)
      if (ctx) modified = `${modified}\n\n${ctx}`
    }
  }
  return modified
}

// Apply message pre-processing
export function applyMessagePreProcessors(message: string, agentId: string): string {
  let modified = message
  for (const ext of agentExtensions.values()) {
    if (ext.messagePreProcessor) {
      modified = ext.messagePreProcessor(modified, agentId)
    }
  }
  return modified
}

// Apply response post-processing
export function applyResponsePostProcessors(response: string, agentId: string): string {
  let modified = response
  for (const ext of agentExtensions.values()) {
    if (ext.responsePostProcessor) {
      modified = ext.responsePostProcessor(modified, agentId)
    }
  }
  return modified
}

// Cleanup all extensions for a plugin
export function cleanupPluginExtensions(pluginId: string): void {
  unregisterPluginTools(pluginId)
  unregisterUIExtensions(pluginId)
  unregisterAgentExtension(pluginId)
  unregisterSettingsPanel(pluginId)
  unregisterMessageRenderer(pluginId)
}

// ─── Plugin Marketplace / Registry ─────────────────────────────────

export interface MarketplacePlugin {
  id: string
  name: string
  version: string
  author: string
  description: string
  icon: string
  category: 'integration' | 'productivity' | 'developer' | 'ai' | 'utility' | 'communication'
  downloads: number
  rating: number          // 0-5
  hooks: PluginHookType[]
  permissions: PluginPermission[]
  configSchema?: Record<string, PluginConfigField>
  tags: string[]
  homepage?: string
}

export const PLUGIN_MARKETPLACE_CATALOG: MarketplacePlugin[] = [
  // Integration plugins
  {
    id: 'plugin-slack-integration',
    name: 'Slack Integration',
    version: '1.0.0',
    author: 'Community',
    description: 'Send and receive messages from Slack channels and DMs',
    icon: 'channel-slack',
    category: 'communication',
    downloads: 12500,
    rating: 4.5,
    hooks: ['beforeMessage', 'afterResponse'],
    permissions: ['messages:read', 'messages:write', 'network:outbound'],
    configSchema: {
      botToken: { type: 'string', label: 'Bot Token', required: true, description: 'Slack Bot OAuth token (xoxb-...)' },
      defaultChannel: { type: 'string', label: 'Default Channel', description: 'Default channel ID to post messages' },
      enableThreads: { type: 'boolean', label: 'Enable Threads', default: true },
    },
    tags: ['slack', 'messaging', 'communication'],
  },
  {
    id: 'plugin-telegram-bot',
    name: 'Telegram Bot',
    version: '1.0.0',
    author: 'Community',
    description: 'Telegram Bot integration for receiving and sending messages',
    icon: 'channel-telegram',
    category: 'communication',
    downloads: 9800,
    rating: 4.3,
    hooks: ['beforeMessage', 'afterResponse'],
    permissions: ['messages:read', 'messages:write', 'network:outbound'],
    configSchema: {
      botToken: { type: 'string', label: 'Bot Token', required: true, description: 'Telegram Bot API token from @BotFather' },
      allowedChatIds: { type: 'string', label: 'Allowed Chat IDs', description: 'Comma-separated chat IDs (empty = all)' },
      parseMode: { type: 'select', label: 'Parse Mode', default: 'Markdown', options: [{ label: 'Markdown', value: 'Markdown' }, { label: 'HTML', value: 'HTML' }, { label: 'Plain', value: 'Plain' }] },
    },
    tags: ['telegram', 'bot', 'messaging'],
  },
  {
    id: 'plugin-email-assistant',
    name: 'Email Assistant',
    version: '1.0.0',
    author: 'Community',
    description: 'Read, compose, and send emails through IMAP/SMTP',
    icon: 'settings-email',
    category: 'communication',
    downloads: 7200,
    rating: 4.1,
    hooks: ['beforeMessage', 'afterResponse', 'onAppStart'],
    permissions: ['messages:read', 'messages:write', 'network:outbound', 'settings:read'],
    configSchema: {
      imapHost: { type: 'string', label: 'IMAP Host', required: true },
      imapPort: { type: 'number', label: 'IMAP Port', default: 993 },
      smtpHost: { type: 'string', label: 'SMTP Host', required: true },
      smtpPort: { type: 'number', label: 'SMTP Port', default: 587 },
      email: { type: 'string', label: 'Email Address', required: true },
      password: { type: 'string', label: 'Password', required: true },
      checkInterval: { type: 'number', label: 'Check Interval (min)', default: 5 },
    },
    tags: ['email', 'imap', 'smtp'],
  },
  {
    id: 'plugin-notion-sync',
    name: 'Notion Sync',
    version: '1.0.0',
    author: 'Community',
    description: 'Sync conversations and notes with Notion pages and databases',
    icon: 'settings-logs',
    category: 'productivity',
    downloads: 8500,
    rating: 4.4,
    hooks: ['afterResponse', 'onSessionCreate'],
    permissions: ['messages:read', 'sessions:read', 'network:outbound', 'settings:read'],
    configSchema: {
      apiKey: { type: 'string', label: 'Notion API Key', required: true, description: 'Internal integration token' },
      databaseId: { type: 'string', label: 'Database ID', description: 'Target Notion database for syncing' },
      autoSync: { type: 'boolean', label: 'Auto-sync Sessions', default: false },
    },
    tags: ['notion', 'sync', 'productivity'],
  },
  {
    id: 'plugin-wechat-personal',
    name: 'WeChat Personal',
    version: '1.0.0',
    author: 'Community',
    description: 'Personal WeChat message forwarding integration',
    icon: 'channel-wechat',
    category: 'communication',
    downloads: 15000,
    rating: 4.2,
    hooks: ['beforeMessage', 'afterResponse'],
    permissions: ['messages:read', 'messages:write', 'network:outbound'],
    configSchema: {
      bridgeUrl: { type: 'string', label: 'Bridge Server URL', required: true, description: 'WeChat bridge server endpoint' },
      bridgeToken: { type: 'string', label: 'Bridge Token', description: 'Authentication token for the bridge' },
      autoReply: { type: 'boolean', label: 'Auto Reply', default: false },
    },
    tags: ['wechat', 'messaging', 'personal'],
  },
  {
    id: 'plugin-custom-webhook',
    name: 'Custom Webhook',
    version: '1.0.0',
    author: 'System',
    description: 'Forward AI responses to custom webhook endpoints',
    icon: 'channel-custom',
    category: 'integration',
    downloads: 6300,
    rating: 4.0,
    hooks: ['afterResponse'],
    permissions: ['messages:read', 'network:outbound', 'settings:read'],
    configSchema: {
      webhookUrl: { type: 'string', label: 'Webhook URL', required: true },
      method: { type: 'select', label: 'HTTP Method', default: 'POST', options: [{ label: 'POST', value: 'POST' }, { label: 'PUT', value: 'PUT' }] },
      headers: { type: 'string', label: 'Custom Headers (JSON)', description: '{"Authorization": "Bearer xxx"}' },
      includeContext: { type: 'boolean', label: 'Include Conversation Context', default: false },
    },
    tags: ['webhook', 'api', 'integration'],
  },
  {
    id: 'plugin-feishu-deep',
    name: 'Feishu Deep Integration',
    version: '1.0.0',
    author: 'Community',
    description: 'Deep Feishu integration: calendar, docs, approvals, and tasks',
    icon: 'channel-feishu',
    category: 'productivity',
    downloads: 5200,
    rating: 4.3,
    hooks: ['beforeMessage', 'afterResponse', 'onAgentExecute'],
    permissions: ['messages:read', 'messages:write', 'network:outbound', 'tools:register', 'settings:read'],
    configSchema: {
      appId: { type: 'string', label: 'App ID', required: true },
      appSecret: { type: 'string', label: 'App Secret', required: true },
      enableCalendar: { type: 'boolean', label: 'Enable Calendar Access', default: true },
      enableDocs: { type: 'boolean', label: 'Enable Docs Access', default: true },
      enableApprovals: { type: 'boolean', label: 'Enable Approvals', default: false },
    },
    tags: ['feishu', 'calendar', 'docs', 'approval'],
  },
  {
    id: 'plugin-dingtalk-deep',
    name: 'DingTalk Deep Integration',
    version: '1.0.0',
    author: 'Community',
    description: 'Deep DingTalk integration: approvals, calendar, and attendance',
    icon: 'channel-dingtalk',
    category: 'productivity',
    downloads: 4800,
    rating: 4.1,
    hooks: ['beforeMessage', 'afterResponse', 'onAgentExecute'],
    permissions: ['messages:read', 'messages:write', 'network:outbound', 'tools:register', 'settings:read'],
    configSchema: {
      appKey: { type: 'string', label: 'App Key', required: true },
      appSecret: { type: 'string', label: 'App Secret', required: true },
      enableApprovals: { type: 'boolean', label: 'Enable Approvals', default: true },
      enableCalendar: { type: 'boolean', label: 'Enable Calendar', default: true },
      enableAttendance: { type: 'boolean', label: 'Enable Attendance', default: false },
    },
    tags: ['dingtalk', 'approval', 'calendar', 'attendance'],
  },
  {
    id: 'plugin-code-reviewer',
    name: 'Code Reviewer',
    version: '1.0.0',
    author: 'Community',
    description: 'AI-powered code review assistant with Git integration',
    icon: 'skill-code-analysis',
    category: 'developer',
    downloads: 11000,
    rating: 4.6,
    hooks: ['beforeMessage', 'afterResponse'],
    permissions: ['messages:read', 'tools:register', 'filesystem:read'],
    configSchema: {
      language: { type: 'select', label: 'Primary Language', default: 'typescript', options: [{ label: 'TypeScript', value: 'typescript' }, { label: 'Python', value: 'python' }, { label: 'Java', value: 'java' }, { label: 'Go', value: 'go' }] },
      strictMode: { type: 'boolean', label: 'Strict Mode', default: false },
    },
    tags: ['code-review', 'git', 'developer'],
  },
  {
    id: 'plugin-knowledge-base',
    name: 'Knowledge Base',
    version: '1.0.0',
    author: 'Community',
    description: 'Build and query a local knowledge base from documents',
    icon: 'settings-knowledge',
    category: 'ai',
    downloads: 8900,
    rating: 4.5,
    hooks: ['beforeMessage', 'afterResponse', 'onAppStart'],
    permissions: ['messages:read', 'tools:register', 'filesystem:read', 'settings:read'],
    configSchema: {
      indexPath: { type: 'string', label: 'Index Directory', description: 'Path to store knowledge index' },
      chunkSize: { type: 'number', label: 'Chunk Size', default: 500 },
      topK: { type: 'number', label: 'Top-K Results', default: 5 },
    },
    tags: ['knowledge', 'rag', 'search', 'documents'],
  },
  {
    id: 'plugin-workflow-automation',
    name: 'Workflow Automation',
    version: '1.0.0',
    author: 'Community',
    description: 'Automate repetitive tasks with conditional workflows',
    icon: 'settings-events',
    category: 'productivity',
    downloads: 6700,
    rating: 4.2,
    hooks: ['onAgentExecute', 'afterResponse'],
    permissions: ['messages:read', 'agents:read', 'tools:register', 'settings:read'],
    configSchema: {
      maxSteps: { type: 'number', label: 'Max Workflow Steps', default: 20 },
      enableLogging: { type: 'boolean', label: 'Enable Step Logging', default: true },
    },
    tags: ['automation', 'workflow', 'tasks'],
  },
  {
    id: 'plugin-translation',
    name: 'Auto Translator',
    version: '1.0.0',
    author: 'Community',
    description: 'Automatically translate messages between languages',
    icon: 'agent-translator',
    category: 'utility',
    downloads: 9200,
    rating: 4.3,
    hooks: ['beforeMessage', 'afterResponse'],
    permissions: ['messages:read', 'messages:write', 'settings:read'],
    configSchema: {
      sourceLang: { type: 'select', label: 'Source Language', default: 'auto', options: [{ label: 'Auto Detect', value: 'auto' }, { label: 'English', value: 'en' }, { label: '中文', value: 'zh' }, { label: '日本語', value: 'ja' }] },
      targetLang: { type: 'select', label: 'Target Language', default: 'en', options: [{ label: 'English', value: 'en' }, { label: '中文', value: 'zh' }, { label: '日本語', value: 'ja' }, { label: 'Español', value: 'es' }] },
      autoTranslate: { type: 'boolean', label: 'Auto-translate Responses', default: false },
    },
    tags: ['translation', 'language', 'i18n'],
  },
]

// Marketplace search & filter
export function searchMarketplacePlugins(query: string, category?: MarketplacePlugin['category']): MarketplacePlugin[] {
  const lq = query.toLowerCase()
  return PLUGIN_MARKETPLACE_CATALOG.filter((p) => {
    const matchesQuery = !query || p.name.toLowerCase().includes(lq) || p.description.toLowerCase().includes(lq) || p.tags.some((t) => t.includes(lq))
    const matchesCategory = !category || p.category === category
    return matchesQuery && matchesCategory
  })
}

export function getMarketplacePluginById(id: string): MarketplacePlugin | undefined {
  return PLUGIN_MARKETPLACE_CATALOG.find((p) => p.id === id)
}

export function installMarketplacePlugin(marketplacePlugin: MarketplacePlugin): PluginInfo {
  return {
    id: marketplacePlugin.id,
    name: marketplacePlugin.name,
    version: marketplacePlugin.version,
    author: marketplacePlugin.author,
    description: marketplacePlugin.description,
    status: 'installed',
    hooks: marketplacePlugin.hooks,
    config: marketplacePlugin.configSchema ? getDefaultConfig(marketplacePlugin.configSchema) : {},
    installedAt: Date.now(),
    icon: marketplacePlugin.icon,
    homepage: marketplacePlugin.homepage,
    permissions: marketplacePlugin.permissions,
    configSchema: marketplacePlugin.configSchema,
    entryPoint: getBuiltinPluginEntryPoint(marketplacePlugin.name),
  }
}

// ─── Plugin Dependency Management ──────────────────────────────────

export interface PluginDependency {
  pluginId: string
  minVersion?: string    // semver minimum version
  optional?: boolean     // true = soft dependency
}

export interface DependencyResolution {
  resolved: boolean
  missing: { pluginId: string; required: string; available?: string }[]
  order: string[]        // installation order (topological sort)
}

export function resolvePluginDependencies(
  pluginId: string,
  dependencies: PluginDependency[],
  installedPlugins: PluginInfo[],
): DependencyResolution {
  const missing: DependencyResolution['missing'] = []
  const order: string[] = []

  for (const dep of dependencies) {
    const installed = installedPlugins.find((p) => p.id === dep.pluginId)
    if (!installed) {
      if (!dep.optional) {
        missing.push({ pluginId: dep.pluginId, required: dep.minVersion || '*' })
      }
      continue
    }

    if (dep.minVersion && compareVersions(installed.version, dep.minVersion) < 0) {
      if (!dep.optional) {
        missing.push({ pluginId: dep.pluginId, required: dep.minVersion, available: installed.version })
      }
      continue
    }

    order.push(dep.pluginId)
  }

  order.push(pluginId)

  return {
    resolved: missing.length === 0,
    missing,
    order,
  }
}

export function checkCircularDependencies(
  pluginId: string,
  dependencies: PluginDependency[],
  allDependencies: Map<string, PluginDependency[]>,
  visited: Set<string> = new Set(),
): string[] | null {
  if (visited.has(pluginId)) {
    return [...visited, pluginId]
  }

  visited.add(pluginId)
  const deps = dependencies.length > 0 ? dependencies : (allDependencies.get(pluginId) || [])

  for (const dep of deps) {
    const cycle = checkCircularDependencies(dep.pluginId, [], allDependencies, new Set(visited))
    if (cycle) return cycle
  }

  return null
}

// ─── Plugin Signature Verification ─────────────────────────────────

export interface PluginSignature {
  hash: string           // SHA-256 hex digest
  signedAt: number       // timestamp
  signedBy: string       // 'marketplace' | 'user' | org name
  algorithm: 'sha256'
  verified: boolean
}

const pluginSignatures = new Map<string, PluginSignature>()

async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Works in the renderer process without Node crypto.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

export async function signPlugin(pluginId: string, content: string, signedBy: string = 'user'): Promise<PluginSignature> {
  const hash = await computeHash(content)
  const signature: PluginSignature = {
    hash,
    signedAt: Date.now(),
    signedBy,
    algorithm: 'sha256',
    verified: true,
  }
  pluginSignatures.set(pluginId, signature)
  return signature
}

export async function verifyPluginSignature(pluginId: string, content: string): Promise<{ valid: boolean; signature?: PluginSignature; error?: string }> {
  const signature = pluginSignatures.get(pluginId)
  if (!signature) {
    return { valid: false, error: 'No signature found for plugin' }
  }

  const currentHash = await computeHash(content)
  const isValid = constantTimeEqual(currentHash, signature.hash)

  signature.verified = isValid
  pluginSignatures.set(pluginId, signature)

  return {
    valid: isValid,
    signature,
    error: isValid ? undefined : 'Content hash does not match signature',
  }
}

export function getPluginSignature(pluginId: string): PluginSignature | undefined {
  return pluginSignatures.get(pluginId)
}

export function revokePluginSignature(pluginId: string): void {
  pluginSignatures.delete(pluginId)
}

export function isPluginTrusted(pluginId: string): boolean {
  const sig = pluginSignatures.get(pluginId)
  return sig?.verified === true
}
