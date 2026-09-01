import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { getPreferenceSettings, savePreferenceSettings } from "@/data/repositories/preference-repository"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"

const PreferencePage = () => {
  const { data, error, isLoading, reload, setData } = useAsyncResource(() => getPreferenceSettings(), [])
  const [draft, setDraft] = useState({ workspaceName: "", defaultModelProviderId: "", notes: "" })

  useEffect(() => {
    if (data) {
      setDraft(data)
    }
  }, [data])

  const handleSave = async () => {
    const next = await savePreferenceSettings(draft)
    setData(next)
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
                  <CardDescription>Edit workspace identity settings.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Input value={draft.workspaceName} onChange={(event) => setDraft({ ...draft, workspaceName: event.target.value })} placeholder="Workspace name" />
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