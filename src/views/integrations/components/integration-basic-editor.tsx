import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import type { HttpIntegrationConfig, IntegrationConfig, McpIntegrationConfig, ScriptIntegrationConfig } from "@/data/domain/models"
import { createChangedKindConfig } from "@/views/integrations/components/integration-editor-utils"

type IntegrationBasicEditorProps = {
  config: IntegrationConfig
  title: string
  onChange: (config: IntegrationConfig) => void
  onTitleChange: (value: string) => void
}

export function IntegrationBasicEditor({ config, title, onChange, onTitleChange }: IntegrationBasicEditorProps) {
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
    </Card>
  )
}

function parseAuthConfig(config: HttpIntegrationConfig) {
  try {
    return JSON.parse(config.authConfigJson || "{}") as Record<string, string>
  } catch {
    return {}
  }
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

function HttpConnectionFields({ config, onChange }: { config: HttpIntegrationConfig; onChange: (config: IntegrationConfig) => void }) {
  const authConfig = parseAuthConfig(config)

  return (
    <div className="space-y-4">
      <div className="space-y-2"><div className="text-sm text-muted-foreground">Description</div><Textarea value={config.description} onChange={(event) => onChange({ ...config, description: event.target.value })} rows={4} /></div>
      <div className="space-y-2"><div className="text-sm text-muted-foreground">Base URL</div><Input value={config.baseUrl} onChange={(event) => onChange({ ...config, baseUrl: event.target.value })} placeholder="https://api.example.com" /></div>
      <div className="space-y-2"><div className="text-sm text-muted-foreground">Authorization</div><NativeSelect value={config.authType} onChange={(event) => onChange({ ...config, authType: event.target.value as HttpIntegrationConfig["authType"] })}><NativeSelectOption value="none">None</NativeSelectOption><NativeSelectOption value="bearer">Bearer token</NativeSelectOption><NativeSelectOption value="basic">Basic auth</NativeSelectOption><NativeSelectOption value="api-key">API key</NativeSelectOption><NativeSelectOption value="custom">Custom headers</NativeSelectOption></NativeSelect></div>
      {config.authType === "bearer" ? <div className="space-y-2"><div className="text-sm text-muted-foreground">Bearer token</div><Input value={authConfig.token ?? ""} onChange={(event) => updateHttpAuthConfig(config, onChange, { token: event.target.value })} placeholder="token" /></div> : null}
      {config.authType === "basic" ? <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><div className="text-sm text-muted-foreground">Username</div><Input value={authConfig.username ?? ""} onChange={(event) => updateHttpAuthConfig(config, onChange, { ...authConfig, username: event.target.value })} /></div><div className="space-y-2"><div className="text-sm text-muted-foreground">Password</div><Input value={authConfig.password ?? ""} onChange={(event) => updateHttpAuthConfig(config, onChange, { ...authConfig, password: event.target.value })} /></div></div> : null}
      {config.authType === "api-key" ? <div className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><div className="text-sm text-muted-foreground">Location</div><NativeSelect value={authConfig.location ?? "header"} onChange={(event) => updateHttpAuthConfig(config, onChange, { ...authConfig, location: event.target.value })}><NativeSelectOption value="header">Header</NativeSelectOption><NativeSelectOption value="query">Query</NativeSelectOption></NativeSelect></div><div className="space-y-2"><div className="text-sm text-muted-foreground">Key name</div><Input value={authConfig.name ?? "x-api-key"} onChange={(event) => updateHttpAuthConfig(config, onChange, { ...authConfig, name: event.target.value })} /></div><div className="space-y-2"><div className="text-sm text-muted-foreground">Value</div><Input value={authConfig.value ?? ""} onChange={(event) => updateHttpAuthConfig(config, onChange, { ...authConfig, value: event.target.value })} /></div></div> : null}
      {config.authType === "custom" ? <div className="space-y-2"><div className="text-sm text-muted-foreground">Custom auth JSON</div><Textarea value={config.authConfigJson} onChange={(event) => onChange({ ...config, authConfigJson: event.target.value })} rows={6} className="font-mono" /></div> : null}
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