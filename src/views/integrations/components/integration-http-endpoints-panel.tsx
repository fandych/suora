import { useEffect, useMemo, useState } from "react"
import { FileJson2Icon, PlayIcon, PlusIcon, Settings2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type {
  HttpEndpointConfig,
  HttpEndpointParameter,
  HttpIntegrationConfig,
  IntegrationConfig,
} from "@/data/domain/models"
import {
  createHttpEndpoint,
  createHttpEndpointParameter,
  getSelectedHttpEndpoint,
  mergeHttpEndpoints,
  parseCurlImport,
  parseOpenApiImport,
  syncHttpIntegrationConfig,
} from "@/lib/integration-http"

type IntegrationHttpEndpointsPanelProps = {
  config: HttpIntegrationConfig
  canTryRun: boolean
  onChange: (config: IntegrationConfig) => void
  onTryRun: (endpointId: string) => void
}

function createDraftFromEndpoint(endpoint?: HttpEndpointConfig) {
  return createHttpEndpoint(endpoint)
}

export function IntegrationHttpEndpointsPanel({
  config,
  canTryRun,
  onChange,
  onTryRun,
}: IntegrationHttpEndpointsPanelProps) {
  const [editingEndpoint, setEditingEndpoint] = useState<HttpEndpointConfig | null>(null)
  const [curlImport, setCurlImport] = useState("")
  const [openApiImport, setOpenApiImport] = useState("")
  const [isCurlDialogOpen, setIsCurlDialogOpen] = useState(false)
  const [isOpenApiDialogOpen, setIsOpenApiDialogOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const selectedEndpoint = useMemo(() => getSelectedHttpEndpoint(config), [config])

  const updateConfig = (next: HttpIntegrationConfig) => {
    onChange(syncHttpIntegrationConfig(next))
  }

  const saveEndpoint = (endpoint: HttpEndpointConfig) => {
    const hasExisting = config.endpoints.some((item) => item.id === endpoint.id)
    updateConfig({
      ...config,
      endpoints: hasExisting
        ? config.endpoints.map((item) => item.id === endpoint.id ? endpoint : item)
        : [...config.endpoints, endpoint],
      selectedEndpointId: endpoint.id,
    })
    setEditingEndpoint(null)
  }

  const removeEndpoint = (endpointId: string) => {
    const remaining = config.endpoints.filter((endpoint) => endpoint.id !== endpointId)
    if (remaining.length === 0) {
      return
    }

    updateConfig({
      ...config,
      endpoints: remaining,
      selectedEndpointId: config.selectedEndpointId === endpointId ? remaining[0].id : config.selectedEndpointId,
    })
  }

  const applyCurlImport = () => {
    try {
      const imported = parseCurlImport(curlImport)
      const mergedEndpoints = mergeHttpEndpoints(config.endpoints, [imported.endpoint])
      const selectedEndpoint = mergedEndpoints.find((endpoint) => endpoint.method === imported.endpoint.method && endpoint.path === imported.endpoint.path)
      updateConfig({
        ...config,
        baseUrl: imported.baseUrl || config.baseUrl,
        authType: imported.authType === "none" ? config.authType : imported.authType,
        authConfigJson: imported.authType === "none" ? config.authConfigJson : imported.authConfigJson,
        endpoints: mergedEndpoints,
        selectedEndpointId: selectedEndpoint?.id ?? imported.endpoint.id,
      })
      setImportError(null)
      setCurlImport("")
      setIsCurlDialogOpen(false)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error))
    }
  }

  const applyOpenApiImport = () => {
    try {
      const imported = parseOpenApiImport(openApiImport)
      const mergedEndpoints = mergeHttpEndpoints(config.endpoints, imported.endpoints)
      const firstImportedEndpoint = imported.endpoints[0]
      const selectedEndpoint = firstImportedEndpoint
        ? mergedEndpoints.find((endpoint) => endpoint.method === firstImportedEndpoint.method && endpoint.path === firstImportedEndpoint.path)
        : undefined
      updateConfig({
        ...config,
        baseUrl: imported.baseUrl || config.baseUrl,
        description: config.description || imported.description,
        authType: config.authType === "none" ? imported.authType : config.authType,
        authConfigJson: config.authType === "none" ? imported.authConfigJson : config.authConfigJson,
        endpoints: mergedEndpoints,
        selectedEndpointId: selectedEndpoint?.id ?? config.selectedEndpointId,
      })
      setImportError(null)
      setOpenApiImport("")
      setIsOpenApiDialogOpen(false)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <>
      <Card className="min-h-0">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Endpoints</CardTitle>
              <CardDescription>Manage HTTP-style operations, parameter locations, cURL imports, and API-doc imports.</CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                <PlusIcon />
                Add endpoint
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 min-w-52">
                <DropdownMenuItem onClick={() => setEditingEndpoint(createDraftFromEndpoint())}>Add endpoint</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setImportError(null); setCurlImport("curl https://api.example.com/items -X POST -H \"Authorization: Bearer token\""); setIsCurlDialogOpen(true) }}>Import from cURL</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setImportError(null); setOpenApiImport('{\n  "openapi": "3.0.0",\n  "servers": [{ "url": "https://api.example.com" }],\n  "paths": {}\n}'); setIsOpenApiDialogOpen(true) }}>Import API doc</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="min-h-0">
          <ScrollArea className="h-136 pr-2">
            <div className="space-y-3">
              {config.endpoints.map((endpoint) => {
                const isSelected = endpoint.id === selectedEndpoint?.id
                return (
                  <div key={endpoint.id} className={`rounded-xl border p-3 ${isSelected ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => updateConfig({ ...config, selectedEndpointId: endpoint.id })}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">{endpoint.method}</span>
                          <span className="truncate text-sm font-medium text-foreground">{endpoint.name}</span>
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">{endpoint.path}</div>
                        <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">{endpoint.description || "No endpoint description yet."}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{endpoint.parameters.length} params</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{endpoint.bodyMode}</span>
                        </div>
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditingEndpoint(createDraftFromEndpoint(endpoint))}>
                          <Settings2Icon />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" disabled={!canTryRun} onClick={() => onTryRun(endpoint.id)}>
                          <PlayIcon />
                          Try run
                        </Button>
                      </div>
                    </div>
                    {config.endpoints.length > 1 ? (
                      <div className="mt-3 flex justify-end">
                        <Button size="sm" variant="ghost" onClick={() => removeEndpoint(endpoint.id)}>Remove</Button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <EndpointEditorDialog
        endpoint={editingEndpoint}
        onClose={() => setEditingEndpoint(null)}
        onSave={saveEndpoint}
      />

      <ImportDialog
        open={isCurlDialogOpen}
        title="Import from cURL"
        description="Paste a curl command. The importer will create or update one endpoint and try to infer auth headers."
        value={curlImport}
        onChange={setCurlImport}
        onClose={() => { setCurlImport(""); setImportError(null); setIsCurlDialogOpen(false) }}
        onApply={applyCurlImport}
        error={importError}
      />

      <ImportDialog
        open={isOpenApiDialogOpen}
        title="Import API doc"
        description="Paste OpenAPI JSON. Endpoints are merged by method + path."
        value={openApiImport}
        onChange={setOpenApiImport}
        onClose={() => { setOpenApiImport(""); setImportError(null); setIsOpenApiDialogOpen(false) }}
        onApply={applyOpenApiImport}
        error={importError}
      />
    </>
  )
}

function EndpointEditorDialog({
  endpoint,
  onClose,
  onSave,
}: {
  endpoint: HttpEndpointConfig | null
  onClose: () => void
  onSave: (endpoint: HttpEndpointConfig) => void
}) {
  const [draft, setDraft] = useState<HttpEndpointConfig | null>(null)

  useEffect(() => {
    setDraft(endpoint ? createDraftFromEndpoint(endpoint) : null)
  }, [endpoint])

  if (!draft) {
    return null
  }

  const updateParameter = (parameterId: string, patch: Partial<HttpEndpointParameter>) => {
    setDraft({
      ...draft,
      parameters: draft.parameters.map((parameter) => parameter.id === parameterId ? { ...parameter, ...patch } : parameter),
    })
  }

  return (
    <Dialog open={Boolean(endpoint)} onOpenChange={(open) => { if (!open) { onClose() } }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit endpoint</DialogTitle>
          <DialogDescription>Configure HTTP semantics for this endpoint, including path/query/header/form/json parameters.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><div className="text-sm text-muted-foreground">Name</div><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div>
              <div className="space-y-2"><div className="text-sm text-muted-foreground">Method</div><NativeSelect value={draft.method} onChange={(event) => setDraft({ ...draft, method: event.target.value })}><NativeSelectOption value="GET">GET</NativeSelectOption><NativeSelectOption value="POST">POST</NativeSelectOption><NativeSelectOption value="PUT">PUT</NativeSelectOption><NativeSelectOption value="PATCH">PATCH</NativeSelectOption><NativeSelectOption value="DELETE">DELETE</NativeSelectOption></NativeSelect></div>
            </div>
            <div className="space-y-2"><div className="text-sm text-muted-foreground">Path</div><Input value={draft.path} onChange={(event) => setDraft({ ...draft, path: event.target.value })} placeholder="/v1/items/{itemId}" /></div>
            <div className="space-y-2"><div className="text-sm text-muted-foreground">Description</div><Textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={4} /></div>
            <div className="space-y-2"><div className="text-sm text-muted-foreground">Body mode</div><NativeSelect value={draft.bodyMode} onChange={(event) => setDraft({ ...draft, bodyMode: event.target.value as HttpEndpointConfig["bodyMode"] })}><NativeSelectOption value="none">None</NativeSelectOption><NativeSelectOption value="json">JSON</NativeSelectOption><NativeSelectOption value="form-data">Form-data</NativeSelectOption><NativeSelectOption value="x-www-form-urlencoded">Form URL encoded</NativeSelectOption></NativeSelect></div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2"><div className="text-sm text-muted-foreground">Headers JSON</div><Textarea className="font-mono" rows={6} value={draft.headersJson} onChange={(event) => setDraft({ ...draft, headersJson: event.target.value })} /></div>
            <div className="space-y-2"><div className="text-sm text-muted-foreground">Default query JSON</div><Textarea className="font-mono" rows={4} value={draft.queryJson} onChange={(event) => setDraft({ ...draft, queryJson: event.target.value })} /></div>
            <div className="space-y-2"><div className="text-sm text-muted-foreground">Default body JSON</div><Textarea className="font-mono" rows={6} value={draft.bodyJson} onChange={(event) => setDraft({ ...draft, bodyJson: event.target.value })} /></div>
          </div>
        </div>
        <div className="space-y-3 rounded-xl border p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium">Parameters</div>
              <div className="text-xs text-muted-foreground">Mark each parameter as path, query, header, form-data, or JSON body input.</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, parameters: [...draft.parameters, createHttpEndpointParameter()] })}>Add parameter</Button>
          </div>
          <div className="space-y-2">
            {draft.parameters.map((parameter) => (
              <div key={parameter.id} className="grid gap-2 rounded-lg border p-2 md:grid-cols-[1fr_8rem_7rem_6rem_1fr_auto]">
                <Input value={parameter.name} onChange={(event) => updateParameter(parameter.id, { name: event.target.value })} placeholder="name" />
                <NativeSelect value={parameter.in} onChange={(event) => updateParameter(parameter.id, { in: event.target.value as HttpEndpointParameter["in"] })}><NativeSelectOption value="path">path</NativeSelectOption><NativeSelectOption value="query">query</NativeSelectOption><NativeSelectOption value="header">header</NativeSelectOption><NativeSelectOption value="form-data">form-data</NativeSelectOption><NativeSelectOption value="json">json</NativeSelectOption></NativeSelect>
                <NativeSelect value={parameter.type} onChange={(event) => updateParameter(parameter.id, { type: event.target.value })}><NativeSelectOption value="string">string</NativeSelectOption><NativeSelectOption value="number">number</NativeSelectOption><NativeSelectOption value="boolean">boolean</NativeSelectOption><NativeSelectOption value="array">array</NativeSelectOption><NativeSelectOption value="object">object</NativeSelectOption></NativeSelect>
                <label className="flex items-center justify-between rounded-lg border px-2 py-1 text-xs text-muted-foreground"><span>Required</span><Switch checked={parameter.required} onCheckedChange={(checked) => updateParameter(parameter.id, { required: checked })} /></label>
                <Input value={parameter.description} onChange={(event) => updateParameter(parameter.id, { description: event.target.value })} placeholder="description" />
                <Button size="sm" variant="ghost" onClick={() => setDraft({ ...draft, parameters: draft.parameters.filter((item) => item.id !== parameter.id) })}>Remove</Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(draft)}>Save endpoint</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ImportDialog({
  open,
  title,
  description,
  value,
  onChange,
  onClose,
  onApply,
  error,
}: {
  open: boolean
  title: string
  description: string
  value: string
  onChange: (value: string) => void
  onClose: () => void
  onApply: () => void
  error: string | null
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) { onClose() } }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Textarea className="min-h-72 font-mono" value={value} onChange={(event) => onChange(event.target.value)} />
        {error ? <div className="rounded-lg border border-destructive/35 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onApply}><FileJson2Icon />Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}