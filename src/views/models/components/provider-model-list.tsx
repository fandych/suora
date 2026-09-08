import { PlusIcon, PencilIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import type { ProviderConfigRecord } from "@/data/domain/models"

type ModelStatusFilter = "all" | "enabled" | "disabled"

type ProviderModelListProps = {
  canConfigureModels: boolean
  showRefreshAction?: boolean
  refreshDisabledReason?: string | null
  isRefreshingModels?: boolean
  models: ProviderConfigRecord["models"]
  onAddModel: () => void
  onDeleteModel: (index: number) => void
  onEditModel: (index: number) => void
  onRefreshModels: () => void
  onToggleModel: (index: number, enabled: boolean) => void
}

export function ProviderModelList({ canConfigureModels, showRefreshAction = false, refreshDisabledReason = null, isRefreshingModels = false, models, onAddModel, onDeleteModel, onEditModel, onRefreshModels, onToggleModel }: ProviderModelListProps) {
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<ModelStatusFilter>("all")
  const refreshDisabled = Boolean(refreshDisabledReason) || isRefreshingModels
  const normalizedQuery = query.trim().toLowerCase()
  const visibleModels = useMemo(() => models
    .map((model, index) => ({ model, index }))
    .filter(({ model }) => {
      if (statusFilter === "enabled" && !model.enabled) {
        return false
      }

      if (statusFilter === "disabled" && model.enabled) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      const haystack = [
        model.name,
        model.id,
        ...(model.capabilities ?? []),
        ...(model.apiModes ?? []),
      ].join(" ").toLowerCase()

      return haystack.includes(normalizedQuery)
    })
    .sort((left, right) => {
      const byName = right.model.name.localeCompare(left.model.name, undefined, { sensitivity: "base" })
      if (byName !== 0) {
        return byName
      }

      return right.model.id.localeCompare(left.model.id, undefined, { sensitivity: "base" })
    }), [models, normalizedQuery, statusFilter])

  return (
    <Card className="min-h-0 overflow-hidden xl:h-[calc(100vh-10.5rem)]">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Model inventory</CardTitle>
          <div className="flex items-center gap-2">
            {showRefreshAction ? (
              <Button size="icon-sm" variant="outline" onClick={onRefreshModels} disabled={refreshDisabled} title={refreshDisabledReason ?? "Refresh models"} aria-label="Refresh models">
                <RefreshCwIcon className={`size-4 ${isRefreshingModels ? "animate-spin" : ""}`} />
              </Button>
            ) : null}
            <Button size="icon-sm" variant="outline" onClick={onAddModel} aria-label="Add model" title="Add model">
              <PlusIcon className="size-4" />
            </Button>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_10rem]">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search models..." />
          <NativeSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ModelStatusFilter)}>
            <NativeSelectOption value="all">All</NativeSelectOption>
            <NativeSelectOption value="enabled">Enabled</NativeSelectOption>
            <NativeSelectOption value="disabled">Disabled</NativeSelectOption>
          </NativeSelect>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 space-y-2.5 overflow-x-hidden overflow-y-auto">
        {visibleModels.map(({ model, index }) => {
          return (
          <div key={`${model.id}-${index}`} className="rounded-xl border p-3">
            <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1 break-all text-base font-medium text-foreground">{model.name}</div>
                  <Badge variant="outline" className="max-w-full whitespace-normal break-all">{model.id}</Badge>
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
                <div className="flex items-center justify-end gap-2 pt-1">
                  <div className="flex h-7 items-center justify-center rounded-lg border px-2">
                    <Switch checked={model.enabled} disabled={!canConfigureModels} onCheckedChange={(checked) => onToggleModel(index, checked)} />
                  </div>
                  <Button size="icon-sm" variant="outline" aria-label={`Edit ${model.name}`} title="Edit model" onClick={() => onEditModel(index)}>
                    <PencilIcon className="size-4" />
                  </Button>
                  <Popover open={deleteIndex === index} onOpenChange={(open) => setDeleteIndex(open ? index : null)}>
                    <PopoverTrigger render={<Button size="icon-sm" variant="destructive" aria-label={`Delete ${model.name}`} title="Delete model" />}>
                      <Trash2Icon className="size-4" />
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
          )
        })}
        {models.length === 0 ? <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">No models registered for this provider yet.</div> : null}
        {models.length > 0 && visibleModels.length === 0 ? <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">No models match the current search.</div> : null}
      </CardContent>
    </Card>
  )
}