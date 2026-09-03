import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { applyPreferenceSettingsToDocument, getPreferenceSettings, savePreferenceSettings, type PreferenceSettings } from "@/data/repositories/preference-repository"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"

const PreferencePage = () => {
  const { data, error, isLoading, reload, setData } = useAsyncResource(() => getPreferenceSettings(), [])
  const [draft, setDraft] = useState<PreferenceSettings>({
    themeMode: "system",
    language: "zh",
    workspaceName: "",
    workspacePath: "",
    autoSaveConversations: true,
    autoStartEnabled: false,
    defaultModelProviderId: "",
    chatRequestTimeoutMs: 0,
    notes: "",
  })

  useEffect(() => {
    if (data) {
      setDraft(data)
      applyPreferenceSettingsToDocument(data)
    }
  }, [data])

  const handleSave = async () => {
    const next = await savePreferenceSettings(draft)
    setData(next)
  }

  const handleThemeChange = (value: PreferenceSettings["themeMode"]) => {
    const next = { ...draft, themeMode: value }
    setDraft(next)
    applyPreferenceSettingsToDocument(next)
  }

  const handleLanguageChange = (value: PreferenceSettings["language"]) => {
    const next = { ...draft, language: value }
    setDraft(next)
    applyPreferenceSettingsToDocument(next)
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title="Preference" description="Workspace-level preference settings via the module bridge." actions={data ? <Button onClick={handleSave}>Save preferences</Button> : null} />
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-5xl">
          {isLoading ? <LoadingCard title="Loading preferences..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error ? (
            <div className="space-y-6">
              <Card id="general">
                <CardHeader>
                  <CardTitle>General</CardTitle>
                  <CardDescription>Theme, language, and workspace identity defaults for the desktop shell.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Theme</div>
                    <NativeSelect value={draft.themeMode} onChange={(event) => handleThemeChange(event.target.value as PreferenceSettings["themeMode"])}>
                      <NativeSelectOption value="system">System</NativeSelectOption>
                      <NativeSelectOption value="light">Light</NativeSelectOption>
                      <NativeSelectOption value="dark">Dark</NativeSelectOption>
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Language</div>
                    <NativeSelect value={draft.language} onChange={(event) => handleLanguageChange(event.target.value as PreferenceSettings["language"])}>
                      <NativeSelectOption value="zh">中文</NativeSelectOption>
                      <NativeSelectOption value="en">English</NativeSelectOption>
                    </NativeSelect>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <div className="text-sm font-medium">Workspace name</div>
                    <Input value={draft.workspaceName} onChange={(event) => setDraft({ ...draft, workspaceName: event.target.value })} placeholder="Workspace name" />
                  </div>
                </CardContent>
              </Card>
              <Card id="workspace">
                <CardHeader>
                  <CardTitle>Workspace</CardTitle>
                  <CardDescription>Basic path and behavior defaults for local workspace operations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Workspace path</div>
                    <Input value={draft.workspacePath} onChange={(event) => setDraft({ ...draft, workspacePath: event.target.value })} placeholder="C:/Users/.../workspace" />
                  </div>
                  <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span>Auto-save conversations</span>
                    <Switch checked={draft.autoSaveConversations} onCheckedChange={(checked) => setDraft({ ...draft, autoSaveConversations: checked })} />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span>Launch on startup</span>
                    <Switch checked={draft.autoStartEnabled} onCheckedChange={(checked) => setDraft({ ...draft, autoStartEnabled: checked })} />
                  </label>
                </CardContent>
              </Card>
              <Card id="models">
                <CardHeader>
                  <CardTitle>Models</CardTitle>
                  <CardDescription>Choose the default model provider for the desktop workspace.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Input value={draft.defaultModelProviderId} onChange={(event) => setDraft({ ...draft, defaultModelProviderId: event.target.value })} placeholder="Default model provider ID" />
                </CardContent>
              </Card>
              <Card id="chat">
                <CardHeader>
                  <CardTitle>Chat</CardTitle>
                  <CardDescription>Control runtime defaults shared by chat and workflow-assisted execution. Use 0 to disable timeout.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Input type="number" min="0" step="1000" value={String(draft.chatRequestTimeoutMs)} onChange={(event) => setDraft({ ...draft, chatRequestTimeoutMs: Math.max(0, Number(event.target.value) || 0) })} placeholder="0" />
                </CardContent>
              </Card>
              <Card id="notes">
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                  <CardDescription>Store operator notes alongside local workspace preferences.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={8} placeholder="Operator notes" />
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default PreferencePage