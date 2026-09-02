import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import type { ProviderConfigRecord } from "@/data/domain/models"

type ProviderModelListProps = {
  hasApiKey: boolean
  models: ProviderConfigRecord["models"]
  onAddModel: () => void
  onDeleteModel: (index: number) => void
  onEditModel: (index: number) => void
  onToggleModel: (index: number, enabled: boolean) => void
}

export function ProviderModelList({ hasApiKey, models, onAddModel, onDeleteModel, onEditModel, onToggleModel }: ProviderModelListProps) {
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)

  return (
    <Card className="min-h-0 overflow-hidden xl:h-[calc(100vh-10.5rem)]">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Model inventory</CardTitle>
            <CardDescription>Enable models, adjust metadata, and register custom entries.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={onAddModel}>Add model</Button>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 space-y-2.5 overflow-x-hidden overflow-y-auto">
        {models.map((model, index) => (
          <div key={`${model.id}-${index}`} className="rounded-xl border p-3">
            <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_10rem]">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1 break-all text-base font-medium text-foreground">{model.name}</div>
                  <Badge variant="outline" className="max-w-full whitespace-normal break-all">{model.id}</Badge>
                  <Badge variant={model.enabled ? "secondary" : "outline"}>{model.enabled ? "Enabled" : "Disabled"}</Badge>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {(model.capabilities ?? []).map((capability) => <Badge key={capability} variant="outline">{capability}</Badge>)}
                  {(model.apiModes ?? []).map((mode) => <Badge key={mode} variant="secondary">{mode}</Badge>)}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>{model.contextWindow?.toLocaleString() ?? 0} context</span>
                  <span>{model.maxOutputTokens?.toLocaleString() ?? 0} max output</span>
                  <span>{model.supportsParallelToolCalls ? "parallel tools" : "single-tool flow"}</span>
                  <span>{model.supportsReasoning ? "reasoning" : "standard"}</span>
                </div>
              </div>
              <div className="flex min-w-0 flex-col items-stretch gap-2 xl:items-end">
                <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm xl:w-40">
                  <span>Enabled</span>
                  <Switch checked={model.enabled} disabled={!hasApiKey} onCheckedChange={(checked) => onToggleModel(index, checked)} />
                </label>
                <Button size="sm" variant="outline" className="xl:w-40" onClick={() => onEditModel(index)}>Edit</Button>
                <Popover open={deleteIndex === index} onOpenChange={(open) => setDeleteIndex(open ? index : null)}>
                  <PopoverTrigger render={<Button size="sm" variant="destructive" className="xl:w-40" />}>
                    Remove
                  </PopoverTrigger>
                  <PopoverContent align="end">
                    <PopoverHeader>
                      <PopoverTitle>Delete model?</PopoverTitle>
                      <PopoverDescription>This change is saved immediately.</PopoverDescription>
                    </PopoverHeader>
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setDeleteIndex(null)}>Cancel</Button>
                      <Button size="sm" variant="destructive" onClick={() => { setDeleteIndex(null); onDeleteModel(index) }}>Delete</Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        ))}
        {models.length === 0 ? <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">No models registered for this provider yet.</div> : null}
      </CardContent>
    </Card>
  )
}