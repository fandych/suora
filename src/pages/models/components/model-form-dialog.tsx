import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useAppIntl } from "@/lib/i18n"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { ProviderApiMode, ProviderModelCapability, ProviderModelRecord } from "@/types/agent"

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
  const { t } = useAppIntl()
  const capabilityOptions: Array<{ value: ProviderModelCapability; label: string }> = [
    { value: "toolcalling", label: t("models.modelForm.capability.toolcalling", "Tool calling") },
    { value: "vision", label: t("models.modelForm.capability.vision", "Vision") },
    { value: "embedding", label: t("models.modelForm.capability.embedding", "Embeddings") },
    { value: "structuredOutput", label: t("models.modelForm.capability.structuredOutput", "Structured output") },
  ]

  const apiModeOptions: Array<{ value: ProviderApiMode; label: string }> = [
    { value: "messages", label: t("models.modelForm.apiMode.messages", "messages") },
    { value: "responses", label: t("models.modelForm.apiMode.responses", "responses") },
    { value: "completions", label: t("models.modelForm.apiMode.completions", "completions") },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? t("models.modelForm.createTitle", "Create model") : t("models.modelForm.editTitle", "Edit model")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "models.modelForm.description",
              "Manage model metadata, capabilities, and enablement for this provider.",
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="model-id">{t("models.modelForm.id", "Model ID")}</Label>
              <Input
                id="model-id"
                value={form.id}
                onChange={(event) => onFormChange({ ...form, id: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model-name">{t("models.modelForm.name", "Display name")}</Label>
              <Input
                id="model-name"
                value={form.name}
                onChange={(event) => onFormChange({ ...form, name: event.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">{t("models.modelForm.capabilities", "Capabilities")}</div>
              <div className="grid gap-2">
                {capabilityOptions.map((option) => (
                  <label key={option.value} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                    <Checkbox
                      checked={form.capabilities.includes(option.value)}
                      onCheckedChange={() =>
                        onFormChange({ ...form, capabilities: toggleValue(form.capabilities, option.value) })
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">{t("models.modelForm.apiModes", "API modes")}</div>
              <div className="grid gap-2">
                {apiModeOptions.map((option) => (
                  <label key={option.value} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                    <Checkbox
                      checked={form.apiModes.includes(option.value)}
                      onCheckedChange={() =>
                        onFormChange({ ...form, apiModes: toggleValue(form.apiModes, option.value) })
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="context-window">{t("models.modelForm.contextWindow", "Context window")}</Label>
              <Input
                id="context-window"
                type="number"
                min="1"
                value={String(form.contextWindow)}
                onChange={(event) => onFormChange({ ...form, contextWindow: Math.max(1, Number(event.target.value) || 1) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-output">{t("models.modelForm.maxOutputTokens", "Max output tokens")}</Label>
              <Input
                id="max-output"
                type="number"
                min="1"
                value={String(form.maxOutputTokens)}
                onChange={(event) => onFormChange({ ...form, maxOutputTokens: Math.max(1, Number(event.target.value) || 1) })}
              />
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span>{t("models.modelForm.enabled", "Enabled")}</span>
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) => onFormChange({ ...form, enabled: checked })}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span>{t("models.modelForm.parallelTools", "Parallel tools")}</span>
              <Switch
                checked={form.supportsParallelToolCalls}
                onCheckedChange={(checked) => onFormChange({ ...form, supportsParallelToolCalls: checked })}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span>{t("models.modelForm.reasoning", "Reasoning")}</span>
              <Switch
                checked={form.supportsReasoning}
                onCheckedChange={(checked) => onFormChange({ ...form, supportsReasoning: checked })}
              />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("models.modelForm.cancel", "Cancel")}
            </Button>
            <Button type="submit">{t("models.modelForm.save", "Save model")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
