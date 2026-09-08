import { BadgeCheckIcon, BrainCircuitIcon, ExternalLinkIcon, GitBranchPlusIcon, SparklesIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import type { ProviderConfigRecord } from "@/data/domain/models"
import { providerPresets } from "@/data/repositories/model-provider-presets"
import { ProviderLogoBadge } from "@/views/models/components/provider-logo-badge"

type ProviderSettingsFormProps = {
  draft: ProviderConfigRecord
  description: string
  docsUrl?: string
  canConfigureModels: boolean
  canDelete: boolean
  onChange: (nextProvider: ProviderConfigRecord) => void
  onDelete: () => void
  onOpenDocs?: (url: string) => void
  onProviderTypeChange: (providerType: string) => void
  onSave: () => void
}

export function ProviderSettingsForm({ draft, description, docsUrl, canConfigureModels, canDelete, onChange, onDelete, onOpenDocs, onProviderTypeChange, onSave }: ProviderSettingsFormProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const enabledModels = draft.models.filter((model) => model.enabled).length
  const supportsReasoning = draft.models.some((model) => model.supportsReasoning)
  const supportsParallelTools = draft.models.some((model) => model.supportsParallelToolCalls)
  const supportsStructuredOutput = draft.models.some((model) => model.capabilities?.includes("structuredOutput"))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <ProviderLogoBadge providerType={draft.providerType} className="size-12" iconClassName="size-6" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <CardTitle className="break-words">{draft.title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
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

        {!canConfigureModels ? <div className="rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-sm text-amber-900">Provider and model toggles remain disabled until an API key is configured.</div> : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 text-foreground"><BadgeCheckIcon className="size-4" />Enabled models</div>
            <div className="mt-1 text-sm font-medium text-foreground">{enabledModels} / {draft.models.length}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 text-foreground"><BrainCircuitIcon className="size-4" />Default endpoint</div>
            <div className="mt-1 break-all text-sm font-medium text-foreground">{draft.baseUrl || "Not configured"}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {supportsParallelTools ? <div className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs text-muted-foreground"><GitBranchPlusIcon className="size-3.5" />parallel tools</div> : null}
          {supportsReasoning ? <div className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs text-muted-foreground"><SparklesIcon className="size-3.5" />reasoning models</div> : null}
          {supportsStructuredOutput ? <div className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs text-muted-foreground"><BadgeCheckIcon className="size-3.5" />structured output</div> : null}
        </div>

        <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
          <span>Provider enabled</span>
          <Switch checked={draft.enabled} disabled={!canConfigureModels} onCheckedChange={(checked) => onChange({ ...draft, enabled: checked })} />
        </label>

        {docsUrl ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">Official docs</div>
              <div className="truncate text-xs text-muted-foreground">{docsUrl}</div>
            </div>
            <Button type="button" size="icon-sm" variant="outline" aria-label="Open provider docs" title="Open provider docs" onClick={() => onOpenDocs?.(docsUrl)}>
              <ExternalLinkIcon className="size-4" />
            </Button>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t pt-3">
          {canDelete ? (
            <Popover open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
              <PopoverTrigger render={<Button type="button" size="icon-sm" variant="destructive" aria-label="Delete provider" title="Delete provider" />}>
                <Trash2Icon className="size-4" />
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
          ) : <span />}
          <Button type="button" onClick={onSave}>Save provider</Button>
        </div>
      </CardContent>
    </Card>
  )
}