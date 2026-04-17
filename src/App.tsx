import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { OnboardingWizard } from '@/components/OnboardingWizard'
import { ConfirmDialogHost } from '@/components/ConfirmDialog'
import { ToastHost } from '@/components/ToastHost'
import { useTheme } from '@/hooks/useTheme'
import { useAppStore } from '@/store/appStore'
import { initChannelMessageListener } from '@/services/channelMessageHandler'
import { preloadPopularCollections } from '@/services/iconService'
import { initTimerRuntimeListener } from '@/services/timerRuntime'
import { toast } from '@/services/toast'

const ChatLayout = lazy(() => import('@/components/chat/ChatLayout').then(m => ({ default: m.ChatLayout })))
const PipelineLayout = lazy(() => import('@/components/pipeline/PipelineLayout').then(m => ({ default: m.PipelineLayout })))
const ModelsLayout = lazy(() => import('@/components/models/ModelsLayout').then(m => ({ default: m.ModelsLayout })))
const AgentsLayout = lazy(() => import('@/components/agents/AgentsLayout').then(m => ({ default: m.AgentsLayout })))
const SkillsLayout = lazy(() => import('@/components/skills/SkillsLayout').then(m => ({ default: m.SkillsLayout })))
const TimerLayout = lazy(() => import('@/components/timer/TimerLayout').then(m => ({ default: m.TimerLayout })))
const SettingsLayout = lazy(() => import('@/components/settings/SettingsLayout').then(m => ({ default: m.SettingsLayout })))
const ChannelLayout = lazy(() => import('@/components/channels/ChannelLayout').then(m => ({ default: m.ChannelLayout })))
const IntegrationsLayout = lazy(() => import('@/components/integrations/IntegrationsLayout').then(m => ({ default: m.IntegrationsLayout })))

function LazyPage({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          {label && <span className="text-xs text-text-muted/60">{label}</span>}
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/chat" replace /> },
      { path: 'chat', element: <LazyPage label="Loading chat..."><ChatLayout /></LazyPage> },
      { path: 'pipeline', element: <LazyPage label="Loading pipeline..."><PipelineLayout /></LazyPage> },
      { path: 'models', element: <LazyPage label="Loading models..."><ModelsLayout /></LazyPage> },
      { path: 'agents', element: <LazyPage label="Loading agents..."><AgentsLayout /></LazyPage> },
      { path: 'skills', element: <LazyPage label="Loading skills..."><SkillsLayout /></LazyPage> },
      { path: 'timer', element: <LazyPage label="Loading timers..."><TimerLayout /></LazyPage> },
      { path: 'channels', element: <LazyPage label="Loading channels..."><ChannelLayout /></LazyPage> },
      { path: 'mcp', element: <LazyPage label="Loading integrations..."><IntegrationsLayout /></LazyPage> },
      { path: 'settings/:section', element: <LazyPage label="Loading settings..."><SettingsLayout /></LazyPage> },
      { path: 'settings', element: <Navigate to="/settings/general" replace /> },
    ],
  },
])

export default function App() {
  useTheme()

  // Initialize channel message listener on mount
  useEffect(() => {
    const cleanup = initChannelMessageListener()
    const cleanupTimerRuntime = initTimerRuntimeListener()
    preloadPopularCollections().catch(console.error)
    return () => {
      cleanup()
      cleanupTimerRuntime()
    }
  }, [])

  // Auto-clean old sessions based on history retention setting
  useEffect(() => {
    const { historyRetentionDays, sessions } = useAppStore.getState()
    if (historyRetentionDays <= 0) return
    const cutoff = Date.now() - historyRetentionDays * 86400000
    const expiredIds = sessions.filter((s) => s.updatedAt < cutoff).map((s) => s.id)
    if (expiredIds.length === 0) return
    // Batch remove to avoid N separate setState calls
    useAppStore.setState((state) => {
      const remaining = state.sessions.filter((s) => !expiredIds.includes(s.id))
      const remainingTabs = state.openSessionTabs.filter((t) => !expiredIds.includes(t))
      const nextActiveId = state.activeSessionId && expiredIds.includes(state.activeSessionId)
        ? (remaining[0]?.id ?? null)
        : state.activeSessionId
      return {
        sessions: remaining,
        openSessionTabs: remainingTabs,
        activeSessionId: nextActiveId,
      }
    })
    // Surface the auto-cleanup so the user is aware (was silent previously).
    toast.info(
      `${expiredIds.length} old conversation(s) archived`,
      `Sessions older than ${historyRetentionDays} days were removed. Adjust in Settings → Data.`,
    )
  }, [])

  // Surface secure-storage warnings emitted by secureState.ts when API-key
  // encryption is unavailable/failing — keys are kept in memory only and not
  // written to disk in that case.
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ reason: 'unavailable' | 'encryption-failed' }>).detail
      const reason = detail?.reason ?? 'unavailable'
      toast.warning(
        'Secure storage unavailable',
        reason === 'encryption-failed'
          ? 'API key encryption failed. Keys will remain in memory only and must be re-entered after restart.'
          : 'OS keyring is not available. API keys will be kept in memory only and must be re-entered after restart.',
      )
    }
    window.addEventListener('suora:secure-storage-warning', handler)
    return () => window.removeEventListener('suora:secure-storage-warning', handler)
  }, [])

  return (
    <ErrorBoundary>
      <OnboardingWizard />
      <RouterProvider router={router} />
      <ConfirmDialogHost />
      <ToastHost />
    </ErrorBoundary>
  )
}
