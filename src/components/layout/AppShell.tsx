import { useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { NavBar } from './NavBar'
import { CommandPalette } from '@/components/CommandPalette'
import { useI18n } from '@/hooks/useI18n'
import { useAppStore } from '@/store/appStore'
import { initWorkspacePath, loadSessionsFromWorkspace, loadSettingsFromWorkspace, loadExternalSkillsAndAgents, waitForStoreHydration } from '@/store/appStore'
import { restoreChannelRuntime } from '@/services/channelMessageHandler'
import { getResolvedPluginEntryPoint, restoreInstalledPluginRuntime } from '@/services/pluginSystem'
import { markPerf, measurePerf } from '@/utils/perf'

async function restorePluginsFromStore(): Promise<void> {
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
}

export function AppShell() {
  const { t } = useI18n()
  const channelRuntimeStarted = useRef(false)

  // Stage 1 (blocking minimum): hydrate + workspace init so the routed view can mount.
  // Stage 2 (parallel, non-blocking): settings/sessions/skills/plugin runtime.
  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      markPerf('app:boot:start')
      try {
        await waitForStoreHydration()
        markPerf('app:boot:hydrated')
        measurePerf('app:hydrate', 'app:boot:start', 'app:boot:hydrated')

        await initWorkspacePath()
        markPerf('app:boot:workspace-ready')
        measurePerf('app:workspace-init', 'app:boot:hydrated', 'app:boot:workspace-ready')

        if (cancelled) return

        // Run the rest in parallel; failures are isolated per task.
        const parallelTasks: ReadonlyArray<{ label: string; run: () => Promise<unknown> }> = [
          { label: 'loadSettingsFromWorkspace', run: loadSettingsFromWorkspace },
          { label: 'loadSessionsFromWorkspace', run: loadSessionsFromWorkspace },
          { label: 'loadExternalSkillsAndAgents', run: loadExternalSkillsAndAgents },
          { label: 'restorePluginsFromStore', run: restorePluginsFromStore },
        ]
        const results = await Promise.allSettled(parallelTasks.map((task) => task.run()))

        if (cancelled) return

        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`Startup task ${parallelTasks[index].label} failed:`, result.reason)
          }
        })

        markPerf('app:boot:complete')
        measurePerf('app:boot:parallel-tasks', 'app:boot:workspace-ready', 'app:boot:complete')
        measurePerf('app:boot:total', 'app:boot:start', 'app:boot:complete')
      } catch (err) {
        console.error('Failed to initialize workspace:', err)
      }
    }

    boot()

    return () => {
      cancelled = true
    }
  }, [])

  // Restore channel runtime exactly once after hydration. Avoid re-running on
  // every `channels` array change which used to cause repeated webhook restarts.
  useEffect(() => {
    if (channelRuntimeStarted.current) return
    channelRuntimeStarted.current = true
    let cancelled = false
    waitForStoreHydration()
      .then(() => {
        if (cancelled) return
        const channels = useAppStore.getState().channels
        return restoreChannelRuntime(channels)
      })
      .catch((err) => console.error('Failed to restore channel runtime on startup:', err))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="app-aurora w-screen h-screen flex text-text-primary overflow-hidden relative">
      {/* Skip to main content — visible only on focus for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-9999 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
      >
        {t('common.skipToContent', 'Skip to main content')}
      </a>
      <NavBar />
      <main id="main-content" className="workbench-density relative z-1 flex min-h-0 min-w-0 flex-1 overflow-hidden border-l border-border-subtle/70 bg-surface-0/88">
        <Outlet />
      </main>
      <CommandPalette />
    </div>
  )
}
