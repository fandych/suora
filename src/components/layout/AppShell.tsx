import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { NavBar } from './NavBar'
import { CommandPalette } from '@/components/CommandPalette'
import { useI18n } from '@/hooks/useI18n'
import { useAppStore } from '@/store/appStore'
import { initWorkspacePath, loadSessionsFromWorkspace, loadSettingsFromWorkspace, loadExternalSkillsAndAgents } from '@/store/appStore'
import { restoreChannelRuntime } from '@/services/channelMessageHandler'
import { getResolvedPluginEntryPoint, restoreInstalledPluginRuntime } from '@/services/pluginSystem'

export function AppShell() {
  const channels = useAppStore((state) => state.channels)
  const { t } = useI18n()

  // Initialize workspace path and load persisted sessions on mount
  useEffect(() => {
    let cancelled = false

    initWorkspacePath()
      .then(() => loadSettingsFromWorkspace())
      .then(() => loadSessionsFromWorkspace())
      .then(() => loadExternalSkillsAndAgents())
      .then(async () => {
        if (cancelled) return

        const state = useAppStore.getState()
        const results = await restoreInstalledPluginRuntime(state.installedPlugins, {
          setPluginTools: state.setPluginTools,
          removePluginTools: state.removePluginTools,
        })

        const resultMap = new Map(results.map((result) => [result.pluginId, result]))
        for (const plugin of state.installedPlugins) {
          const result = resultMap.get(plugin.id)
          if (!result) continue

          const resolvedEntryPoint = result.resolvedEntryPoint ?? getResolvedPluginEntryPoint(plugin)
          const updates: Record<string, unknown> = {}

          if (resolvedEntryPoint && plugin.entryPoint !== resolvedEntryPoint) {
            updates.entryPoint = resolvedEntryPoint
          }

          if (result.status === 'restored' || result.status === 'already-active') {
            if (plugin.status !== 'enabled') {
              updates.status = 'enabled'
            }
            if (plugin.error) {
              updates.error = undefined
            }
          } else {
            updates.status = 'installed'
            updates.error = result.error || 'Runtime module unavailable for this plugin.'
          }

          if (Object.keys(updates).length > 0) {
            state.updateInstalledPlugin(plugin.id, updates)
          }
        }

        const issues = results.filter((result) => result.status !== 'restored' || result.error)
        if (issues.length > 0) {
          console.warn('Plugin runtime restore completed with issues:', issues)
        }
      })
      .catch((err) => console.error('Failed to initialize workspace:', err))

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    restoreChannelRuntime(channels).catch((err) => console.error('Failed to restore channel runtime on startup:', err))
  }, [channels])

  return (
    <div className="w-screen h-screen flex bg-surface-0 text-text-primary overflow-hidden relative">
      {/* Skip to main content — visible only on focus for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-9999 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
      >
        {t('common.skipToContent', 'Skip to main content')}
      </a>
      <NavBar />
      <main id="main-content" className="relative z-1 flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
      <CommandPalette />
    </div>
  )
}
