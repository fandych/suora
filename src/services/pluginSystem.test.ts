import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import {
  BUILTIN_PLUGIN_ENTRY_PREFIX,
  BUILTIN_PLUGIN_MODULES,
  grantPermissions,
  revokePermissions,
  hasPermission,
  getPluginPermissions,
  registerPluginTools,
  unregisterPluginTools,
  getPluginTools,
  getPluginToolNames,
  validatePlugin,
  validateManifest,
  installPlugin,
  enablePlugin,
  disablePlugin,
  getRegisteredHooks,
  executeHook,
  checkPluginUpdate,
  compareVersions,
  getDefaultConfig,
  validateConfig,
  registerSettingsPanel,
  unregisterSettingsPanel,
  getSettingsExtensions,
  registerMessageRenderer,
  unregisterMessageRenderer,
  getMessageRenderers,
  getBuiltinPluginEntryPoint,
  loadPluginFromManifest,
  activatePlugin,
  deactivatePlugin,
  getResolvedPluginEntryPoint,
  getLoadedPlugins,
  resolvePluginRuntimeModule,
  searchMarketplacePlugins,
  getMarketplacePluginById,
  installMarketplacePlugin,
  PLUGIN_MARKETPLACE_CATALOG,
  resolvePluginDependencies,
  restoreInstalledPluginRuntime,
  signPlugin,
  verifyPluginSignature,
  PLUGIN_TEMPLATES,
} from './pluginSystem'
import type { PluginInfo, PluginManifestV2 } from '@/types'
import * as fileStorage from '@/services/fileStorage'

function createTestToolSet(...names: string[]): ToolSet {
  const tools: ToolSet = {}

  for (const name of names) {
    tools[name] = tool({
      description: name,
      inputSchema: z.object({}),
      execute: async () => 'ok',
    })
  }

  return tools
}

// Mock crypto.subtle for testing
vi.stubGlobal('crypto', {
  subtle: {
    digest: async (_algorithm: string, data: Uint8Array) => {
      const str = new TextDecoder().decode(data)
      const hash = str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
      const buffer = new ArrayBuffer(32)
      const view = new Uint8Array(buffer)
      const numStr = hash.toString()
      for (let i = 0; i < Math.min(numStr.length, 32); i++) {
        view[i] = numStr.charCodeAt(i)
      }
      return buffer
    },
  },
})

describe('pluginSystem', () => {
  beforeEach(async () => {
    await Promise.all(Array.from(getLoadedPlugins().keys()).map((pluginId) => deactivatePlugin(pluginId)))

    // Clean up between tests
    revokePermissions('test-plugin')
    unregisterPluginTools('test-plugin')
    disablePlugin('test-plugin')
    unregisterSettingsPanel('test-plugin')
    unregisterMessageRenderer('test-plugin')
  })

  describe('Permission Management', () => {
    it('should grant and check permissions', () => {
      grantPermissions('test-plugin', ['messages:read', 'tools:register'])
      expect(hasPermission('test-plugin', 'messages:read')).toBe(true)
      expect(hasPermission('test-plugin', 'tools:register')).toBe(true)
      expect(hasPermission('test-plugin', 'messages:write')).toBe(false)
    })

    it('should return granted permissions', () => {
      grantPermissions('test-plugin', ['messages:read', 'agents:read'])
      const perms = getPluginPermissions('test-plugin')
      expect(perms).toContain('messages:read')
      expect(perms).toContain('agents:read')
      expect(perms).toHaveLength(2)
    })

    it('should revoke permissions', () => {
      grantPermissions('test-plugin', ['messages:read'])
      revokePermissions('test-plugin')
      expect(hasPermission('test-plugin', 'messages:read')).toBe(false)
      expect(getPluginPermissions('test-plugin')).toHaveLength(0)
    })

    it('should return empty for unknown plugin', () => {
      expect(hasPermission('unknown', 'messages:read')).toBe(false)
      expect(getPluginPermissions('unknown')).toHaveLength(0)
    })
  })

  describe('Tool Registration', () => {
    it('should register and retrieve tools', () => {
      grantPermissions('test-plugin', ['tools:register'])
      registerPluginTools('test-plugin', createTestToolSet('test_tool'))
      const allTools = getPluginTools()
      expect(Object.keys(allTools)).toContain('test_tool')
    })

    it('should get plugin tool names', () => {
      grantPermissions('test-plugin', ['tools:register'])
      registerPluginTools('test-plugin', createTestToolSet('tool_a', 'tool_b'))
      const names = getPluginToolNames('test-plugin')
      expect(names).toContain('tool_a')
      expect(names).toContain('tool_b')
    })

    it('should unregister tools', () => {
      grantPermissions('test-plugin', ['tools:register'])
      registerPluginTools('test-plugin', createTestToolSet('my_tool'))
      unregisterPluginTools('test-plugin')
      expect(getPluginToolNames('test-plugin')).toHaveLength(0)
    })

    it('should throw without permission', () => {
      expect(() => registerPluginTools('test-plugin', {})).toThrow(/lacks required permission/)
    })
  })

  describe('Plugin Validation', () => {
    it('should validate a valid plugin', () => {
      const result = validatePlugin({
        id: 'test',
        name: 'Test Plugin',
        version: '1.0.0',
        hooks: ['afterResponse'],
      })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject plugin without id', () => {
      const result = validatePlugin({ name: 'Test', version: '1.0.0', hooks: ['afterResponse'] })
      expect(result.valid).toBe(false)
      expect(result.errors.some((e: string) => e.includes('id'))).toBe(true)
    })

    it('should reject plugin with short name', () => {
      const result = validatePlugin({ id: 'x', name: 'X', version: '1.0.0', hooks: ['afterResponse'] })
      expect(result.valid).toBe(false)
    })

    it('should reject plugin without hooks', () => {
      const result = validatePlugin({ id: 'x', name: 'Test', version: '1.0.0', hooks: [] })
      expect(result.valid).toBe(false)
    })

    it('should reject unknown hook types', () => {
      const result = validatePlugin({ id: 'x', name: 'Test', version: '1.0.0', hooks: ['unknownHook'] as unknown as PluginInfo['hooks'] })
      expect(result.valid).toBe(false)
      expect(result.errors.some((e: string) => e.includes('Unknown hook'))).toBe(true)
    })
  })

  describe('Manifest Validation', () => {
    it('should validate a valid manifest', () => {
      const result = validateManifest({
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        hooks: ['afterResponse'],
        permissions: ['messages:read'],
      })
      expect(result.valid).toBe(true)
    })

    it('should reject unknown permissions', () => {
      const result = validateManifest({
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        hooks: ['afterResponse'],
        permissions: ['unknown:perm'] as unknown as PluginManifestV2['permissions'],
      })
      expect(result.valid).toBe(false)
    })
  })

  describe('Plugin Lifecycle', () => {
    it('should install plugin with correct status', () => {
      const plugin = installPlugin({
        id: 'p1', name: 'Plugin', version: '1.0.0', author: 'Test',
        description: 'Desc', status: 'disabled', hooks: ['afterResponse'],
        config: {}, installedAt: 0,
      })
      expect(plugin.status).toBe('installed')
      expect(plugin.installedAt).toBeGreaterThan(0)
    })

    it('should enable plugin hooks', () => {
      const handler = vi.fn()
      enablePlugin('test-plugin', ['afterResponse'], { afterResponse: handler })
      const hooks = getRegisteredHooks()
      expect(hooks.afterResponse).toContain('test-plugin')
    })

    it('should disable plugin hooks', () => {
      enablePlugin('test-plugin', ['afterResponse'], { afterResponse: vi.fn() })
      disablePlugin('test-plugin')
      const hooks = getRegisteredHooks()
      expect(hooks.afterResponse).not.toContain('test-plugin')
    })
  })

  describe('Hook Execution', () => {
    it('should execute hooks and return results', async () => {
      const handler = vi.fn().mockResolvedValue({ result: 42 })
      enablePlugin('test-plugin', ['afterResponse'], { afterResponse: handler })
      const results = await executeHook('afterResponse', { content: 'hello' })
      expect(results).toHaveLength(1)
      expect(handler).toHaveBeenCalledWith({ content: 'hello' })
    })

    it('should handle hook errors gracefully', async () => {
      enablePlugin('test-plugin', ['afterResponse'], { afterResponse: () => { throw new Error('boom') } })
      const results = await executeHook('afterResponse')
      expect(results).toHaveLength(1)
      const errorResult = results[0] as { error?: string }
      expect(errorResult.error).toBe('boom')
    })

    it('should return empty for hooks with no handlers', async () => {
      const results = await executeHook('onAppStart')
      expect(results).toHaveLength(0)
    })
  })

  describe('Version Management', () => {
    it('should compare versions correctly', () => {
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1)
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1)
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
      expect(compareVersions('1.1.0', '1.0.0')).toBe(1)
      expect(compareVersions('1.0.1', '1.0.0')).toBe(1)
    })

    it('should detect available updates', () => {
      const plugin = { version: '1.0.0' } as PluginInfo
      expect(checkPluginUpdate(plugin, '1.1.0')).toBe(true)
      expect(checkPluginUpdate(plugin, '1.0.0')).toBe(false)
      expect(checkPluginUpdate(plugin, '0.9.0')).toBe(false)
    })
  })

  describe('Config Helpers', () => {
    it('should generate default config from schema', () => {
      const schema = {
        name: { type: 'string' as const, label: 'Name', default: 'hello' },
        count: { type: 'number' as const, label: 'Count', default: 5 },
        enabled: { type: 'boolean' as const, label: 'Enabled', default: true },
      }
      const config = getDefaultConfig(schema)
      expect(config.name).toBe('hello')
      expect(config.count).toBe(5)
      expect(config.enabled).toBe(true)
    })

    it('should validate config', () => {
      const schema = {
        name: { type: 'string' as const, label: 'Name', required: true },
        count: { type: 'number' as const, label: 'Count' },
      }
      expect(validateConfig({ name: 'test', count: 5 }, schema).valid).toBe(true)
      expect(validateConfig({ count: 5 }, schema).valid).toBe(false) // missing required
      expect(validateConfig({ name: 'test', count: 'not-a-number' }, schema).valid).toBe(false)
    })
  })

  describe('Settings / Message Extensions', () => {
    it('should register and get settings panels', () => {
      grantPermissions('test-plugin', ['ui:extend'])
      const panel = () => 'settings'
      registerSettingsPanel('test-plugin', panel)
      const panels = getSettingsExtensions()
      expect(panels.has('test-plugin')).toBe(true)
    })

    it('should register and get message renderers', () => {
      grantPermissions('test-plugin', ['ui:extend'])
      const renderer = (msg: { content: string; role: string }) => msg.content
      registerMessageRenderer('test-plugin', renderer)
      const renderers = getMessageRenderers()
      expect(renderers.has('test-plugin')).toBe(true)
    })
  })

  describe('Manifest Loading', () => {
    it('should load plugin from valid manifest', async () => {
      const manifest: PluginManifestV2 = {
        id: 'test-manifest',
        name: 'Test Manifest',
        version: '2.0.0',
        author: 'Tester',
        description: 'A test plugin',
        hooks: ['afterResponse'],
        permissions: ['messages:read'],
      }
      const plugin = await loadPluginFromManifest(manifest)
      expect(plugin.id).toBe('test-manifest')
      expect(plugin.version).toBe('2.0.0')
      expect(plugin.status).toBe('installed')
    })

    it('should reject invalid manifest', async () => {
      const invalidManifest = { id: '', name: '', version: '', hooks: [], permissions: [] } as unknown as PluginManifestV2
      await expect(loadPluginFromManifest(invalidManifest)).rejects.toThrow()
    })

    it('should preserve entryPoint and build default config from manifest schema', async () => {
      const manifest: PluginManifestV2 = {
        id: 'manifest-entry',
        name: 'Manifest Entry',
        version: '1.0.0',
        author: 'Tester',
        description: 'Manifest entry point test',
        hooks: ['afterResponse'],
        permissions: ['messages:read'],
        entryPoint: `${BUILTIN_PLUGIN_ENTRY_PREFIX}Email Assistant`,
        config: {
          enabled: { type: 'boolean', label: 'Enabled', default: true },
        },
      }

      const plugin = await loadPluginFromManifest(manifest)

      expect(plugin.entryPoint).toBe(`${BUILTIN_PLUGIN_ENTRY_PREFIX}Email Assistant`)
      expect(plugin.config).toEqual({ enabled: true })
    })
  })

  describe('Plugin Activation', () => {
    it('should activate plugin with module', async () => {
      const plugin: PluginInfo = {
        id: 'activate-test',
        name: 'Activate Test',
        version: '1.0.0',
        author: 'Test',
        description: 'Test',
        status: 'installed',
        hooks: ['afterResponse'],
        config: {},
        installedAt: Date.now(),
        permissions: ['messages:read', 'tools:register'],
      }
      const activate = vi.fn()
      const module = { activate, hooks: { afterResponse: vi.fn() } }
      await activatePlugin(plugin, module)
      expect(activate).toHaveBeenCalled()
    })

    it('should deactivate plugin', async () => {
      const plugin: PluginInfo = {
        id: 'deactivate-test',
        name: 'Deactivate Test',
        version: '1.0.0',
        author: 'Test',
        description: 'Test',
        status: 'enabled',
        hooks: ['afterResponse'],
        config: {},
        installedAt: Date.now(),
        permissions: ['messages:read'],
      }
      const deactivateFn = vi.fn()
      await activatePlugin(plugin, { deactivate: deactivateFn })
      await deactivatePlugin(plugin.id)
      expect(deactivateFn).toHaveBeenCalled()
    })

    it('should resolve builtin runtime module from entryPoint', () => {
      const entryPoint = getBuiltinPluginEntryPoint('Email Assistant')
      const resolvedEntryPoint = getResolvedPluginEntryPoint({ name: 'Custom Email', entryPoint })
      const module = resolvePluginRuntimeModule({ name: 'Custom Email', entryPoint })

      expect(entryPoint).toBe('builtin:Email Assistant')
      expect(resolvedEntryPoint).toBe(entryPoint)
      expect(module).toBe(BUILTIN_PLUGIN_MODULES['Email Assistant'])
    })

    it('should restore enabled plugin runtime on startup', async () => {
      const plugin: PluginInfo = {
        id: 'restore-test',
        name: 'Restore Test',
        version: '1.0.0',
        author: 'Test',
        description: 'Test runtime restore',
        status: 'enabled',
        hooks: ['afterResponse', 'onAppStart'],
        config: {},
        installedAt: Date.now(),
        permissions: ['messages:read', 'tools:register'],
      }
      const activate = vi.fn()
      const afterResponse = vi.fn().mockReturnValue({ restored: true })
      const onAppStart = vi.fn().mockReturnValue({ started: true })
      const setPluginTools = vi.fn()
      const removePluginTools = vi.fn()

      BUILTIN_PLUGIN_MODULES[plugin.name] = {
        activate,
        hooks: {
          afterResponse,
          onAppStart,
        },
        tools: createTestToolSet('restore_tool'),
      }

      try {
        const results = await restoreInstalledPluginRuntime([plugin], {
          setPluginTools,
          removePluginTools,
        })

        expect(results).toHaveLength(1)
        expect(results[0]).toMatchObject({
          pluginId: plugin.id,
          status: 'restored',
          toolNames: ['restore_tool'],
        })
        expect(activate).toHaveBeenCalledTimes(1)
        expect(onAppStart).toHaveBeenCalledTimes(1)
        expect(setPluginTools).toHaveBeenCalledWith(plugin.id, ['restore_tool'])
        expect(removePluginTools).not.toHaveBeenCalled()

        const hookResults = await executeHook('afterResponse', { content: 'hello' })
        expect(hookResults).toHaveLength(1)
        expect(afterResponse).toHaveBeenCalledWith({ content: 'hello' })
      } finally {
        delete BUILTIN_PLUGIN_MODULES[plugin.name]
        await deactivatePlugin(plugin.id)
      }
    })

    it('should restore runtime using entryPoint even when plugin name differs', async () => {
      const plugin: PluginInfo = {
        id: 'entrypoint-restore-test',
        name: 'Custom Email Wrapper',
        version: '1.0.0',
        author: 'Test',
        description: 'Uses builtin runtime via entryPoint',
        status: 'enabled',
        hooks: ['afterResponse', 'onAppStart'],
        config: {},
        installedAt: Date.now(),
        permissions: ['messages:read', 'tools:register'],
        entryPoint: getBuiltinPluginEntryPoint('Email Assistant'),
      }

      const results = await restoreInstalledPluginRuntime([plugin])

      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        pluginId: plugin.id,
        status: 'restored',
        resolvedEntryPoint: 'builtin:Email Assistant',
      })
      expect(results[0].toolNames).toEqual(expect.arrayContaining(['email_send', 'email_check']))

      await deactivatePlugin(plugin.id)
    })

    it('should let the email assistant tool send using persisted email settings', async () => {
      const plugin: PluginInfo = {
        id: 'email-send-test',
        name: 'Email Sender Wrapper',
        version: '1.0.0',
        author: 'Test',
        description: 'Uses builtin email runtime via entryPoint',
        status: 'enabled',
        hooks: ['afterResponse', 'onAppStart'],
        config: {},
        installedAt: Date.now(),
        permissions: ['messages:read', 'tools:register', 'settings:read', 'network:outbound'],
        entryPoint: getBuiltinPluginEntryPoint('Email Assistant'),
      }

      const readCachedSpy = vi.spyOn(fileStorage, 'readCached').mockImplementation((key: string) => {
        if (key !== 'suora-store') return null
        return JSON.stringify({
          state: {
            emailConfig: {
              smtpHost: 'smtp.example.com',
              smtpPort: 465,
              secure: true,
              username: 'bot@example.com',
              password: 'secret',
              fromName: 'Suora Bot',
              fromAddress: 'bot@example.com',
              enabled: true,
            },
          },
        })
      })

      const invoke = vi.fn().mockResolvedValue({ success: true, messageId: 'msg-123' })
      Object.defineProperty(window, 'electron', {
        configurable: true,
        value: { invoke },
      })

      try {
        await restoreInstalledPluginRuntime([plugin])

        const toolSet = getPluginTools()
        const emailTool = toolSet.email_send as { execute?: (input: { to: string; subject: string; body: string }) => Promise<string> }
        const output = await emailTool.execute?.({
          to: 'user@example.com',
          subject: 'Hello',
          body: 'World',
        })

        expect(output).toContain('Email sent successfully to user@example.com')
        expect(invoke).toHaveBeenCalledWith('email:send', {
          smtpHost: 'smtp.example.com',
          smtpPort: 465,
          secure: true,
          username: 'bot@example.com',
          password: 'secret',
          fromName: 'Suora Bot',
          fromAddress: 'bot@example.com',
        }, {
          to: 'user@example.com',
          subject: 'Hello',
          body: 'World',
          cc: undefined,
          bcc: undefined,
          isHtml: false,
        })
      } finally {
        readCachedSpy.mockRestore()
        await deactivatePlugin(plugin.id)
        Reflect.deleteProperty(window, 'electron')
      }
    })

    it('should not reactivate plugins that are already loaded', async () => {
      const plugin: PluginInfo = {
        id: 'already-active-test',
        name: 'Already Active Test',
        version: '1.0.0',
        author: 'Test',
        description: 'Test repeated restore',
        status: 'enabled',
        hooks: ['onAppStart'],
        config: {},
        installedAt: Date.now(),
        permissions: ['messages:read'],
      }
      const activate = vi.fn()
      const onAppStart = vi.fn()

      BUILTIN_PLUGIN_MODULES[plugin.name] = {
        activate,
        hooks: { onAppStart },
      }

      try {
        const first = await restoreInstalledPluginRuntime([plugin])
        const second = await restoreInstalledPluginRuntime([plugin])

        expect(first[0]).toMatchObject({ pluginId: plugin.id, status: 'restored' })
        expect(second[0]).toMatchObject({ pluginId: plugin.id, status: 'already-active' })
        expect(activate).toHaveBeenCalledTimes(1)
        expect(onAppStart).toHaveBeenCalledTimes(1)
      } finally {
        delete BUILTIN_PLUGIN_MODULES[plugin.name]
        await deactivatePlugin(plugin.id)
      }
    })

    it('should clear stale tool metadata when runtime module is unavailable', async () => {
      const plugin: PluginInfo = {
        id: 'missing-runtime-test',
        name: 'Missing Runtime Test',
        version: '1.0.0',
        author: 'Test',
        description: 'Test missing runtime module',
        status: 'enabled',
        hooks: ['afterResponse'],
        config: {},
        installedAt: Date.now(),
        permissions: ['messages:read', 'tools:register'],
      }
      const removePluginTools = vi.fn()

      const results = await restoreInstalledPluginRuntime([plugin], { removePluginTools })

      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        pluginId: plugin.id,
        status: 'skipped-no-module',
        toolNames: [],
      })
      expect(removePluginTools).toHaveBeenCalledWith(plugin.id)
    })
  })

  describe('Plugin Marketplace', () => {
    it('should have catalog entries', () => {
      expect(PLUGIN_MARKETPLACE_CATALOG.length).toBeGreaterThan(0)
    })

    it('should search by name', () => {
      const results = searchMarketplacePlugins('slack')
      expect(results.some(p => p.name.toLowerCase().includes('slack'))).toBe(true)
    })

    it('should filter by category', () => {
      const results = searchMarketplacePlugins('', 'communication')
      expect(results.every(p => p.category === 'communication')).toBe(true)
    })

    it('should get plugin by ID', () => {
      const plugin = getMarketplacePluginById('plugin-slack-integration')
      expect(plugin).toBeDefined()
      expect(plugin?.name).toBe('Slack Integration')
    })

    it('should install marketplace plugin', () => {
      const mp = PLUGIN_MARKETPLACE_CATALOG[0]
      const installed = installMarketplacePlugin(mp)
      expect(installed.id).toBe(mp.id)
      expect(installed.status).toBe('installed')
      expect(installed.entryPoint).toBe(getBuiltinPluginEntryPoint(mp.name))
    })
  })

  describe('Dependency Resolution', () => {
    it('should resolve satisfied dependencies', () => {
      const installed: PluginInfo[] = [{
        id: 'dep-1', name: 'Dep 1', version: '1.0.0', author: '', description: '',
        status: 'enabled', hooks: ['afterResponse'], config: {}, installedAt: Date.now(),
      }]
      const result = resolvePluginDependencies('my-plugin', [{ pluginId: 'dep-1' }], installed)
      expect(result.resolved).toBe(true)
      expect(result.missing).toHaveLength(0)
    })

    it('should report missing dependencies', () => {
      const result = resolvePluginDependencies('my-plugin', [{ pluginId: 'missing-dep' }], [])
      expect(result.resolved).toBe(false)
      expect(result.missing).toHaveLength(1)
    })

    it('should allow optional missing dependencies', () => {
      const result = resolvePluginDependencies('my-plugin', [{ pluginId: 'opt-dep', optional: true }], [])
      expect(result.resolved).toBe(true)
    })
  })

  describe('Plugin Signing', () => {
    it('should sign and verify plugin', async () => {
      const sig = await signPlugin('sign-test', 'test content', 'user')
      expect(sig.hash).toBeDefined()
      expect(sig.signedBy).toBe('user')
      expect(sig.verified).toBe(true)

      const verification = await verifyPluginSignature('sign-test', 'test content')
      expect(verification.valid).toBe(true)
    })

    it('should detect tampered content', async () => {
      await signPlugin('tamper-test', 'original content', 'user')
      const verification = await verifyPluginSignature('tamper-test', 'modified content')
      expect(verification.valid).toBe(false)
    })

    it('should return invalid for unsigned plugin', async () => {
      const verification = await verifyPluginSignature('unsigned-plugin', 'content')
      expect(verification.valid).toBe(false)
    })
  })

  describe('Templates', () => {
    it('should have plugin templates', () => {
      expect(PLUGIN_TEMPLATES.length).toBeGreaterThan(0)
      for (const tpl of PLUGIN_TEMPLATES) {
        expect(tpl.name).toBeTruthy()
        expect(tpl.version).toBeTruthy()
        expect(tpl.hooks.length).toBeGreaterThan(0)
      }
    })
  })
})
