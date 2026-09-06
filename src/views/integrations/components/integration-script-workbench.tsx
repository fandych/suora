import { useEffect, useState } from "react"
import { PencilIcon, PlayIcon, PlusIcon, Trash2Icon } from "lucide-react"
import MonacoEditor from "@monaco-editor/react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { IntegrationConfig, ScriptIntegrationConfig, ScriptWorkbenchItem } from "@/data/domain/models"

type IntegrationScriptWorkbenchProps = {
  config: ScriptIntegrationConfig
  canTryRun?: boolean
  onChange: (config: IntegrationConfig) => void
  onTryRun?: (scriptId: string) => void
}

type SchemaField = { key: string; type: string; description: string }

function createScript(index: number): ScriptWorkbenchItem {
  return {
    id: `script-${index}`,
    name: `Script ${index}`,
    handler: `script${index}`,
    code: "export async function handler(input) {\n  return { ok: true, input }\n}\n",
  }
}

function parseSchemaFields(schemaText: string): SchemaField[] {
  try {
    const parsed = JSON.parse(schemaText || "{}") as { properties?: Record<string, { type?: string; description?: string }> }
    return Object.entries(parsed.properties ?? {}).map(([key, value]) => ({ key, type: value.type ?? "string", description: value.description ?? "" }))
  } catch {
    return []
  }
}

function toSchemaJson(fields: SchemaField[]) {
  return JSON.stringify({ type: "object", properties: Object.fromEntries(fields.filter((field) => field.key.trim()).map((field) => [field.key, { type: field.type, description: field.description }])) }, null, 2)
}

export function IntegrationScriptWorkbench({ config, canTryRun = true, onChange, onTryRun }: IntegrationScriptWorkbenchProps) {
  const [editingScript, setEditingScript] = useState<ScriptWorkbenchItem | null>(null)

  const saveScript = (script: ScriptWorkbenchItem, inputSchemaJson: string, outputSchemaJson: string, timeoutMs: number) => {
    const exists = config.scripts.some((item) => item.id === script.id)
    onChange({
      ...config,
      inputSchemaJson,
      outputSchemaJson,
      timeoutMs,
      selectedScriptId: script.id,
      scripts: exists ? config.scripts.map((item) => item.id === script.id ? script : item) : [...config.scripts, script],
    })
    setEditingScript(null)
  }

  const removeScript = (scriptId: string) => {
    if (config.scripts.length === 1) return
    const scripts = config.scripts.filter((script) => script.id !== scriptId)
    onChange({ ...config, scripts, selectedScriptId: config.selectedScriptId === scriptId ? scripts[0].id : config.selectedScriptId })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Scripts</CardTitle>
              <CardDescription>Manage the runnable entries available in this toolset.</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditingScript(createScript(config.scripts.length + 1))}><PlusIcon />Add script</Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {config.scripts.map((script) => (
            <div key={script.id} className="rounded-xl border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{script.name}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{script.handler}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="icon-sm" variant="outline" aria-label={`Edit ${script.name}`} title="Edit script" onClick={() => setEditingScript(script)}><PencilIcon /></Button>
                  <Button size="icon-sm" variant="outline" aria-label={`Try run ${script.name}`} title="Try run" disabled={!canTryRun} onClick={() => { onChange({ ...config, selectedScriptId: script.id }); onTryRun?.(script.id) }}><PlayIcon /></Button>
                </div>
              </div>
              {config.scripts.length > 1 ? <div className="mt-3 flex justify-end"><Button size="icon-sm" variant="destructive" aria-label={`Delete ${script.name}`} title="Delete script" onClick={() => removeScript(script.id)}><Trash2Icon /></Button></div> : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <ScriptEditorDialog script={editingScript} config={config} onClose={() => setEditingScript(null)} onSave={saveScript} />
    </>
  )
}

function ScriptEditorDialog({ script, config, onClose, onSave }: {
  script: ScriptWorkbenchItem | null
  config: ScriptIntegrationConfig
  onClose: () => void
  onSave: (script: ScriptWorkbenchItem, inputSchemaJson: string, outputSchemaJson: string, timeoutMs: number) => void
}) {
  const [draft, setDraft] = useState<ScriptWorkbenchItem | null>(null)
  const [inputDraft, setInputDraft] = useState("")
  const [outputDraft, setOutputDraft] = useState("")
  const [timeoutDraft, setTimeoutDraft] = useState(0)

  useEffect(() => {
    setDraft(script ? { ...script } : null)
    setInputDraft(config.inputSchemaJson)
    setOutputDraft(config.outputSchemaJson)
    setTimeoutDraft(config.timeoutMs)
  }, [config.inputSchemaJson, config.outputSchemaJson, config.timeoutMs, script])

  if (!draft) return null

  return (
    <Dialog open={Boolean(script)} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex h-[min(88vh,54rem)] flex-col w-[calc(100vw-2rem)]! max-w-none!">
        <DialogHeader>
          <DialogTitle>Edit script</DialogTitle>
          <DialogDescription>Keep the executable implementation and its tool contract together in one draft.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="script" className="flex min-h-0 flex-1 flex-col">
          <TabsList>
            <TabsTrigger value="script">Script</TabsTrigger>
            <TabsTrigger value="parameters">Parameters</TabsTrigger>
          </TabsList>
          <TabsContent value="script" className="min-h-0 pt-4">
            <div className="flex h-full min-h-0 flex-col gap-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2"><div className="text-sm text-muted-foreground">Name</div><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div>
                <div className="space-y-2"><div className="text-sm text-muted-foreground">Handler</div><Input value={draft.handler} onChange={(event) => setDraft({ ...draft, handler: event.target.value })} /></div>
                <div className="space-y-2"><div className="text-sm text-muted-foreground">Timeout ms</div><Input type="number" value={String(timeoutDraft)} onChange={(event) => setTimeoutDraft(Number(event.target.value) || 0)} /></div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2"><div className="text-sm text-muted-foreground">Code</div><div className="min-h-80 flex-1 overflow-hidden rounded-xl border"><MonacoEditor height="100%" defaultLanguage="javascript" theme="vs-light" value={draft.code} onChange={(value) => setDraft({ ...draft, code: value ?? "" })} options={{ minimap: { enabled: false }, fontSize: 13, lineNumbersMinChars: 3, padding: { top: 12 } }} /></div></div>
            </div>
          </TabsContent>
          <TabsContent value="parameters" className="min-h-0 overflow-y-auto pt-4">
            <div className="flex flex-col gap-4 pr-2">
              <SchemaEditor label="Input contract" schemaText={inputDraft} onChange={setInputDraft} />
              <SchemaEditor label="Output contract" schemaText={outputDraft} onChange={setOutputDraft} />
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ ...draft }, inputDraft, outputDraft, timeoutDraft)}>Save script</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SchemaEditor({ label, schemaText, onChange }: { label: string; schemaText: string; onChange: (value: string) => void }) {
  const [fields, setFields] = useState<SchemaField[]>(() => parseSchemaFields(schemaText))

  const updateFields = (next: SchemaField[]) => {
    setFields(next)
    onChange(toSchemaJson(next))
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-3">
      <div className="flex items-center justify-between gap-2"><div className="text-sm font-medium">{label}</div><Button size="sm" variant="outline" onClick={() => updateFields([...fields, { key: "", type: "string", description: "" }])}>Add field</Button></div>
      {fields.map((field, index) => (
        <div key={`${field.key}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1.2fr)_auto]">
          <Input value={field.key} onChange={(event) => updateFields(fields.map((item, itemIndex) => itemIndex === index ? { ...item, key: event.target.value } : item))} placeholder="name" />
          <NativeSelect value={field.type} onChange={(event) => updateFields(fields.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value } : item))}><NativeSelectOption value="string">string</NativeSelectOption><NativeSelectOption value="number">number</NativeSelectOption><NativeSelectOption value="boolean">boolean</NativeSelectOption><NativeSelectOption value="array">array</NativeSelectOption><NativeSelectOption value="object">object</NativeSelectOption></NativeSelect>
          <Input value={field.description} onChange={(event) => updateFields(fields.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} placeholder="description" />
          <Button size="icon-sm" variant="destructive" aria-label={`Delete field ${field.key || index + 1}`} title="Delete field" onClick={() => updateFields(fields.filter((_, itemIndex) => itemIndex !== index))}><Trash2Icon /></Button>
        </div>
      ))}
    </div>
  )
}
