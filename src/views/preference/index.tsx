import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { showToast } from "@/lib/app-toast"
import { applyPreferenceSettingsToDocument, createDefaultPreferenceSettings, getPreferenceSettings, savePreferenceSettings, type PreferenceSettings } from "@/data/repositories/preference-repository"
import { checkForUpdates, getSystemDiagnostics, getSystemInfo, getUpdaterState } from "@/data/repositories/system-status-repository"
import { hasSuoraBridge, suoraIpc } from "@/lib/ipc"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import PreferenceAboutPanel from "@/views/preference/components/preference-about-panel"
import PreferenceEnvironmentPanel from "@/views/preference/components/preference-environment-panel"
import PreferenceGeneralPanel from "@/views/preference/components/preference-general-panel"
import PreferenceGlobalEnvironmentPanel from "@/views/preference/components/preference-global-environment-panel"
import PreferenceMailPanel from "@/views/preference/components/preference-mail-panel"
import PreferenceSecurityPanel from "@/views/preference/components/preference-security-panel"

const PreferencePage = () => {
  const { data, error, isLoading, reload, setData } = useAsyncResource(() => getPreferenceSettings(), [])
  const { data: systemInfo } = useAsyncResource(() => getSystemInfo(), [])
  const { data: updaterState, reload: reloadUpdaterState } = useAsyncResource(() => getUpdaterState(), [])
  const [diagnosticsRefreshToken, setDiagnosticsRefreshToken] = useState(0)
  const { data: diagnostics, error: diagnosticsError, isLoading: diagnosticsLoading } = useAsyncResource(() => getSystemDiagnostics(), [diagnosticsRefreshToken])
  const [draft, setDraft] = useState<PreferenceSettings>(createDefaultPreferenceSettings())
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
    applyPreferenceSettingsToDocument(draft)
  }, [draft])

  useEffect(() => {
    if (!hasSuoraBridge()) {
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
      const next = await savePreferenceSettings(draft)
      setData(next)
      setDraft(next)
      showToast({ title: "Preferences saved", description: "The desktop preference profile was updated.", type: "success", timeout: 2000 })
    } catch (nextError) {
      showToast({ title: "Save failed", description: nextError instanceof Error ? nextError.message : String(nextError), type: "error" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCheckUpdates = async () => {
    try {
      setIsCheckingUpdates(true)
      const result = await checkForUpdates()
      setUpdateResult(result)
      void reloadUpdaterState()
      showToast({ title: "Update check complete", description: "Desktop updater finished the latest check cycle.", type: "success", timeout: 2000 })
    } catch (nextError) {
      setUpdateResult({ error: nextError instanceof Error ? nextError.message : String(nextError) })
      showToast({ title: "Update check failed", description: nextError instanceof Error ? nextError.message : String(nextError), type: "error" })
    } finally {
      setIsCheckingUpdates(false)
    }
  }

  const handleSendTestMail = async () => {
    const recipient = testMailRecipient.trim()
    if (!recipient) {
      showToast({ title: "Recipient required", description: "Provide a test recipient email address before sending.", type: "warning" })
      return
    }

    try {
      setIsSendingTestMail(true)
      const persisted = await savePreferenceSettings(draft)
      setData(persisted)
      setDraft(persisted)
      const result = await suoraIpc.mail.send({
        to: recipient,
        subject: "SUORA mail service test",
        content: [
          "This is a test message from the SUORA global mail service.",
          `Workspace: ${persisted.workspaceName || "SUORA Workspace"}`,
          `Sent at: ${new Date().toISOString()}`,
        ].join("\n"),
      })

      if (!result.success) {
        throw new Error(result.error || "Unknown mail error")
      }

      showToast({ title: "Test mail sent", description: `Message delivered to ${recipient}.`, type: "success", timeout: 2500 })
    } catch (nextError) {
      showToast({ title: "Test mail failed", description: nextError instanceof Error ? nextError.message : String(nextError), type: "error" })
    } finally {
      setIsSendingTestMail(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title="Preference" actions={data ? <Button onClick={handleSave} disabled={isSaving}>{isSaving ? "Saving..." : "Save preferences"}</Button> : null} />
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-6xl">
          {isLoading ? <LoadingCard title="Loading preferences..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error ? (
            <div className="flex flex-col gap-6">
              <PreferenceGeneralPanel draft={draft} onChange={handleChange} />
              <PreferenceSecurityPanel draft={draft} onChange={handleChange} />
              <PreferenceMailPanel draft={draft} onChange={handleChange} testRecipient={testMailRecipient} onTestRecipientChange={setTestMailRecipient} onSendTestMail={() => void handleSendTestMail()} isSendingTestMail={isSendingTestMail} />
              <PreferenceEnvironmentPanel diagnostics={diagnostics} isLoading={diagnosticsLoading} error={diagnosticsError} onRefresh={() => setDiagnosticsRefreshToken((value) => value + 1)} />
              <PreferenceGlobalEnvironmentPanel draft={draft} onChange={handleChange} />
              <PreferenceAboutPanel draft={draft} systemInfo={systemInfo} updaterState={updaterState} updateResult={updateResult} isCheckingUpdates={isCheckingUpdates} onChange={handleChange} onCheckUpdates={() => void handleCheckUpdates()} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default PreferencePage