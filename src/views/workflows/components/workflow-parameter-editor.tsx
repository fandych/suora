import { CheckIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

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

export function WorkflowKeyValueEditor({ label, value, onChange, placeholder = "key: value" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const entries = (() => {
    try {
      const parsed = JSON.parse(value) as unknown
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? Object.entries(parsed).map(([key, item]) => ({ key, value: String(item) })) : []
    } catch {
      return []
    }
  })()

  const writeEntries = (nextEntries: Array<{ key: string; value: string }>) => {
    onChange(JSON.stringify(Object.fromEntries(nextEntries.filter((entry) => entry.key.trim()).map((entry) => [entry.key.trim(), entry.value])), null, 2))
  }

  return (
    <WorkflowField label={label} hint="Values support workflow interpolation such as {{input.requestId}}.">
      <div className="flex flex-col gap-2">
        {entries.map((entry, index) => <div key={`${entry.key}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2"><Input value={entry.key} placeholder="Name" onChange={(event) => writeEntries(entries.map((item, itemIndex) => itemIndex === index ? { ...item, key: event.target.value } : item))} /><Input value={entry.value} placeholder="Value" onChange={(event) => writeEntries(entries.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} /><Button type="button" size="icon-xs" variant="ghost" onClick={() => writeEntries(entries.filter((_item, itemIndex) => itemIndex !== index))} aria-label={`Remove ${entry.key || "entry"}`}>×</Button></div>)}
        <Button type="button" size="sm" variant="outline" onClick={() => writeEntries([...entries, { key: "", value: "" }])}><PlusIcon /> Add entry</Button>
        {entries.length === 0 ? <p className="text-[11px] text-muted-foreground">{placeholder}</p> : null}
      </div>
    </WorkflowField>
  )
}

export function WorkflowParameterEditor({ items, nameLabel, valueLabel, onNameChange, onValueChange, onAdd, addLabel = "Add item" }: WorkflowParameterEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const previousItemIds = useRef(new Set<string>())
  const [drafts, setDrafts] = useState<Record<string, WorkflowParameterEditorItem>>({})

  const startEditing = (item: WorkflowParameterEditorItem) => {
    setEditingId(item.id)
    setDrafts((current) => ({ ...current, [item.id]: { ...item } }))
  }

  const cancelEditing = (item: WorkflowParameterEditorItem) => {
    const draft = drafts[item.id]
    if (draft && draft.name !== item.name) onNameChange(item.id, item.name)
    setEditingId(null)
  }

  useEffect(() => {
    const newlyAddedItem = items.find((item) => !previousItemIds.current.has(item.id))
    if (newlyAddedItem && previousItemIds.current.size > 0) setEditingId(newlyAddedItem.id)
    for (const item of items) previousItemIds.current.add(item.id)
  }, [items])

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border p-2.5">
          {editingId === item.id ? <div className="flex flex-col gap-2">
            <WorkflowField label={nameLabel}><Input value={item.name} onChange={(event) => onNameChange(item.id, event.target.value)} placeholder={item.namePlaceholder} /></WorkflowField>
            <WorkflowField label={valueLabel}>{item.valueDisabled ? <Input value={item.value} disabled /> : <Textarea value={item.value} onChange={(event) => onValueChange(item.id, event.target.value)} placeholder={item.valuePlaceholder} />}</WorkflowField>
            <div className="flex justify-end gap-1"><Button type="button" size="icon-xs" variant="ghost" onClick={() => cancelEditing(item)} aria-label="Cancel editing"><XIcon /></Button><Button type="button" size="icon-xs" variant="outline" onClick={() => setEditingId(null)} aria-label="Save parameter"><CheckIcon /></Button></div>
          </div> : <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.name || item.namePlaceholder || "Unnamed parameter"}</p><p className="truncate text-xs text-muted-foreground">{item.value || item.valuePlaceholder || "No value"}</p></div><Button type="button" size="icon-xs" variant="ghost" onClick={() => startEditing(item)} aria-label={`Edit ${item.name || "parameter"}`}><PencilIcon /></Button></div>}
        </div>
      ))}
      {onAdd ? (
        <Button type="button" variant="outline" size="sm" aria-label={addLabel} title={addLabel} onClick={onAdd}><PlusIcon />{addLabel}</Button>
      ) : null}
    </div>
  )
}