import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import type { HttpIntegrationConfig, IntegrationConfig, McpIntegrationConfig, ScriptIntegrationConfig } from "@/data/domain/models"
import { createChangedKindConfig } from "@/views/integrations/components/integration-editor-utils"
import { PlusIcon, SaveIcon, Trash2Icon } from "lucide-react"

type IntegrationBasicEditorProps = {
  config: IntegrationConfig
  title: string
  onChange: (config: IntegrationConfig) => void
  onTitleChange: (value: string) => void
  onSave: () => void
  saveDisabled: boolean
}

export function IntegrationBasicEditor({ config, title, onChange, onTitleChange, onSave, saveDisabled }: IntegrationBasicEditorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic information</CardTitle>
        <CardDescription>Set the toolset identity and shared connection settings.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Name</div>
            <Input value={title} onChange={(event) => onTitleChange(event.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Kind</div>
            <NativeSelect value={config.kind} onChange={(event) => onChange(createChangedKindConfig(event.target.value as IntegrationConfig["kind"], config))}>
              <NativeSelectOption value="http">HTTP</NativeSelectOption>
              <NativeSelectOption value="scripts">Scripts</NativeSelectOption>
              <NativeSelectOption value="mcp">MCP</NativeSelectOption>
            </NativeSelect>
          </div>
        </div>

        {config.kind === "http" ? <HttpConnectionFields config={config} onChange={onChange} /> : null}
        {config.kind === "mcp" ? <McpConnectionFields config={config} onChange={onChange} /> : null}
        {config.kind === "scripts" ? <ScriptRuntimeFields config={config} onChange={onChange} /> : null}
      </CardContent>
      <CardFooter className="justify-end border-t pt-4">
        <Button size="sm" onClick={onSave} disabled={saveDisabled}><SaveIcon />Save</Button>
      </CardFooter>
    </Card>
  )
}

function parseAuthConfig(config: HttpIntegrationConfig) {
  try {
    return JSON.parse(config.authConfigJson || "{}") as Record<string, string | Record<string, string>>
  } catch {
    return {}
  }
}

function getSharedHeaders(authConfig: Record<string, string | Record<string, string>>, authType: HttpIntegrationConfig["authType"]) {
  if (authConfig.headers && typeof authConfig.headers === "object") {
    return authConfig.headers as Record<string, string>
  }

  if (authType === "custom") {
    return Object.fromEntries(Object.entries(authConfig).filter(([, value]) => typeof value === "string")) as Record<string, string>
  }

  return {}
}

function updateHttpAuthConfig(
  config: HttpIntegrationConfig,
  onChange: (config: IntegrationConfig) => void,
  next: Record<string, string>
) {
  onChange({
    ...config,
    authConfigJson: JSON.stringify(next, null, 2),
  })
}

function updateSharedHeaders(
  config: HttpIntegrationConfig,
  onChange: (config: IntegrationConfig) => void,
  headers: Record<string, string>
) {
  const authConfig = parseAuthConfig(config)
  const rest = Object.fromEntries(Object.entries(authConfig).filter(([key]) => key !== "headers"))
  const next = { ...rest, headers }
  if (config.authType === "custom") {
    onChange({ ...config, authConfigJson: JSON.stringify(headers, null, 2) })
    return
  }

  onChange({ ...config, authConfigJson: JSON.stringify(next, null, 2) })
}

function CustomHeadersEditor({
  headers,
  onChange,
}: {
  headers: Record<string, string>
  onChange: (headers: Record<string, string>) => void
}) {
  const entries = Object.entries(headers)

  const updateEntry = (index: number, field: "key" | "value", value: string) => {
    const nextEntries = entries.map(([key, headerValue], entryIndex) => {
      if (entryIndex !== index) {
        return [key, headerValue] as const
      }

      return field === "key" ? [value, headerValue] as const : [key, value] as const
    })

    const nextHeaders = Object.fromEntries(nextEntries)
    onChange(nextHeaders)
  }

  const addEntry = () => {
    let nextKey = `X-Custom-Header-${entries.length + 1}`
    let suffix = entries.length + 1
    while (Object.prototype.hasOwnProperty.call(headers, nextKey)) {
      suffix += 1
      nextKey = `X-Custom-Header-${suffix}`
    }
    onChange({ ...headers, [nextKey]: "" })
  }

  const removeEntry = (keyToRemove: string) => {
    const nextHeaders = Object.fromEntries(entries.filter(([key]) => key !== keyToRemove))
    onChange(nextHeaders)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm text-muted-foreground">Request headers</div>
          <div className="text-xs text-muted-foreground">Add shared request headers as key/value pairs.</div>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addEntry}><PlusIcon />Add header</Button>
      </div>
      {entries.length === 0 ? <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">No custom headers.</div> : null}
      {entries.map(([key, value], index) => (
        <div key={`${key}-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Input value={key} onChange={(event) => updateEntry(index, "key", event.target.value)} placeholder="Header name" aria-label={`Header name ${index + 1}`} />
          <Input value={value} onChange={(event) => updateEntry(index, "value", event.target.value)} placeholder="Header value" aria-label={`Header value ${index + 1}`} />
          <Button type="button" size="icon-sm" variant="destructive" aria-label={`Delete header ${key || index + 1}`} title="Delete header" onClick={() => removeEntry(key)}><Trash2Icon /></Button>
        </div>
      ))}
    </div>
  )
}

function HttpConnectionFields({ config, onChange }: { config: HttpIntegrationConfig; onChange: (config: IntegrationConfig) => void }) {
  const authConfig = parseAuthConfig(config)

  return (
    <div className="space-y-4">
      <div className="space-y-2"><div className="text-sm text-muted-foreground">Description</div><Textarea value={config.description} onChange={(event) => onChange({ ...config, description: event.target.value })} rows={4} /></div>
      <div className="space-y-2"><div className="text-sm text-muted-foreground">Base URL</div><Input value={config.baseUrl} onChange={(event) => onChange({ ...config, baseUrl: event.target.value })} placeholder="https://api.example.com" /></div>
      <div className="space-y-2"><div className="text-sm text-muted-foreground">Authorization</div><NativeSelect value={config.authType} onChange={(event) => onChange({ ...config, authType: event.target.value as HttpIntegrationConfig["authType"] })}><NativeSelectOption value="none">None</NativeSelectOption><NativeSelectOption value="bearer">Bearer token</NativeSelectOption><NativeSelectOption value="basic">Basic auth</NativeSelectOption><NativeSelectOption value="api-key">API key</NativeSelectOption><NativeSelectOption value="custom">Custom headers</NativeSelectOption></NativeSelect></div>
      {config.authType === "bearer" ? <div className="space-y-2"><div className="text-sm text-muted-foreground">Bearer token</div><Input value={typeof authConfig.token === "string" ? authConfig.token : ""} onChange={(event) => updateHttpAuthConfig(config, onChange, { token: event.target.value })} placeholder="token" /></div> : null}
      {config.authType === "basic" ? <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><div className="text-sm text-muted-foreground">Username</div><Input value={typeof authConfig.username === "string" ? authConfig.username : ""} onChange={(event) => updateHttpAuthConfig(config, onChange, { ...authConfig, username: event.target.value })} /></div><div className="space-y-2"><div className="text-sm text-muted-foreground">Password</div><Input value={typeof authConfig.password === "string" ? authConfig.password : ""} onChange={(event) => updateHttpAuthConfig(config, onChange, { ...authConfig, password: event.target.value })} /></div></div> : null}
      {config.authType === "api-key" ? <div className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><div className="text-sm text-muted-foreground">Location</div><NativeSelect value={typeof authConfig.location === "string" ? authConfig.location : "header"} onChange={(event) => updateHttpAuthConfig(config, onChange, { ...authConfig, location: event.target.value })}><NativeSelectOption value="header">Header</NativeSelectOption><NativeSelectOption value="query">Query</NativeSelectOption></NativeSelect></div><div className="space-y-2"><div className="text-sm text-muted-foreground">Key name</div><Input value={typeof authConfig.name === "string" ? authConfig.name : "x-api-key"} onChange={(event) => updateHttpAuthConfig(config, onChange, { ...authConfig, name: event.target.value })} /></div><div className="space-y-2"><div className="text-sm text-muted-foreground">Value</div><Input value={typeof authConfig.value === "string" ? authConfig.value : ""} onChange={(event) => updateHttpAuthConfig(config, onChange, { ...authConfig, value: event.target.value })} /></div></div> : null}
      <CustomHeadersEditor headers={getSharedHeaders(authConfig, config.authType)} onChange={(next) => updateSharedHeaders(config, onChange, next)} />
    </div>
  )
}

function McpConnectionFields({ config, onChange }: { config: McpIntegrationConfig; onChange: (config: IntegrationConfig) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2"><div className="text-sm text-muted-foreground">Description</div><Textarea value={config.description} onChange={(event) => onChange({ ...config, description: event.target.value })} rows={4} /></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><div className="text-sm text-muted-foreground">Endpoint</div><Input value={config.endpoint} onChange={(event) => onChange({ ...config, endpoint: event.target.value })} /></div>
        <div className="space-y-2"><div className="text-sm text-muted-foreground">Launch command</div><Input value={config.launchCommand} onChange={(event) => onChange({ ...config, launchCommand: event.target.value })} /></div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><div className="text-sm text-muted-foreground">Protocols</div><Input value={config.protocols.join(", ")} onChange={(event) => onChange({ ...config, protocols: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></div>
        <div className="space-y-2"><div className="text-sm text-muted-foreground">Auth modes</div><Input value={config.authModes.join(", ")} onChange={(event) => onChange({ ...config, authModes: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></div>
      </div>
      <div className="space-y-2"><div className="text-sm text-muted-foreground">Auth config JSON</div><Textarea value={config.authConfigJson} onChange={(event) => onChange({ ...config, authConfigJson: event.target.value })} rows={6} className="font-mono" /></div>
      <div className="space-y-2"><div className="text-sm text-muted-foreground">Tool catalog JSON</div><Textarea value={config.toolCatalogJson} onChange={(event) => onChange({ ...config, toolCatalogJson: event.target.value })} rows={8} className="font-mono" placeholder='[{ "name": "listRepositories", "description": "List repos" }]' /></div>
    </div>
  )
}

function ScriptRuntimeFields({ config, onChange }: { config: ScriptIntegrationConfig; onChange: (config: IntegrationConfig) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2"><div className="text-sm text-muted-foreground">Description</div><Textarea value={config.description} onChange={(event) => onChange({ ...config, description: event.target.value })} rows={4} /></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><div className="text-sm text-muted-foreground">Runtime</div><Input value={config.runtime} onChange={(event) => onChange({ ...config, runtime: event.target.value })} /></div>
        <div className="space-y-2"><div className="text-sm text-muted-foreground">Timeout ms</div><Input type="number" value={String(config.timeoutMs)} onChange={(event) => onChange({ ...config, timeoutMs: Number(event.target.value) || 0 })} /></div>
      </div>
    </div>
  )
}