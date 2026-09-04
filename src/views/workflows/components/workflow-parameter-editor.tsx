import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { WorkflowField } from "@/views/workflows/components/workflow-field"

type WorkflowParameterEditorItem = {
  id: string
  name: string
  value: string
  namePlaceholder?: string
  valuePlaceholder?: string
  valueDisabled?: boolean
}

type WorkflowParameterEditorProps = {
  items: WorkflowParameterEditorItem[]
  nameLabel: string
  valueLabel: string
  onNameChange: (itemId: string, value: string) => void
  onValueChange: (itemId: string, value: string) => void
  onAdd?: () => void
  addLabel?: string
}

export function WorkflowParameterEditor({ items, nameLabel, valueLabel, onNameChange, onValueChange, onAdd, addLabel = "Add item" }: WorkflowParameterEditorProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="space-y-2 rounded-2xl border p-3">
          <WorkflowField label={nameLabel}>
            <Input value={item.name} onChange={(event) => onNameChange(item.id, event.target.value)} placeholder={item.namePlaceholder} />
          </WorkflowField>
          <WorkflowField label={valueLabel}>
            {item.valueDisabled
              ? <Input value={item.value} disabled />
              : <Textarea value={item.value} onChange={(event) => onValueChange(item.id, event.target.value)} placeholder={item.valuePlaceholder} />}
          </WorkflowField>
        </div>
      ))}
      {onAdd ? (
        <Button type="button" variant="outline" size="icon-xs" aria-label={addLabel} title={addLabel} onClick={onAdd}>
          <PlusIcon className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}