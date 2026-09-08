import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { Toaster } from '@/components/ui/toast'
import { restoreChannelRuntime } from '@/data/repositories/channel-repository'
import { applyPreferenceSettingsToDocument, getPreferenceSettings } from '@/data/repositories/preference-repository'
import { showToast } from '@/lib/app-toast'
import { hasSuoraBridge, suoraIpc } from '@/lib/ipc'
import { initChannelRuntimeListener } from '@/services/channel-runtime-listener'
import RootLayout from './views/layout'
import WorkflowsPage from './views/workflows'
import SkillsPage from './views/skills'
import DocumentsPage from './views/documents'
import IntegrationsPage from './views/integrations'
import ModelsPage from './views/models'
import AgentsPage from './views/agents'
import ChannelsPage from './views/channels'
import SchedulersPage from './views/schedulers'
import PreferencePage from './views/preference'
import ChatDetailPage from './views/chats/detail'
import WorkflowDetailPage from './views/workflows/detail'
import SkillsDetailPage from './views/skills/detail'
import DocumentsDetailPage from './views/documents/detail'
import IntegrationsDetailPage from './views/integrations/detail'
import ModelsDetailPage from './views/models/detail'
import AgentsDetailPage from './views/agents/detail'
import ChannelDetailPage from './views/channels/detail'
import SchedulerDetailPage from './views/schedulers/detail'
import ErrorPage from './views/error'
import { preferenceRoute } from './views/nav-config'

const App = () => {
  useEffect(() => {
    const cleanupChannelRuntime = initChannelRuntimeListener()
    if (hasSuoraBridge()) {
      void restoreChannelRuntime().catch(() => undefined)
    }
    void getPreferenceSettings().then((settings) => {
      applyPreferenceSettingsToDocument(settings)
      if (settings.autoCheckUpdates && hasSuoraBridge()) {
        void suoraIpc.updater.check().catch(() => undefined)
      }
    })

    return () => {
      cleanupChannelRuntime()
    }
  }, [])

  useEffect(() => {
    let lastSignature = ""
    let lastTimestamp = 0

    const shouldReport = (signature: string) => {
      const now = Date.now()
      if (signature === lastSignature && now - lastTimestamp < 2000) {
        return false
      }

      lastSignature = signature
      lastTimestamp = now
      return true
    }

    const reportError = (title: string, message: string) => {
      const normalized = message.trim() || "Unknown error"
      if (!shouldReport(`${title}:${normalized}`)) {
        return
      }

      console.error(title, normalized)
      showToast({ title, description: normalized, type: "error", timeout: 5000 })
    }

    const onWindowError = (event: ErrorEvent) => {
      reportError("Unexpected error", event.error instanceof Error ? event.error.message : event.message || String(event.error || "Unknown error"))
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      reportError("Unhandled rejection", reason instanceof Error ? reason.message : typeof reason === "string" ? reason : JSON.stringify(reason))
    }

    window.addEventListener("error", onWindowError)
    window.addEventListener("unhandledrejection", onUnhandledRejection)

    return () => {
      window.removeEventListener("error", onWindowError)
      window.removeEventListener("unhandledrejection", onUnhandledRejection)
    }
  }, [])

  return (
    <Toaster>
      <HashRouter>
        <Routes>
          <Route path="/" element={<RootLayout />}>
            <Route index element={<Navigate to="/chats" replace />} />
            <Route path="chats" element={<ChatDetailPage />} />
            <Route path="chats/:chatId" element={<ChatDetailPage />} />
            <Route path="workflows" element={<WorkflowsPage />} />
            <Route path="workflows/:workflowId" element={<WorkflowDetailPage />} />
            <Route path="skills" element={<SkillsPage />} />
            <Route path="skills/:skillId" element={<SkillsDetailPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="documents/:documentId" element={<DocumentsDetailPage />} />
            <Route path="agents" element={<AgentsPage />} />
            <Route path="agents/:agentId" element={<AgentsDetailPage />} />
            <Route path="models" element={<ModelsPage />} />
            <Route path="models/:modelId" element={<ModelsDetailPage />} />
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="integrations/:integrationId" element={<IntegrationsDetailPage />} />
            <Route path="schedulers" element={<SchedulersPage />} />
            <Route path="schedulers/:schedulerId" element={<SchedulerDetailPage />} />
            <Route path="channels" element={<ChannelsPage />} />
            <Route path="channels/:channelId" element={<ChannelDetailPage />} />
            <Route path={preferenceRoute.url.slice(1)}>
              <Route index element={<Navigate to="general" replace />} />
              <Route path=":section" element={<PreferencePage />} />
            </Route>
            <Route path="*" element={<ErrorPage />} />
          </Route>
        </Routes>
      </HashRouter>

    </Toaster>
  )
}

export default App
