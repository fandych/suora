import { useEffect, useState } from "react"
import { Navigate, useParams } from "react-router"

import { Button } from "@/components/ui/button"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { useAppIntl } from "@/lib/i18n"
import { showToast } from "@/services/toast-service"
import { PreferenceApi, type PreferenceSettings } from "@/services/preference-service"
import { hasAppBridge } from "@/services/bridge"
import { ToolApi } from "@/services/tool-service"
import PageHeader from "@/pages/components/page-header"
import { ErrorCard, LoadingCard } from "@/pages/components/resource-state"
import PreferenceAboutPanel from "@/pages/preference/components/preference-about-panel"
import PreferenceEnvironmentPanel from "@/pages/preference/components/preference-environment-panel"
import PreferenceGeneralPanel from "@/pages/preference/components/preference-general-panel"
import PreferenceGlobalEnvironmentPanel from "@/pages/preference/components/preference-global-environment-panel"
import PreferenceMailPanel from "@/pages/preference/components/preference-mail-panel"
import PreferenceSecurityPanel from "@/pages/preference/components/preference-security-panel"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const PreferencePage = () => {
  const { t } = useAppIntl()
  const { section } = useParams()
  const { data, error, isLoading, reload, setData } = useAsyncResource(() => PreferenceApi.get(), [])
  const { data: systemInfo } = useAsyncResource(() => PreferenceApi.getSystemInfo(), [])
  const { data: updaterState, reload: reloadUpdaterState } = useAsyncResource(() => PreferenceApi.getUpdaterState(), [])
  const [diagnosticsRefreshToken, setDiagnosticsRefreshToken] = useState(0)
  const {
    data: diagnostics,
    error: diagnosticsError,
    isLoading: diagnosticsLoading,
  } = useAsyncResource(() => PreferenceApi.getDiagnostics(), [diagnosticsRefreshToken])
  const [draft, setDraft] = useState<PreferenceSettings>(PreferenceApi.createDefault())
  const [isSaving, setIsSaving] = useState(false)
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false)
  const [isSendingTestMail, setIsSendingTestMail] = useState(false)
  const [testMailRecipient, setTestMailRecipient] = useState("")
  const [updateResult, setUpdateResult] = useState<unknown>(null)

  useEffect(() => {
    if (data) {
      setDraft(data)
    }
  }, [data])

  useEffect(() => {
    PreferenceApi.applyToDocument(draft)
  }, [draft])

  useEffect(() => {
    if (!hasAppBridge()) {
      return
    }

    const intervalId = window.setInterval(() => {
      setDiagnosticsRefreshToken((value) => value + 1)
    }, 15000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const handleChange = (patch: Partial<PreferenceSettings>) => {
    setDraft((current) => ({
      ...current,
      ...patch,
    }))
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const next = await PreferenceApi.save(draft)
      setData(next)
      setDraft(next)
      showToast({
        title: t("preference.page.toast.saved.title", "Preferences saved"),
        description: t("preference.page.toast.saved.description", "The desktop preference profile was updated."),
        type: "success",
        timeout: 2000,
      })
    } catch (nextError) {
      showToast({
        title: t("preference.page.toast.saveFailed.title", "Save failed"),
        description: nextError instanceof Error ? nextError.message : String(nextError),
        type: "error",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCheckUpdates = async () => {
    try {
      setIsCheckingUpdates(true)
      const result = await PreferenceApi.checkForUpdates()
      setUpdateResult(result)
      void reloadUpdaterState()
      showToast({
        title: t("preference.page.toast.updateCheckComplete.title", "Update check complete"),
        description: t(
          "preference.page.toast.updateCheckComplete.description",
          "Desktop updater finished the latest check cycle.",
        ),
        type: "success",
        timeout: 2000,
      })
    } catch (nextError) {
      setUpdateResult({ error: nextError instanceof Error ? nextError.message : String(nextError) })
      showToast({
        title: t("preference.page.toast.updateCheckFailed.title", "Update check failed"),
        description: nextError instanceof Error ? nextError.message : String(nextError),
        type: "error",
      })
    } finally {
      setIsCheckingUpdates(false)
    }
  }

  const handleSendTestMail = async () => {
    const recipient = testMailRecipient.trim()
    if (!recipient) {
      showToast({
        title: t("preference.page.toast.recipientRequired.title", "Recipient required"),
        description: t(
          "preference.page.toast.recipientRequired.description",
          "Provide a test recipient email address before sending.",
        ),
        type: "warning",
      })
      return
    }
    if (!EMAIL_PATTERN.test(recipient)) {
      showToast({
        title: t("preference.page.toast.invalidRecipient.title", "Invalid recipient"),
        description: t(
          "preference.page.toast.invalidRecipient.description",
          "Provide a valid recipient email address before sending.",
        ),
        type: "warning",
      })
      return
    }

    try {
      setIsSendingTestMail(true)
      const persisted = await PreferenceApi.save(draft)
      setData(persisted)
      setDraft(persisted)
      const result = await ToolApi.sendMail({
        to: recipient,
        subject: t("preference.page.mailTest.subject", "SUORA mail service test"),
        content: [
          t("preference.page.mailTest.body.line1", "This is a test message from the SUORA global mail service."),
          t("preference.page.mailTest.body.workspace", "Workspace: {name}", {
            name: persisted.workspaceName || t("preference.general.workspaceName.placeholder", "SUORA Workspace"),
          }),
          t("preference.page.mailTest.body.sentAt", "Sent at: {value}", { value: new Date().toISOString() }),
        ].join("\n"),
      })

      if (!result.success) {
        throw new Error(result.error || "Unknown mail error")
      }

      showToast({
        title: t("preference.page.toast.mailSent.title", "Test mail sent"),
        description: t("preference.page.toast.mailSent.description", "Message delivered to {recipient}.", { recipient }),
        type: "success",
        timeout: 2500,
      })
    } catch (nextError) {
      showToast({
        title: t("preference.page.toast.mailFailed.title", "Test mail failed"),
        description: nextError instanceof Error ? nextError.message : String(nextError),
        type: "error",
      })
    } finally {
      setIsSendingTestMail(false)
    }
  }

  const renderActiveSection = () => {
    switch (section) {
      case "general":
        return <PreferenceGeneralPanel draft={draft} onChange={handleChange} />
      case "security":
        return <PreferenceSecurityPanel draft={draft} onChange={handleChange} />
      case "mail-service":
        return (
          <PreferenceMailPanel
            draft={draft}
            onChange={handleChange}
            testRecipient={testMailRecipient}
            onTestRecipientChange={setTestMailRecipient}
            onSendTestMail={() => void handleSendTestMail()}
            isSendingTestMail={isSendingTestMail}
          />
        )
      case "environment-monitor":
        return (
          <PreferenceEnvironmentPanel
            diagnostics={diagnostics}
            isLoading={diagnosticsLoading}
            error={diagnosticsError}
            onRefresh={() => setDiagnosticsRefreshToken((value) => value + 1)}
          />
        )
      case "global-environment":
        return <PreferenceGlobalEnvironmentPanel draft={draft} onChange={handleChange} />
      case "about":
        return (
          <PreferenceAboutPanel
            draft={draft}
            systemInfo={systemInfo}
            updaterState={updaterState}
            updateResult={updateResult}
            isCheckingUpdates={isCheckingUpdates}
            onChange={handleChange}
            onCheckUpdates={() => void handleCheckUpdates()}
          />
        )
      default:
        return <Navigate to="/preference/general" replace />
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={t("preference.page.title", "Preference")}
        actions={
          data ? (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? t("preference.page.action.saving", "Saving...") : t("preference.page.action.save", "Save preferences")}
            </Button>
          ) : null
        }
      />
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-6xl">
          {isLoading ? <LoadingCard title={t("preference.page.loading", "Loading preferences...")} /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error ? <div className="flex flex-col gap-6">{renderActiveSection()}</div> : null}
        </div>
      </div>
    </div>
  )
}

export default PreferencePage
