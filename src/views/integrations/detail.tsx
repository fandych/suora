import { useEffect, useState } from "react"
import { useParams } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import PageHeader from "@/views/components/page-header"
import VersionSelect from "@/views/components/version-select"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { useAsyncResource } from "@/hooks/use-async-resource"
import type { HttpIntegrationConfig, IntegrationConfig, McpIntegrationConfig, ScriptIntegrationConfig, ScriptWorkbenchItem } from "@/data/domain/models"
import { getIntegrationDetail, publishIntegrationVersion, runIntegrationAndPersist, saveIntegrationDraft } from "@/data/repositories/integration-repository"

const IntegrationsDetailPage = () => {
  const { integrationId } = useParams<{ integrationId: string }>()
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>()
  const { data, error, isLoading, reload, setData } = useAsyncResource(
    () => getIntegrationDetail(integrationId ?? "", selectedVersionId),
    [integrationId, selectedVersionId]
  )

  const [title, setTitle] = useState("")
  const [config, setConfig] = useState<IntegrationConfig | null>(null)
  const [runInput, setRunInput] = useState("{}")
  const [isRunning, setIsRunning] = useState(false)
  useEffect(() => {
    if (!data) {
      return
    }

    setTitle(data.integration.title)
    setConfig(data.config)
    setSelectedVersionId(data.selectedVersion.id)
  }, [data])

  const handleSave = async () => {
    if (!integrationId || !config) {
      return
    }

    const next = await saveIntegrationDraft(integrationId, { title, kind: config.kind, config })
    setData(next)
    setSelectedVersionId(next.selectedVersion.id)
  }

  const handlePublish = async () => {
    if (!integrationId || !data) {
      return
    }

    const next = await publishIntegrationVersion(integrationId, data.selectedVersion.id)
    setData(next)
    setSelectedVersionId(next.selectedVersion.id)
  }

  const handleRun = async () => {
    if (!config) {
      return
    }

    setIsRunning(true)
    try {
      if (!integrationId) {
        return
      }

      const { detail } = await runIntegrationAndPersist(integrationId, data?.selectedVersion.id, runInput)
      setData(detail)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={data?.integration.title ?? "Integration"}
        description="Type-specific editor for HTTP, script, and MCP integrations with version history."
        actions={data ? <VersionSelect versions={data.versions} value={data.selectedVersion.id} onChange={setSelectedVersionId} /> : null}
      />

      <div className="flex-1 p-6">
        <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          {isLoading ? <LoadingCard title="Loading integration..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data && config ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Integration config</CardTitle>
                  <CardDescription>Different forms are rendered for HTTP, scripts, and MCP.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Name</div>
                      <Input value={title} onChange={(event) => setTitle(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Kind</div>
                      <NativeSelect value={config.kind} onChange={(event) => setConfig(createChangedKindConfig(event.target.value as IntegrationConfig["kind"], config))}>
                        <NativeSelectOption value="http">HTTP</NativeSelectOption>
                        <NativeSelectOption value="scripts">Scripts</NativeSelectOption>
                        <NativeSelectOption value="mcp">MCP</NativeSelectOption>
                      </NativeSelect>
                    </div>
                  </div>

                  {config.kind === "http" ? <HttpForm config={config} onChange={setConfig} /> : null}
                  {config.kind === "scripts" ? <ScriptForm config={config} onChange={setConfig} /> : null}
                  {config.kind === "mcp" ? <McpForm config={config} onChange={setConfig} /> : null}

                  <div className="flex gap-2">
                    <Button onClick={handleSave}>Save draft</Button>
                    <Button variant="outline" onClick={handlePublish}>Publish</Button>
                    <Button variant="outline" onClick={handleRun} disabled={isRunning}>{isRunning ? "Running..." : "Run"}</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle>Version meta</CardTitle>
                    <Badge variant="outline">{data.integration.kind}</Badge>
                  </div>
                  <CardDescription>Current selected version and endpoint preview.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Selected version</div>
                    <div className="font-medium">{data.selectedVersion.label}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Latest visible</div>
                    <div className="font-medium">{data.latestVersion.label}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Resolved endpoint</div>
                    <div className="font-medium break-all">{data.integration.endpoint || "Pending config"}</div>
                  </div>
                  <div className="space-y-2 pt-2">
                    <div className="text-muted-foreground">Run input JSON</div>
                    <Textarea value={runInput} onChange={(event) => setRunInput(event.target.value)} rows={6} className="font-mono" />
                  </div>
                  {data.executions.length ? (
                    <div className="space-y-2 rounded-xl border p-3">
                      <div className="font-medium">Recent executions</div>
                      <div className="space-y-2">
                        {data.executions.slice(0, 4).map((execution) => (
                          <div key={execution.id} className="rounded-lg border p-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant={execution.status === "success" ? "default" : "destructive"}>{execution.status}</Badge>
                              <span className="text-muted-foreground">{new Date(execution.createdAt).toLocaleString()}</span>
                            </div>
                            <pre className="mt-2 overflow-auto whitespace-pre-wrap text-muted-foreground">{execution.output}</pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function createChangedKindConfig(kind: IntegrationConfig["kind"], current: IntegrationConfig): IntegrationConfig {
  if (current.kind === kind) {
    return current
  }

  if (kind === "mcp") {
    return { kind: "mcp", endpoint: "", launchCommand: "", protocols: ["stdio"], authModes: ["none"], authConfigJson: "{}" }
  }

  if (kind === "scripts") {
    return { kind: "scripts", runtime: "node", timeoutMs: 30000, inputSchemaJson: "{}", outputSchemaJson: "{}", selectedScriptId: "script-main", scripts: [{ id: "script-main", name: "Main Script", handler: "main", code: "export async function main(input) {\n  return { ok: true, input }\n}\n" }] }
  }

  return { kind: "http", method: "POST", url: "", description: "", headersJson: "{}", queryJson: "{}", bodyJson: "{}", authType: "none", authConfigJson: "{}", parameterSchemaJson: "{}" }
}

function HttpForm({ config, onChange }: { config: HttpIntegrationConfig; onChange: (config: IntegrationConfig) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Method</div>
          <NativeSelect value={config.method} onChange={(event) => onChange({ ...config, method: event.target.value })}>
            <NativeSelectOption value="GET">GET</NativeSelectOption>
            <NativeSelectOption value="POST">POST</NativeSelectOption>
            <NativeSelectOption value="PUT">PUT</NativeSelectOption>
            <NativeSelectOption value="PATCH">PATCH</NativeSelectOption>
            <NativeSelectOption value="DELETE">DELETE</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">URL</div>
          <Input value={config.url} onChange={(event) => onChange({ ...config, url: event.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">Description</div>
        <Input value={config.description} onChange={(event) => onChange({ ...config, description: event.target.value })} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Headers JSON</div>
          <Textarea value={config.headersJson} onChange={(event) => onChange({ ...config, headersJson: event.target.value })} rows={8} className="font-mono" />
        </div>
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Query JSON</div>
          <Textarea value={config.queryJson} onChange={(event) => onChange({ ...config, queryJson: event.target.value })} rows={8} className="font-mono" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">Body JSON</div>
        <Textarea value={config.bodyJson} onChange={(event) => onChange({ ...config, bodyJson: event.target.value })} rows={8} className="font-mono" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Auth</div>
          <NativeSelect value={config.authType} onChange={(event) => onChange({ ...config, authType: event.target.value as HttpIntegrationConfig["authType"] })}>
            <NativeSelectOption value="none">None</NativeSelectOption>
            <NativeSelectOption value="bearer">Bearer</NativeSelectOption>
            <NativeSelectOption value="basic">Basic</NativeSelectOption>
            <NativeSelectOption value="api-key">API Key</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Parameter schema JSON</div>
          <Textarea value={config.parameterSchemaJson} onChange={(event) => onChange({ ...config, parameterSchemaJson: event.target.value })} rows={4} className="font-mono" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">Auth config JSON</div>
        <Textarea value={config.authConfigJson} onChange={(event) => onChange({ ...config, authConfigJson: event.target.value })} rows={4} className="font-mono" />
      </div>
    </div>
  )
}

function ScriptForm({ config, onChange }: { config: ScriptIntegrationConfig; onChange: (config: IntegrationConfig) => void }) {
  const selectedScript = config.scripts.find((item) => item.id === config.selectedScriptId) ?? config.scripts[0]

  const updateSelectedScript = (patch: Partial<ScriptWorkbenchItem>) => {
    onChange({
      ...config,
      scripts: config.scripts.map((script) => script.id === selectedScript.id ? { ...script, ...patch } : script),
    })
  }

  const addScript = () => {
    const nextId = `script-${config.scripts.length + 1}`
    onChange({
      ...config,
      selectedScriptId: nextId,
      scripts: [...config.scripts, { id: nextId, name: `Script ${config.scripts.length + 1}`, handler: `script${config.scripts.length + 1}`, code: "export async function handler(input) {\n  return { ok: true, input }\n}\n" }],
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 rounded-xl border p-3">
        <div>
          <div className="font-medium">Script workbench</div>
          <div className="text-sm text-muted-foreground">Manage multiple scripts inside one toolset config.</div>
        </div>
        <Button size="sm" variant="outline" onClick={addScript}>Add script</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-2 rounded-xl border p-3">
          {config.scripts.map((script) => (
            <button key={script.id} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${script.id === config.selectedScriptId ? "border-primary bg-primary/5" : "border-border"}`} onClick={() => onChange({ ...config, selectedScriptId: script.id })}>
              <span>{script.name}</span>
            </button>
          ))}
        </div>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Runtime</div>
              <Input value={config.runtime} onChange={(event) => onChange({ ...config, runtime: event.target.value })} />
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Selected handler</div>
              <Input value={selectedScript?.handler ?? ""} onChange={(event) => updateSelectedScript({ handler: event.target.value })} />
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Timeout ms</div>
              <Input type="number" value={String(config.timeoutMs)} onChange={(event) => onChange({ ...config, timeoutMs: Number(event.target.value) || 0 })} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Script name</div>
            <Input value={selectedScript?.name ?? ""} onChange={(event) => updateSelectedScript({ name: event.target.value })} />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Input schema JSON</div>
            <Textarea value={config.inputSchemaJson} onChange={(event) => onChange({ ...config, inputSchemaJson: event.target.value })} rows={5} className="font-mono" />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Output schema JSON</div>
            <Textarea value={config.outputSchemaJson} onChange={(event) => onChange({ ...config, outputSchemaJson: event.target.value })} rows={5} className="font-mono" />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Code</div>
            <Textarea value={selectedScript?.code ?? ""} onChange={(event) => updateSelectedScript({ code: event.target.value })} rows={12} className="font-mono" />
          </div>
        </div>
      </div>
    </div>
  )
}

function McpForm({ config, onChange }: { config: McpIntegrationConfig; onChange: (config: IntegrationConfig) => void }) {
  const validationError = !config.endpoint && !config.launchCommand
    ? "MCP config needs either an endpoint or a launch command."
    : config.protocols.length === 0
      ? "Pick at least one protocol."
      : config.authModes.length === 0
        ? "Pick at least one auth mode."
        : ""

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Endpoint</div>
          <Input value={config.endpoint} onChange={(event) => onChange({ ...config, endpoint: event.target.value })} />
        </div>
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Launch command</div>
          <Input value={config.launchCommand} onChange={(event) => onChange({ ...config, launchCommand: event.target.value })} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Protocols</div>
          <Input value={config.protocols.join(", ")} onChange={(event) => onChange({ ...config, protocols: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} />
        </div>
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Auth modes</div>
          <Input value={config.authModes.join(", ")} onChange={(event) => onChange({ ...config, authModes: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} />
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">Auth config JSON</div>
        <Textarea value={config.authConfigJson} onChange={(event) => onChange({ ...config, authConfigJson: event.target.value })} rows={10} className="font-mono" />
      </div>
      {validationError ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{validationError}</div> : null}
    </div>
  )
}

export default IntegrationsDetailPage