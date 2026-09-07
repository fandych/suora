import { useMemo, useRef, useState } from "react"
import { CheckCircle2Icon, CircleHelpIcon, PencilIcon, PlusIcon, Trash2Icon, XCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { WorkflowField } from "@/views/workflows/components/workflow-field"
import { WorkflowExpressionInput } from "@/views/workflows/components/workflow-expression-input"
import type { WorkflowExpressionSuggestion } from "@/views/workflows/components/workflow-expression-suggestions"
import { getNestedSchemaFragment, mergeNestedSchemaFragment, readWorkflowSchemaParameters, type WorkflowSchemaParameter, writeWorkflowSchemaParameters } from "@/views/workflows/components/workflow-schema-contract"

type WorkflowStartInputEditorProps = {
  value?: string
  onChange: (value: string) => void
  title?: string
  variableSupport?: boolean
  suggestions?: WorkflowExpressionSuggestion[]
}

type InputParameterDraft = Omit<WorkflowSchemaParameter, "id">

const EMPTY_DRAFT: InputParameterDraft = { name: "", description: "", type: "string", defaultValue: "", required: false, schema: {} }

export function WorkflowStartInputEditor({ value, onChange, title = "Parameters", variableSupport = false, suggestions = [] }: WorkflowStartInputEditorProps) {
  const parameters = useMemo(() => readWorkflowSchemaParameters(value), [value])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<InputParameterDraft>(EMPTY_DRAFT)
  const [nestedContractDraft, setNestedContractDraft] = useState("")
  const [nestedContractError, setNestedContractError] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const hoverTimer = useRef<number | null>(null)

  const startAdd = () => {
    setEditingId("new")
    setDraft(EMPTY_DRAFT)
    setNestedContractDraft("")
    setNestedContractError(null)
  }

  const startEdit = (parameter: WorkflowSchemaParameter) => {
    setEditingId(parameter.id)
    setDraft({ name: parameter.name, description: parameter.description, type: parameter.type, defaultValue: parameter.defaultValue, required: parameter.required, schema: parameter.schema })
    setNestedContractDraft(getNestedSchemaFragment(parameter.schema))
    setNestedContractError(null)
  }

  const save = () => {
    const name = draft.name.trim()
    if (!name) return
    const nextParameter = { ...draft, name }
    const next = editingId === "new"
      ? [...parameters, { ...nextParameter, id: `${name}-${crypto.randomUUID()}` }]
      : parameters.map((parameter) => parameter.id === editingId ? { ...nextParameter, id: parameter.id } : parameter)
    onChange(writeWorkflowSchemaParameters(value, next))
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
    setNestedContractDraft("")
    setNestedContractError(null)
  }

  const remove = (id: string) => onChange(writeWorkflowSchemaParameters(value, parameters.filter((parameter) => parameter.id !== id)))

  const startDetailHover = (id: string) => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => setDetailId(id), 2000)
  }

  const endDetailHover = () => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
    setDetailId(null)
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
          {title}
          <Popover>
            <PopoverTrigger aria-label="About Parameters" className="text-muted-foreground hover:text-foreground"><CircleHelpIcon className="size-3.5" /></PopoverTrigger>
            <PopoverContent align="start" className="w-72"><PopoverTitle>{title}</PopoverTitle><PopoverDescription>{variableSupport ? "Use {{current.field}} for this node's raw result or ${steps.node-id.field} for an earlier node. Mapped fields join this node's result." : "Define the fields accepted by this workflow node."}</PopoverDescription></PopoverContent>
          </Popover>
        </div>
        {!editingId ? <Button type="button" size="icon-xs" variant="ghost" onClick={startAdd} aria-label="Add parameter" title="Add parameter"><PlusIcon /></Button> : null}
      </div>
      {editingId ? (
        <div className="flex flex-col gap-2 rounded-xl bg-muted/20 p-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <WorkflowField label="Name" hint="The input field name used by the workflow."><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="customerId" /></WorkflowField>
            <WorkflowField label="Type" hint="The value type accepted by this field."><NativeSelect value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as InputParameterDraft["type"] })}><NativeSelectOption value="string">String</NativeSelectOption><NativeSelectOption value="number">Number</NativeSelectOption><NativeSelectOption value="boolean">Boolean</NativeSelectOption><NativeSelectOption value="object">Object</NativeSelectOption><NativeSelectOption value="array">Array</NativeSelectOption></NativeSelect></WorkflowField>
          </div>
          <WorkflowField label="Description" hint="Explain what this field represents."><Textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Describe this input" rows={2} /></WorkflowField>
          <WorkflowField label={variableSupport ? "Value" : "Default Value"} hint={variableSupport ? "Type ${ to choose current results, input fields, prior steps, or variables." : "Value used when no input is provided."}>{variableSupport ? <WorkflowExpressionInput value={draft.defaultValue} onChange={(defaultValue) => setDraft({ ...draft, defaultValue })} placeholder="${current.field}" suggestions={suggestions} /> : <Input value={draft.defaultValue} onChange={(event) => setDraft({ ...draft, defaultValue: event.target.value })} placeholder="Optional default value" />}</WorkflowField>
          {draft.type === "object" || draft.type === "array" ? <WorkflowField label="Nested contract" hint="Optional JSON Schema properties or items. This is preserved when editing the field." error={nestedContractError}><Textarea aria-invalid={Boolean(nestedContractError)} value={nestedContractDraft} onChange={(event) => { const result = mergeNestedSchemaFragment(draft.schema, event.target.value); setNestedContractDraft(event.target.value); setNestedContractError(result.error); if (!result.error) setDraft({ ...draft, schema: result.schema }) }} placeholder={draft.type === "object" ? '{\n  "properties": { "id": { "type": "string" } }\n}' : '{\n  "items": { "type": "string" }\n}'} rows={4} /></WorkflowField> : null}
          <WorkflowField label="Required" hint="Whether this field must be provided."><label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground"><input type="checkbox" checked={draft.required} onChange={(event) => setDraft({ ...draft, required: event.target.checked })} />Required</label></WorkflowField>
          <div className="flex justify-end gap-1"><Button className="text-destructive hover:text-destructive" type="button" size="icon-sm" variant="ghost" onClick={() => setEditingId(null)} aria-label="Cancel parameter" title="Cancel"><XCircleIcon /></Button><Button className="text-emerald-600 hover:text-emerald-600" type="button" size="icon-sm" variant="ghost" onClick={save} disabled={!draft.name.trim()} aria-label="Save parameter" title="Save"><CheckCircle2Icon /></Button></div>
        </div>
      ) : null}

      <div className="flex min-w-0 w-full max-w-full flex-col gap-2 overflow-hidden">
        {parameters.map((parameter) => (
          <div key={parameter.id} className="block min-w-0 w-full max-w-full overflow-hidden">
            <Popover open={detailId === parameter.id} onOpenChange={(open) => { if (!open) setDetailId(null) }}>
            <div className="min-w-0 w-full max-w-full overflow-hidden">
              <PopoverTrigger className="block w-full min-w-0 max-w-full overflow-hidden text-left" render={<div />}>
                <div className="grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-1 overflow-hidden rounded-lg border px-2.5 py-2 text-xs" onMouseEnter={() => startDetailHover(parameter.id)} onMouseLeave={endDetailHover}>
                  <div className="min-w-0 overflow-hidden [overflow-wrap:anywhere]">
                  <div className="flex min-w-0 max-w-full items-center gap-2 overflow-hidden font-medium"><span className="min-w-0 truncate">{parameter.name}</span><span className="shrink-0 text-muted-foreground">{parameter.type}{parameter.required ? " · required" : ""}</span></div>
                  <p className="truncate text-muted-foreground" title={parameter.description || "No description"}>{parameter.description || "No description"}{parameter.defaultValue ? ` · default: ${parameter.defaultValue}` : ""}</p>
                  </div>
                  <div className="flex shrink-0 gap-1"><Button type="button" size="icon-xs" variant="ghost" onClick={(event) => { event.stopPropagation(); startEdit(parameter) }} aria-label={`Edit ${parameter.name}`} title="Edit"><PencilIcon /></Button><Button type="button" size="icon-xs" variant="ghost" onClick={(event) => { event.stopPropagation(); remove(parameter.id) }} aria-label={`Delete ${parameter.name}`} title="Delete"><Trash2Icon /></Button></div>
                </div>
              </PopoverTrigger>
            </div>
            <PopoverContent align="start" className="w-72" onMouseEnter={() => { if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current) }} onMouseLeave={endDetailHover}>
              <PopoverTitle>{parameter.name}</PopoverTitle>
              <PopoverDescription>{parameter.description || "No description"}</PopoverDescription>
              <div className="flex flex-col gap-1 text-xs text-muted-foreground"><span>Type: {parameter.type}</span><span>Required: {parameter.required ? "Yes" : "No"}</span>{parameter.defaultValue ? <span>{variableSupport ? "Value" : "Default Value"}: {parameter.defaultValue}</span> : null}</div>
            </PopoverContent>
            </Popover>
          </div>
        ))}
        {parameters.length === 0 ? <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">No parameters yet. Add the inputs accepted by this workflow.</p> : null}
      </div>
    </div>
  )
}
