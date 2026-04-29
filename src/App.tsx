import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom'
import { useEffect, useMemo, lazy, Suspense } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { OnboardingWizard } from '@/components/OnboardingWizard'
import { ConfirmDialogHost } from '@/components/ConfirmDialog'
import { ToastHost } from '@/components/ToastHost'
import { useI18n } from '@/hooks/useI18n'
import { useTheme } from '@/hooks/useTheme'
import { initChannelMessageListener } from '@/services/channelMessageHandler'
import { preloadPopularCollections } from '@/services/iconService'
import { initTimerRuntimeListener } from '@/services/timerRuntime'
import { toast } from '@/services/toast'

const ChatLayout = lazy(() => import('@/components/chat/ChatLayout').then(m => ({ default: m.ChatLayout })))
const DocumentsLayout = lazy(() => import('@/components/documents/DocumentsLayout').then(m => ({ default: m.DocumentsLayout })))
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
        <div role="status" aria-live="polite" aria-label={label} className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          {label && <span className="text-xs text-text-muted/60">{label}</span>}
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

export default function App() {
  const { t } = useI18n()
  useTheme()

  const router = useMemo(() => createHashRouter([
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, element: <Navigate to="/chat" replace /> },
        { path: 'chat', element: <LazyPage label={t('app.loadingChat', 'Loading Chat…')}><ChatLayout /></LazyPage> },
        { path: 'documents', element: <LazyPage label={t('app.loadingDocuments', 'Loading Documents…')}><DocumentsLayout /></LazyPage> },
        { path: 'pipeline', element: <LazyPage label={t('app.loadingPipeline', 'Loading Pipeline…')}><PipelineLayout /></LazyPage> },
        { path: 'models', element: <Navigate to="/models/providers" replace /> },
        { path: 'models/:view', element: <LazyPage label={t('app.loadingModels', 'Loading Models…')}><ModelsLayout /></LazyPage> },
        { path: 'agents', element: <LazyPage label={t('app.loadingAgents', 'Loading Agents…')}><AgentsLayout /></LazyPage> },
        { path: 'skills', element: <Navigate to="/skills/installed" replace /> },
        { path: 'skills/:view', element: <LazyPage label={t('app.loadingSkills', 'Loading Skills…')}><SkillsLayout /></LazyPage> },
        { path: 'timer', element: <LazyPage label={t('app.loadingTimers', 'Loading Timers…')}><TimerLayout /></LazyPage> },
        { path: 'channels', element: <LazyPage label={t('app.loadingChannels', 'Loading Channels…')}><ChannelLayout /></LazyPage> },
        { path: 'mcp', element: <LazyPage label={t('app.loadingIntegrations', 'Loading Integrations…')}><IntegrationsLayout /></LazyPage> },
        { path: 'settings/:section', element: <LazyPage label={t('app.loadingSettings', 'Loading Settings…')}><SettingsLayout /></LazyPage> },
        { path: 'settings', element: <Navigate to="/settings/general" replace /> },
      ],
    },
  ]), [t])

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

  // Surface secure-storage warnings emitted by secureState.ts when API-key
  // encryption is unavailable/failing — keys are kept in memory only and not
  // written to disk in that case.
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ reason: 'unavailable' | 'encryption-failed' }>).detail
      const reason = detail?.reason ?? 'unavailable'
      toast.warning(
        t('app.secureStorageUnavailable', 'Secure Storage Unavailable'),
        reason === 'encryption-failed'
          ? t('app.secureStorageEncryptionFailed', 'API key encryption failed. Keys will remain in memory only and must be re-entered after restart.')
          : t('app.secureStorageUnavailableBody', 'OS keyring is not available. API keys will be kept in memory only and must be re-entered after restart.'),
      )
    }
    window.addEventListener('suora:secure-storage-warning', handler)
    return () => window.removeEventListener('suora:secure-storage-warning', handler)
  }, [t])

  return (
    <ErrorBoundary>
      <OnboardingWizard />
      <RouterProvider router={router} />
      <ConfirmDialogHost />
      <ToastHost />
    </ErrorBoundary>
  )
}
