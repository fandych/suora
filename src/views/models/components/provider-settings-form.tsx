import { useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import type { ProviderConfigRecord } from "@/data/domain/models"
import { providerPresets } from "@/data/repositories/model-config-repository"

type ProviderSettingsFormProps = {
  draft: ProviderConfigRecord
  description: string
  hasApiKey: boolean
  canDelete: boolean
  onChange: (nextProvider: ProviderConfigRecord) => void
  onDelete: () => void
  onProviderTypeChange: (providerType: string) => void
  onSave: () => void
}

export function ProviderSettingsForm({ draft, description, hasApiKey, canDelete, onChange, onDelete, onProviderTypeChange, onSave }: ProviderSettingsFormProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider settings</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Title</div>
            <Input value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} placeholder="Provider title" />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Provider type</div>
            <NativeSelect value={draft.providerType} onChange={(event) => onProviderTypeChange(event.target.value)}>
              {providerPresets.map((preset) => (
                <NativeSelectOption key={preset.providerType} value={preset.providerType}>{preset.title}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Base URL</div>
          <Input value={draft.baseUrl} onChange={(event) => onChange({ ...draft, baseUrl: event.target.value })} placeholder="https://api.example.com/v1" />
        </div>

        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">API key</div>
          <Input type="password" value={draft.apiKey} onChange={(event) => onChange({ ...draft, apiKey: event.target.value })} placeholder="API key" />
        </div>

        {!hasApiKey ? <div className="rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-sm text-amber-900">Provider and model toggles remain disabled until an API key is configured.</div> : null}

        <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
          <span>Provider enabled</span>
          <Switch checked={draft.enabled} disabled={!hasApiKey} onCheckedChange={(checked) => onChange({ ...draft, enabled: checked })} />
        </label>

        <div className="flex items-center justify-end gap-2 border-t pt-3">
          {canDelete ? (
            <Popover open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
              <PopoverTrigger render={<Button type="button" variant="destructive" />}>
                Delete provider
              </PopoverTrigger>
              <PopoverContent align="end">
                <PopoverHeader>
                  <PopoverTitle>Delete provider?</PopoverTitle>
                  <PopoverDescription>This removes the provider and its model inventory from the workspace.</PopoverDescription>
                </PopoverHeader>
                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                  <Button type="button" variant="destructive" onClick={() => { setIsDeleteOpen(false); onDelete() }}>Delete</Button>
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
          <Button type="button" onClick={onSave}>Save provider</Button>
        </div>
      </CardContent>
    </Card>
  )
}