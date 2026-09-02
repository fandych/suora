import type { AgentDetail, IntegrationSummary, ProviderConfigRecord, SkillSummary, DocumentSummary } from "@/data/domain/models"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"

type AgentBindingsFormProps = {
  documents: DocumentSummary[]
  draft: AgentDetail
  isReadOnly?: boolean
  integrations: IntegrationSummary[]
  models: ProviderConfigRecord[]
  onChange: (next: AgentDetail) => void
  skills: SkillSummary[]
}

type SelectableItem = {
  id: string
  title: string
  description?: string
}

function toggleId(items: string[], nextId: string, checked: boolean) {
  if (checked) {
    return items.includes(nextId) ? items : [...items, nextId]
  }

  return items.filter((item) => item !== nextId)
}

function BindingChecklist({
  description,
  disabled = false,
  items,
  selectedIds,
  title,
  onToggle,
}: {
  description: string
  disabled?: boolean
  items: SelectableItem[]
  selectedIds: string[]
  title: string
  onToggle: (itemId: string, checked: boolean) => void
}) {
  return (
    <div className="rounded-xl border bg-muted/20">
      <div className="border-b px-4 py-3">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto p-3">
        {items.length === 0 ? <div className="text-sm text-muted-foreground">No items available.</div> : null}
        {items.map((item) => {
          const checked = selectedIds.includes(item.id)
          return (
            <label key={item.id} className={`flex items-start gap-3 rounded-lg border bg-background px-3 py-2 transition-colors ${disabled ? "opacity-70" : "cursor-pointer hover:border-primary/30 hover:bg-muted/30"}`}>
              <Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => onToggle(item.id, value === true)} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{item.title}</div>
                <div className="truncate text-xs text-muted-foreground">{item.description || item.id}</div>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}

export function AgentBindingsForm({ documents, draft, integrations, isReadOnly = false, models, onChange, skills }: AgentBindingsFormProps) {
  const selectedProvider = models.find((provider) => provider.id === draft.config.providerId) ?? null
  const providerModels = selectedProvider?.models ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent config</CardTitle>
        <CardDescription>Bind a default provider/model plus the supporting skills, integrations, and documents.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Input disabled={isReadOnly} value={draft.agent.title} onChange={(event) => onChange({ ...draft, agent: { ...draft.agent, title: event.target.value } })} placeholder="Agent title" />
          <NativeSelect disabled={isReadOnly} value={draft.agent.kind} onChange={(event) => onChange({ ...draft, agent: { ...draft.agent, kind: event.target.value } })}>
            <NativeSelectOption value="builtin">Builtin</NativeSelectOption>
            <NativeSelectOption value="custom">Custom</NativeSelectOption>
          </NativeSelect>
        </div>
        <Input disabled={isReadOnly} value={draft.agent.summary} onChange={(event) => onChange({ ...draft, agent: { ...draft.agent, summary: event.target.value } })} placeholder="Agent summary" />
        <Textarea disabled={isReadOnly} value={draft.config.instructions} onChange={(event) => onChange({ ...draft, config: { ...draft.config, instructions: event.target.value } })} rows={8} className="font-mono" />
        <div className="grid gap-4 md:grid-cols-2">
          <NativeSelect disabled={isReadOnly} value={draft.config.providerId} onChange={(event) => onChange({ ...draft, config: { ...draft.config, providerId: event.target.value, modelId: "" } })}>
            <NativeSelectOption value="">Select provider</NativeSelectOption>
            {models.map((provider) => (
              <NativeSelectOption key={provider.id} value={provider.id}>{provider.title}</NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect disabled={isReadOnly} value={draft.config.modelId} onChange={(event) => onChange({ ...draft, config: { ...draft.config, modelId: event.target.value } })}>
            <NativeSelectOption value="">Select model</NativeSelectOption>
            {providerModels.map((model) => (
              <NativeSelectOption key={model.id} value={model.id}>{model.name}</NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <BindingChecklist
            title="Skills"
            description="Attach reusable prompt packages."
            disabled={isReadOnly}
            items={skills.map((skill) => ({ id: skill.id, title: skill.title, description: skill.summary }))}
            selectedIds={draft.config.skillIds}
            onToggle={(itemId, checked) => onChange({ ...draft, config: { ...draft.config, skillIds: toggleId(draft.config.skillIds, itemId, checked) } })}
          />
          <BindingChecklist
            title="Integrations"
            description="Attach tool and runtime integrations."
            disabled={isReadOnly}
            items={integrations.map((integration) => ({ id: integration.id, title: integration.title, description: integration.endpoint || integration.kind }))}
            selectedIds={draft.config.toolsetIds}
            onToggle={(itemId, checked) => onChange({ ...draft, config: { ...draft.config, toolsetIds: toggleId(draft.config.toolsetIds, itemId, checked) } })}
          />
          <BindingChecklist
            title="Documents"
            description="Attach knowledge documents and working notes."
            disabled={isReadOnly}
            items={documents.map((document) => ({ id: document.id, title: document.title, description: document.summary }))}
            selectedIds={draft.config.documentIds ?? []}
            onToggle={(itemId, checked) => onChange({ ...draft, config: { ...draft.config, documentIds: toggleId(draft.config.documentIds ?? [], itemId, checked) } })}
          />
        </div>
      </CardContent>
    </Card>
  )
}
