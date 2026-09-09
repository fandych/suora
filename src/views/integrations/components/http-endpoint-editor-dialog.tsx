import { useEffect, useState } from "react"
import { BracesIcon, CheckIcon, PlusIcon, TriangleAlertIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { HttpEndpointConfig, HttpEndpointParameter } from "@/data/domain/models"
import { createHttpEndpoint, createHttpEndpointParameter } from "@/data/domain/integrations"

type ParameterLocation = HttpEndpointParameter["in"]

type HttpEndpointEditorDialogProps = {
  endpoint: HttpEndpointConfig | null
  onClose: () => void
  onSave: (endpoint: HttpEndpointConfig) => void
}

const REST_PARAMETER_SECTIONS: Array<{ location: ParameterLocation; title: string; description: string }> = [
  { location: "path", title: "Path variables", description: "Replace {variable} or :variable tokens in the request path." },
  { location: "query", title: "Query parameters", description: "Append values to the request URL query string." },
  { location: "header", title: "Header parameters", description: "Set request headers from Try run values." },
  { location: "json", title: "JSON body fields", description: "Merge values into an application/json request body for POST, PUT, PATCH, or DELETE." },
  { location: "form-data", title: "Form fields", description: "Send fields as multipart/form-data or URL-encoded form data for methods with a body." },
]

function extractPathParameterNames(path: string) {
  const names = new Set<string>()

  for (const match of path.matchAll(/\{([^{}]+)\}|:([A-Za-z_][A-Za-z0-9_]*)/g)) {
    const name = (match[1] ?? match[2])?.trim()
    if (name) {
      names.add(name)
    }
  }

  return [...names]
}

function replacePathVariable(path: string, previousName: string, nextName: string) {
  const escapedName = previousName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return path
    .replace(new RegExp(`\\{${escapedName}\\}`, "g"), `{${nextName}}`)
    .replace(new RegExp(`:${escapedName}(?=/|$)`, "g"), `:${nextName}`)
}

function methodSupportsBody(method: string) {
  return method !== "GET" && method !== "HEAD"
}

export function HttpEndpointEditorDialog({ endpoint, onClose, onSave }: HttpEndpointEditorDialogProps) {
  const [draft, setDraft] = useState<HttpEndpointConfig | null>(null)

  useEffect(() => {
    setDraft(endpoint ? createHttpEndpoint(endpoint) : null)
  }, [endpoint])

  if (!draft) return null

  const updateParameter = (parameterId: string, patch: Partial<HttpEndpointParameter>) => {
    const current = draft.parameters.find((parameter) => parameter.id === parameterId)
    const nextPath = current?.in === "path" && typeof patch.name === "string" && patch.name !== current.name
      ? replacePathVariable(draft.path, current.name, patch.name.trim())
      : draft.path
    setDraft({
      ...draft,
      path: nextPath,
      parameters: draft.parameters.map((parameter) => parameter.id === parameterId ? { ...parameter, ...patch } : parameter),
    })
  }

  const addParameter = (location: ParameterLocation) => {
    setDraft({ ...draft, parameters: [...draft.parameters, createHttpEndpointParameter({ in: location })] })
  }

  const updatePath = (path: string) => {
    const pathNames = extractPathParameterNames(path)
    const existingPathParameters = draft.parameters.filter((parameter) => parameter.in === "path")
    const nextPathParameters = pathNames.map((name) => {
      const existing = existingPathParameters.find((parameter) => parameter.name === name)
      return existing ?? createHttpEndpointParameter({ name, in: "path", required: true })
    })

    setDraft({
      ...draft,
      path,
      parameters: [
        ...draft.parameters.filter((parameter) => parameter.in !== "path"),
        ...nextPathParameters,
      ],
    })
  }

  const updateMethod = (method: string) => {
    setDraft({
      ...draft,
      method,
      bodyMode: methodSupportsBody(method) ? draft.bodyMode : "none",
    })
  }

  const updateRequestSchema = (schemaText: string) => {
    setDraft({ ...draft, parameterSchemaJson: schemaText })
  }

  const detectedPathVariables = extractPathParameterNames(draft.path)
  const pathParameters = draft.parameters.filter((parameter) => parameter.in === "path")
  const missingPathParameters = detectedPathVariables.filter((name) => !pathParameters.some((parameter) => parameter.name === name))
  const stalePathParameters = pathParameters.filter((parameter) => !detectedPathVariables.includes(parameter.name))

  const removeParameter = (parameterId: string) => {
    setDraft({ ...draft, parameters: draft.parameters.filter((parameter) => parameter.id !== parameterId) })
  }

  return (
    <Dialog open={Boolean(endpoint)} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex h-[min(88vh,54rem)] w-[calc(100vw-2rem)]! max-w-none! flex-col">
        <DialogHeader>
          <DialogTitle>Edit endpoint</DialogTitle>
          <DialogDescription>Define a REST operation, then declare exactly where each value belongs in the outgoing request.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="request" className="flex min-h-0 flex-1 flex-col">
          <TabsList>
            <TabsTrigger value="request">Request</TabsTrigger>
            <TabsTrigger value="parameters">Parameters</TabsTrigger>
            <TabsTrigger value="defaults">Defaults</TabsTrigger>
            <TabsTrigger value="schema">Schema</TabsTrigger>
          </TabsList>
          <TabsContent value="request" className="min-h-0 overflow-y-auto pt-4">
            <div className="grid gap-4 pr-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="flex flex-col gap-4">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_8rem]">
                  <LabeledField label="Name"><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></LabeledField>
                  <LabeledField label="Method"><NativeSelect value={draft.method} onChange={(event) => updateMethod(event.target.value)}><NativeSelectOption value="GET">GET</NativeSelectOption><NativeSelectOption value="POST">POST</NativeSelectOption><NativeSelectOption value="PUT">PUT</NativeSelectOption><NativeSelectOption value="PATCH">PATCH</NativeSelectOption><NativeSelectOption value="DELETE">DELETE</NativeSelectOption><NativeSelectOption value="HEAD">HEAD</NativeSelectOption><NativeSelectOption value="OPTIONS">OPTIONS</NativeSelectOption></NativeSelect></LabeledField>
                </div>
                <LabeledField label="Path" description="Use REST variables such as /v1/items/{itemId} or /v1/items/:itemId.">
                  <Input value={draft.path} onChange={(event) => updatePath(event.target.value)} placeholder="/v1/items/{itemId}" />
                  {detectedPathVariables.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>Detected:</span>
                      {detectedPathVariables.map((name) => <span key={name} className="rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono">{name}</span>)}
                      {missingPathParameters.length === 0 && stalePathParameters.length === 0 ? <CheckIcon className="size-3.5 text-emerald-600" /> : null}
                    </div>
                  ) : null}
                  {missingPathParameters.length > 0 ? <div className="flex items-center gap-1 text-xs text-amber-600"><TriangleAlertIcon className="size-3.5" />Path variables will be added automatically.</div> : null}
                  {stalePathParameters.length > 0 ? <div className="flex items-center gap-1 text-xs text-amber-600"><TriangleAlertIcon className="size-3.5" />Unused path parameters will be removed when the path changes.</div> : null}
                </LabeledField>
                <LabeledField label="Description"><Textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={5} /></LabeledField>
              </div>
              <div className="flex flex-col gap-4 rounded-xl border bg-muted/20 p-4">
                <LabeledField label="Body format" description={methodSupportsBody(draft.method) ? "Choose how form and JSON body fields are serialized." : `${draft.method} requests do not send a request body.`}><NativeSelect value={draft.bodyMode} disabled={!methodSupportsBody(draft.method)} onChange={(event) => setDraft({ ...draft, bodyMode: event.target.value as HttpEndpointConfig["bodyMode"] })}><NativeSelectOption value="none">No body</NativeSelectOption><NativeSelectOption value="json">application/json</NativeSelectOption><NativeSelectOption value="form-data">multipart/form-data</NativeSelectOption><NativeSelectOption value="x-www-form-urlencoded">application/x-www-form-urlencoded</NativeSelectOption></NativeSelect></LabeledField>
                <div className="rounded-lg border bg-background p-3 text-sm text-muted-foreground"><BracesIcon className="mb-2" />Path, query, and header parameters are available for every method. Body fields are configured in Parameters when the selected method supports a body.</div>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="parameters" className="min-h-0 overflow-y-auto pt-4">
            <div className="flex flex-col gap-4 pr-2">
              {REST_PARAMETER_SECTIONS.map((section) => <ParameterSection key={section.location} section={section} parameters={draft.parameters.filter((parameter) => parameter.in === section.location)} onAdd={() => addParameter(section.location)} onChange={updateParameter} onRemove={removeParameter} />)}
            </div>
          </TabsContent>
          <TabsContent value="defaults" className="min-h-0 overflow-y-auto pt-4">
            <div className="grid gap-4 pr-2 lg:grid-cols-3">
              <LabeledField label="Default query JSON" description="Merged before query parameters from Try run."><Textarea className="font-mono" rows={14} value={draft.queryJson} onChange={(event) => setDraft({ ...draft, queryJson: event.target.value })} /></LabeledField>
              <LabeledField label="Default headers JSON" description="Static headers; dynamic values belong in Header parameters."><Textarea className="font-mono" rows={14} value={draft.headersJson} onChange={(event) => setDraft({ ...draft, headersJson: event.target.value })} /></LabeledField>
              <LabeledField label="Default body JSON" description="Merged with JSON or form fields when a body format is selected."><Textarea className="font-mono" rows={14} value={draft.bodyJson} onChange={(event) => setDraft({ ...draft, bodyJson: event.target.value })} /></LabeledField>
            </div>
          </TabsContent>
          <TabsContent value="schema" className="min-h-0 overflow-y-auto pt-4">
            <div className="grid gap-4 pr-2 lg:grid-cols-2">
              <LabeledField label="Request JSON schema" description="Describes the JSON body fields, their types, required state, and descriptions. Parameters marked as JSON remain the source for the interactive Try run form.">
                <Textarea className="min-h-80 font-mono" value={draft.parameterSchemaJson} onChange={(event) => updateRequestSchema(event.target.value)} />
              </LabeledField>
              <div className="flex flex-col gap-4">
                <LabeledField label="Response description" description="Explain what the endpoint returns and how consumers should interpret it.">
                  <Textarea className="min-h-32" value={draft.responseDescription} onChange={(event) => setDraft({ ...draft, responseDescription: event.target.value })} placeholder="Returns the created tool and its identifier." />
                </LabeledField>
                <LabeledField label="Response JSON schema" description="Describe the JSON response shape, fields, types, and meanings.">
                  <Textarea className="min-h-56 font-mono" value={draft.responseSchemaJson} onChange={(event) => setDraft({ ...draft, responseSchemaJson: event.target.value })} />
                </LabeledField>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(draft)}>Save endpoint</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LabeledField({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-2"><div><div className="text-sm text-muted-foreground">{label}</div>{description ? <div className="mt-1 text-xs text-muted-foreground">{description}</div> : null}</div>{children}</div>
}

function ParameterSection({ section, parameters, onAdd, onChange, onRemove }: { section: { location: ParameterLocation; title: string; description: string }; parameters: HttpEndpointParameter[]; onAdd: () => void; onChange: (id: string, patch: Partial<HttpEndpointParameter>) => void; onRemove: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-3">
      <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-medium">{section.title}</div><div className="text-xs text-muted-foreground">{section.description}</div></div><Button size="sm" variant="outline" onClick={onAdd}><PlusIcon />Add</Button></div>
      {parameters.length ? parameters.map((parameter) => <ParameterRow key={parameter.id} parameter={parameter} onChange={(patch) => onChange(parameter.id, patch)} onRemove={() => onRemove(parameter.id)} />) : <div className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">No {section.title.toLowerCase()}.</div>}
    </div>
  )
}

function ParameterRow({ parameter, onChange, onRemove }: { parameter: HttpEndpointParameter; onChange: (patch: Partial<HttpEndpointParameter>) => void; onRemove: () => void }) {
  return (
    <div className="grid gap-2 rounded-lg border p-2 lg:grid-cols-[minmax(0,1fr)_8rem_7rem_6rem_minmax(0,1.2fr)_auto]">
      <Input value={parameter.name} onChange={(event) => onChange({ name: event.target.value })} placeholder="name" />
      <NativeSelect value={parameter.type} onChange={(event) => onChange({ type: event.target.value })}><NativeSelectOption value="string">string</NativeSelectOption><NativeSelectOption value="number">number</NativeSelectOption><NativeSelectOption value="boolean">boolean</NativeSelectOption><NativeSelectOption value="array">array</NativeSelectOption><NativeSelectOption value="object">object</NativeSelectOption><NativeSelectOption value="file">file</NativeSelectOption></NativeSelect>
      <Input value={parameter.defaultValue} onChange={(event) => onChange({ defaultValue: event.target.value })} placeholder="default" />
      <label className="flex items-center justify-between rounded-lg border px-2 py-1 text-xs text-muted-foreground"><span>Required</span><Switch checked={parameter.required} onCheckedChange={(required) => onChange({ required })} /></label>
      <Input value={parameter.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="description" />
      <Button size="icon-sm" variant="destructive" aria-label={`Delete parameter ${parameter.name || parameter.id}`} title="Delete parameter" onClick={onRemove}><Trash2Icon /></Button>
    </div>
  )
}
