import { useState } from "react"
import { FileJson2Icon, LinkIcon, PencilIcon, PlayIcon, PlusIcon, Trash2Icon, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import type {
  HttpEndpointConfig,
  HttpIntegrationConfig,
  IntegrationConfig,
} from "@/data/domain/models"
import {
  createHttpEndpoint,
  mergeHttpEndpoints,
  parseCurlImport,
  parseOpenApiImport,
  syncHttpIntegrationConfig,
} from "@/data/domain/integrations"
import { HttpEndpointEditorDialog } from "@/views/integrations/components/http-endpoint-editor-dialog"

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
  const [openApiUrl, setOpenApiUrl] = useState("")
  const [isFetchingApiDoc, setIsFetchingApiDoc] = useState(false)
  const [isCurlDialogOpen, setIsCurlDialogOpen] = useState(false)
  const [isOpenApiDialogOpen, setIsOpenApiDialogOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

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
    updateConfig({
      ...config,
      endpoints: remaining,
      selectedEndpointId: config.selectedEndpointId === endpointId ? remaining[0]?.id ?? "" : config.selectedEndpointId,
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

  const fetchOpenApiImport = async () => {
    if (!openApiUrl.trim()) {
      setImportError("Enter an API doc URL first.")
      return
    }

    setIsFetchingApiDoc(true)
    try {
      const source = await window.project?.integrations.fetchApiDoc(openApiUrl.trim())
      if (typeof source !== "string" || !source.trim()) {
        throw new Error("The API doc URL returned an empty response.")
      }

      setOpenApiImport(source)
      setImportError(null)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsFetchingApiDoc(false)
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
                <DropdownMenuItem onClick={() => setEditingEndpoint(createDraftFromEndpoint())}>
                  <PlusIcon className="size-4" />
                  Add endpoint
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setImportError(null); setCurlImport("curl https://api.example.com/items -X POST -H \"Authorization: Bearer token\""); setIsCurlDialogOpen(true) }}>
                  <UploadIcon className="size-4" />
                  Import from cURL
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setImportError(null); setOpenApiUrl(""); setOpenApiImport(""); setIsOpenApiDialogOpen(true) }}>
                  <FileJson2Icon className="size-4" />
                  Import API doc
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="min-h-0">
          <ScrollArea className="h-136 pr-2">
            <div className="flex flex-col gap-3">
              {config.endpoints.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No endpoints configured. Add an endpoint to get started.</div> : null}
              {config.endpoints.map((endpoint) => (
                <div key={endpoint.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">{endpoint.method}</span>
                        <span className="truncate text-sm font-medium text-foreground">{endpoint.name}</span>
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{endpoint.path}</div>
                      <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">{endpoint.description || "No endpoint description yet."}</div>
                      <div className="mt-2 text-xs text-muted-foreground">{endpoint.parameters.length} parameters · {endpoint.bodyMode}</div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="icon-sm" variant="outline" aria-label={`Edit ${endpoint.name}`} title="Edit endpoint" onClick={() => setEditingEndpoint(createDraftFromEndpoint(endpoint))}><PencilIcon /></Button>
                      <Button size="icon-sm" variant="destructive" aria-label={`Delete ${endpoint.name}`} title="Delete endpoint" onClick={() => removeEndpoint(endpoint.id)}><Trash2Icon /></Button>
                      <Button size="sm" variant="outline" disabled={!canTryRun} onClick={() => onTryRun(endpoint.id)}><PlayIcon />Try run</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <HttpEndpointEditorDialog
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
        description="Enter an API doc URL or paste OpenAPI JSON. Endpoints are merged by method + path."
        value={openApiImport}
        onChange={setOpenApiImport}
        url={openApiUrl}
        onChangeUrl={setOpenApiUrl}
        isFetching={isFetchingApiDoc}
        onFetch={fetchOpenApiImport}
        onClose={() => { setOpenApiImport(""); setImportError(null); setIsOpenApiDialogOpen(false) }}
        onApply={applyOpenApiImport}
        error={importError}
      />
    </>
  )
}

function ImportDialog({
  open,
  title,
  description,
  value,
  onChange,
  url,
  onChangeUrl,
  isFetching,
  onFetch,
  onClose,
  onApply,
  error,
}: {
  open: boolean
  title: string
  description: string
  value: string
  onChange: (value: string) => void
  url?: string
  onChangeUrl?: (value: string) => void
  isFetching?: boolean
  onFetch?: () => void
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
        {url !== undefined && onChangeUrl && onFetch ? (
          <div className="flex gap-2">
            <Input placeholder="https://example.com/openapi.json" value={url} onChange={(event) => onChangeUrl(event.target.value)} />
            <Button variant="outline" onClick={onFetch} disabled={isFetching}><LinkIcon />{isFetching ? "Loading..." : "Load URL"}</Button>
          </div>
        ) : null}
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