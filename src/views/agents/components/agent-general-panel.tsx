import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import type { AgentDetail, ProviderConfigRecord } from "@/data/domain/models"

type AgentGeneralPanelProps = {
  draft: AgentDetail
  isReadOnly?: boolean
  models: ProviderConfigRecord[]
  onChange: (next: AgentDetail) => void
  onSave: () => void
}

export function AgentGeneralPanel({ draft, isReadOnly = false, models, onChange, onSave }: AgentGeneralPanelProps) {
  const modelValue = draft.config.providerId && draft.config.modelId ? `${draft.config.providerId}::${draft.config.modelId}` : ""
  const groupedProviders = models.filter((provider) => provider.models.length > 0)

  return (
    <Card className="h-full min-h-0">
      <CardHeader className="border-b">
        <CardTitle>General</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Name</div>
          <Input disabled={isReadOnly} value={draft.agent.title} onChange={(event) => onChange({ ...draft, agent: { ...draft.agent, title: event.target.value } })} placeholder="Agent name" />
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Description</div>
          <Textarea disabled={isReadOnly} value={draft.agent.summary} onChange={(event) => onChange({ ...draft, agent: { ...draft.agent, summary: event.target.value } })} rows={4} placeholder="Describe what this agent is for." />
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Provider / Model</div>
          <NativeSelect disabled={isReadOnly} value={modelValue} onChange={(event) => {
            const [providerId, modelId] = event.target.value.split("::")
            onChange({
              ...draft,
              config: {
                ...draft.config,
                providerId,
                modelId,
              },
            })
          }}>
            <NativeSelectOption value="">Select model</NativeSelectOption>
            {groupedProviders.map((provider) => (
              <NativeSelectOptGroup key={provider.id} label={provider.title}>
                {provider.models.map((model) => <NativeSelectOption key={`${provider.id}-${model.id}`} value={`${provider.id}::${model.id}`}>{model.name}</NativeSelectOption>)}
              </NativeSelectOptGroup>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Default max steps</div>
          <Input disabled={isReadOnly} type="number" min="1" max="500" value={String(draft.config.maxSteps ?? 100)} onChange={(event) => onChange({ ...draft, config: { ...draft.config, maxSteps: Math.max(1, Math.min(500, Number(event.target.value) || 100)) } })} />
        </div>

        <div className="flex min-h-0 flex-1 flex-col space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Prompt</div>
          <Textarea disabled={isReadOnly} value={draft.config.instructions} onChange={(event) => onChange({ ...draft, config: { ...draft.config, instructions: event.target.value } })} className="min-h-0 flex-1 font-mono" placeholder="System prompt" />
        </div>

        <div className="mt-auto flex justify-end pt-1">
          <Button disabled={isReadOnly} onClick={onSave}>Save</Button>
        </div>
      </CardContent>
    </Card>
  )
}