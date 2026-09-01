import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  return (
    <Card className="min-h-0 xl:h-[calc(100vh-12rem)]">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Model inventory</CardTitle>
            <CardDescription>Enable models, adjust metadata, and register custom entries.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={onAddModel}>Add model</Button>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 space-y-3 overflow-y-auto">
        {models.map((model, index) => (
          <div key={`${model.id}-${index}`} className="rounded-xl border p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>{model.contextWindow?.toLocaleString() ?? 0} context</span>
                  <span>{model.maxOutputTokens?.toLocaleString() ?? 0} max output</span>
                  <span>{model.supportsParallelToolCalls ? "parallel tools" : "single-tool flow"}</span>
                  <span>{model.supportsReasoning ? "reasoning" : "standard"}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <label className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                  <span>Enabled</span>
                  <Switch checked={model.enabled} disabled={!hasApiKey} onCheckedChange={(checked) => onToggleModel(index, checked)} />
                </label>
                <Button size="sm" variant="outline" onClick={() => onEditModel(index)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => onDeleteModel(index)}>Remove</Button>
              </div>
            </div>
          </div>
        ))}
        {models.length === 0 ? <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">No models registered for this provider yet.</div> : null}
      </CardContent>
    </Card>
  )
}