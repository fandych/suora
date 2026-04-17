import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { NavBar } from './NavBar'
import { CommandPalette } from '@/components/CommandPalette'
import { useAppStore } from '@/store/appStore'
import { initWorkspacePath, loadSessionsFromWorkspace, loadSettingsFromWorkspace, loadExternalSkillsAndAgents } from '@/store/appStore'
import { restoreChannelRuntime } from '@/services/channelMessageHandler'
import { getResolvedPluginEntryPoint, restoreInstalledPluginRuntime } from '@/services/pluginSystem'

export function AppShell() {
  const channels = useAppStore((state) => state.channels)

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
    <div role="application" aria-label="SUORA · 朔枢" className="w-screen h-screen flex bg-surface-0 text-text-primary overflow-hidden relative noise-overlay">
      {/* Skip to main content — visible only on focus for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-9999 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      {/* Ambient background glow — refined diffused lux */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-62.5 -left-37.5 w-150 h-150 rounded-full bg-accent/3 blur-[180px] animate-float-slow" />
        <div className="absolute -bottom-50 -right-30 w-125 h-125 rounded-full bg-accent-secondary/2.5 blur-[160px] animate-float-slow [animation-delay:-7s]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-175 h-87.5 rounded-full bg-accent/1 blur-[200px]" />
      </div>
      <NavBar />
      <main id="main-content" className="flex-1 flex overflow-hidden relative z-1">
        <Outlet />
      </main>
      <CommandPalette />
    </div>
  )
}
