import { useEffect } from "react"
import { HashRouter, Navigate, Route, Routes } from "react-router"
import { Toaster } from "@/components/ui/toast"
import { PreferenceApi } from "@/services/preference-service"
import { showToast } from "@/services/toast-service"
import { hasAppBridge } from "@/services/bridge"
import { initChannelRuntimeListener } from "@/services/channel-runtime-listener"
import RootLayout from "@/pages/layout"
import WorkflowsPage from "@/pages/workflows"
import SkillsPage from "@/pages/skills"
import DocumentsPage from "@/pages/documents"
import IntegrationsPage from "@/pages/integrations"
import ModelsPage from "@/pages/models"
import AgentsPage from "@/pages/agents"
import ChannelsPage from "@/pages/channels"
import SchedulersPage from "@/pages/schedulers"
import PreferencePage from "@/pages/preference"
import ChatDetailPage from "@/pages/chats/detail"
import WorkflowDetailPage from "@/pages/workflows/detail"
import SkillsDetailPage from "@/pages/skills/detail"
import DocumentsDetailPage from "@/pages/documents/detail"
import IntegrationsDetailPage from "@/pages/integrations/detail"
import ModelsDetailPage from "@/pages/models/detail"
import AgentsDetailPage from "@/pages/agents/detail"
import ChannelDetailPage from "@/pages/channels/detail"
import SchedulerDetailPage from "@/pages/schedulers/detail"
import ErrorPage from "@/pages/error"
import { preferenceRoute } from "@/pages/nav-config"

const App = () => {
  useEffect(() => {
    const cleanupChannelRuntime = initChannelRuntimeListener()
    void PreferenceApi.get().then((settings) => {
      PreferenceApi.applyToDocument(settings)
      if (settings.autoCheckUpdates && hasAppBridge()) {
        void PreferenceApi.checkUpdates().catch(() => undefined)
      }
    })

    return cleanupChannelRuntime
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
      const message = (event.error instanceof Error ? event.error.message : event.message || String(event.error || "")).trim()
      if (/^ResizeObserver loop (completed with undelivered notifications|limit exceeded)/i.test(message)) {
        return
      }

      reportError("Unexpected error", message || "Unknown error")
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      reportError(
        "Unhandled rejection",
        reason instanceof Error ? reason.message : typeof reason === "string" ? reason : JSON.stringify(reason),
      )
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
