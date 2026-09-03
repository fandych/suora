import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { Toaster } from '@/components/ui/toast'
import { restoreChannelRuntime } from '@/data/repositories/channel-repository'
import { applyPreferenceSettingsToDocument, getPreferenceSettings } from '@/data/repositories/preference-repository'
import { hasSuoraBridge, suoraIpc } from '@/lib/ipc'
import { initChannelRuntimeListener } from '@/services/channel-runtime-listener'
import RootLayout from './views/layout'
import DashboardPage from './views/dashboard'
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

  return (
    <Toaster>
      <HashRouter>
        <Routes>
          <Route path="/" element={<RootLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
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
            <Route path={preferenceRoute.url.slice(1)} element={<PreferencePage />} />
            <Route path="*" element={<ErrorPage />} />
          </Route>
        </Routes>
      </HashRouter>

    </Toaster>
  )
}

export default App
