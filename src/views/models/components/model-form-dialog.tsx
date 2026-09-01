import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { ProviderApiMode, ProviderModelCapability, ProviderModelRecord } from "@/data/domain/models"

export type ModelFormState = {
  id: string
  name: string
  capabilities: ProviderModelCapability[]
  apiModes: ProviderApiMode[]
  enabled: boolean
  contextWindow: number
  maxOutputTokens: number
  supportsParallelToolCalls: boolean
  supportsReasoning: boolean
}

const capabilityOptions: Array<{ value: ProviderModelCapability; label: string }> = [
  { value: "toolcalling", label: "Tool calling" },
  { value: "vision", label: "Vision" },
  { value: "embedding", label: "Embeddings" },
  { value: "structuredOutput", label: "Structured output" },
]

const apiModeOptions: Array<{ value: ProviderApiMode; label: string }> = [
  { value: "messages", label: "messages" },
  { value: "responses", label: "responses" },
  { value: "completions", label: "completions" },
]

export function createModelFormState(model?: ProviderModelRecord): ModelFormState {
  return {
    id: model?.id ?? "",
    name: model?.name ?? "",
    capabilities: model?.capabilities ?? ["toolcalling"],
    apiModes: model?.apiModes ?? ["messages"],
    enabled: model?.enabled ?? false,
    contextWindow: model?.contextWindow ?? 128000,
    maxOutputTokens: model?.maxOutputTokens ?? 8192,
    supportsParallelToolCalls: model?.supportsParallelToolCalls ?? false,
    supportsReasoning: model?.supportsReasoning ?? false,
  }
}

function toggleValue<T extends string>(items: T[], value: T) {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value]
}

type ModelFormDialogProps = {
  form: ModelFormState
  mode: "create" | "edit"
  open: boolean
  onFormChange: (form: ModelFormState) => void
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
}

export function ModelFormDialog({ form, mode, open, onFormChange, onOpenChange, onSubmit }: ModelFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add model" : "Edit model"}</DialogTitle>
          <DialogDescription>Manage model metadata, capabilities, and enablement for this provider.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit() }}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="model-id">Model ID</Label>
              <Input id="model-id" value={form.id} onChange={(event) => onFormChange({ ...form, id: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model-name">Display name</Label>
              <Input id="model-name" value={form.name} onChange={(event) => onFormChange({ ...form, name: event.target.value })} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">Capabilities</div>
              <div className="grid gap-2">
                {capabilityOptions.map((option) => (
                  <label key={option.value} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                    <Checkbox checked={form.capabilities.includes(option.value)} onCheckedChange={() => onFormChange({ ...form, capabilities: toggleValue(form.capabilities, option.value) })} />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">API modes</div>
              <div className="grid gap-2">
                {apiModeOptions.map((option) => (
                  <label key={option.value} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                    <Checkbox checked={form.apiModes.includes(option.value)} onCheckedChange={() => onFormChange({ ...form, apiModes: toggleValue(form.apiModes, option.value) })} />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="context-window">Context window</Label>
              <Input id="context-window" type="number" value={String(form.contextWindow)} onChange={(event) => onFormChange({ ...form, contextWindow: Number(event.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-output">Max output tokens</Label>
              <Input id="max-output" type="number" value={String(form.maxOutputTokens)} onChange={(event) => onFormChange({ ...form, maxOutputTokens: Number(event.target.value) || 0 })} />
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span>Enabled</span>
              <Switch checked={form.enabled} onCheckedChange={(checked) => onFormChange({ ...form, enabled: checked })} />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span>Parallel tools</span>
              <Switch checked={form.supportsParallelToolCalls} onCheckedChange={(checked) => onFormChange({ ...form, supportsParallelToolCalls: checked })} />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span>Reasoning</span>
              <Switch checked={form.supportsReasoning} onCheckedChange={(checked) => onFormChange({ ...form, supportsReasoning: checked })} />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{mode === "create" ? "Add model" : "Save model"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}