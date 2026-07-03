import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useI18n } from '@/hooks/useI18n'
import { useAppStore } from '@/store/appStore'
import { initWorkspacePath, loadSessionsFromWorkspace, loadSettingsFromWorkspace, loadExternalSkillsAndAgents, waitForStoreHydration } from '@/store/appStore'
import { restoreChannelRuntime } from '@/services/channelMessageHandler'
import { getResolvedPluginEntryPoint, restoreInstalledPluginRuntime } from '@/services/pluginSystem'
import { markPerf, measurePerf } from '@/utils/perf'
import { scheduleAfterPaint, scheduleWhenIdle, yieldToMainThread } from '@/utils/scheduling'

const LazyNavBar = lazy(() => import('./NavBar').then((module) => ({ default: module.NavBar })))
const LazyOnboardingWizard = lazy(() => import('@/components/OnboardingWizard').then((module) => ({ default: module.OnboardingWizard })))
const LazyCommandPalette = lazy(() => import('@/components/CommandPalette').then((module) => ({ default: module.CommandPalette })))

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
  const location = useLocation()
  const [bootReady, setBootReady] = useState(false)
  const shouldShowOnboarding = useAppStore((state) => !state.onboarding.completed && !state.onboarding.skipped)
  const deferredCleanupRef = useRef<Array<() => void>>([])

  // Stage 1 (blocking minimum): hydrate only, so the shell can paint quickly.
  // Stage 2 (post-paint): workspace init + settings/sessions.
  // Stage 3 (idle): external resources, plugins, channel runtime.
  useEffect(() => {
    let cancelled = false

    const runDeferredTask = async (label: string, task: () => Promise<unknown>) => {
      try {
        await task()
      } catch (error) {
        console.error(`Startup task ${label} failed:`, error)
      }
    }

    const boot = async () => {
      markPerf('app:boot:start')
      try {
        await waitForStoreHydration()
        markPerf('app:boot:hydrated')
        measurePerf('app:hydrate', 'app:boot:start', 'app:boot:hydrated')

        if (cancelled) return
        setBootReady(true)
        markPerf('app:boot:shell-ready')
        measurePerf('app:first-render-gate', 'app:boot:start', 'app:boot:shell-ready')

        const postPaintTask = scheduleAfterPaint(() => {
          void (async () => {
            await runDeferredTask('initWorkspacePath', async () => {
              await initWorkspacePath()
              markPerf('app:boot:workspace-ready')
              measurePerf('app:workspace-init', 'app:boot:shell-ready', 'app:boot:workspace-ready')
            })
            if (cancelled) return
            await yieldToMainThread()
            await runDeferredTask('loadSettingsFromWorkspace', loadSettingsFromWorkspace)
            if (cancelled) return
            await yieldToMainThread()
            await runDeferredTask('loadSessionsFromWorkspace', loadSessionsFromWorkspace)
            if (cancelled) return

            const idleTask = scheduleWhenIdle(() => {
              void (async () => {
                markPerf('app:boot:deferred:start')
                await runDeferredTask('loadExternalSkillsAndAgents', loadExternalSkillsAndAgents)
                if (cancelled) return
                await yieldToMainThread()
                await runDeferredTask('restorePluginsFromStore', restorePluginsFromStore)
                if (cancelled) return
                await yieldToMainThread()
                await runDeferredTask('restoreChannelRuntime', async () => restoreChannelRuntime(useAppStore.getState().channels))
                if (cancelled) return
                markPerf('app:boot:complete')
                measurePerf('app:boot:deferred', 'app:boot:deferred:start', 'app:boot:complete')
                measurePerf('app:boot:total', 'app:boot:start', 'app:boot:complete')
              })()
            }, 2500)

            deferredCleanupRef.current.push(idleTask.cancel)
          })()
        })

        deferredCleanupRef.current.push(postPaintTask.cancel)
      } catch (err) {
        console.error('Failed to initialize workspace:', err)
      }
    }

    boot()

    return () => {
      cancelled = true
      deferredCleanupRef.current.forEach((cleanup) => cleanup())
      deferredCleanupRef.current = []
    }
  }, [])

  if (!bootReady) {
    return (
      <div className="app-aurora relative flex h-screen w-screen overflow-hidden bg-surface-0/96 text-text-primary">
        <div className="flex flex-1 items-center justify-center px-6">
          <div role="status" aria-live="polite" aria-label={t('app.startingWorkspace', 'Starting workspace…')} className="flex flex-col items-center gap-3 text-text-muted/72">
            <div className="h-7 w-7 rounded-full border-2 border-accent/25 border-t-accent animate-spin" />
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted/54">
              {t('app.startingWorkspace', 'Starting workspace…')}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-aurora w-screen h-screen flex text-text-primary overflow-hidden relative">
      {/* Skip to main content — visible only on focus for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-9999 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
      >
        {t('common.skipToContent', 'Skip to main content')}
      </a>
      <Suspense fallback={<div aria-hidden="true" className="h-full w-16 shrink-0 border-r border-border-subtle/80 bg-surface-1/92" />}>
        <LazyNavBar />
      </Suspense>
      <main id="main-content" className="workbench-density relative z-1 flex min-h-0 min-w-0 flex-1 overflow-hidden border-l border-border-subtle/70 bg-surface-0/88">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${location.pathname}${location.search}${location.hash}`}
            className="route-transition-shell flex min-h-0 min-w-0 flex-1"
            initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <Suspense fallback={null}>
        <LazyCommandPalette />
      </Suspense>
      <Suspense fallback={null}>
        {shouldShowOnboarding ? <LazyOnboardingWizard /> : null}
      </Suspense>
    </div>
  )
}
