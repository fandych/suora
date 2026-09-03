import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import PageHeader from "@/views/components/page-header"
import VersionSelect from "@/views/components/version-select"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { useAsyncResource } from "@/hooks/use-async-resource"
import type { HttpIntegrationConfig, IntegrationConfig, McpIntegrationConfig } from "@/data/domain/models"
import { getIntegrationDetail, publishIntegrationVersion, runIntegrationAndPersist, saveIntegrationDraft } from "@/data/repositories/integration-repository"
import { IntegrationBasicEditor } from "@/views/integrations/components/integration-basic-editor"
import { IntegrationHttpEndpointsPanel } from "@/views/integrations/components/integration-http-endpoints-panel"
import { IntegrationMcpToolsPanel } from "@/views/integrations/components/integration-mcp-tools-panel"
import { IntegrationParameterEditor } from "@/views/integrations/components/integration-parameter-editor"
import { IntegrationScriptWorkbench } from "@/views/integrations/components/integration-script-workbench"
import { IntegrationTryRunSheet } from "@/views/integrations/components/integration-try-run-sheet"
import { buildHttpEndpointUrl, createDefaultHttpIntegrationConfig, getSelectedHttpEndpoint, readMcpTools, syncHttpIntegrationConfig } from "@/lib/integration-http"

const FALLBACK_HTTP_CONFIG: IntegrationConfig = createDefaultHttpIntegrationConfig()

function buildIntegrationFingerprint(input: { title: string; config: IntegrationConfig }) {
  return JSON.stringify(input)
}

function getIntegrationIssues(config: IntegrationConfig | null) {
  if (!config) {
    return [] as Array<{ severity: "warning" | "error"; message: string }>
  }

  if (config.kind === "http") {
    return [
      !config.baseUrl.trim() ? { severity: "error" as const, message: "HTTP toolset requires a base URL before it can run." } : null,
      config.endpoints.length === 0 ? { severity: "error" as const, message: "HTTP toolset needs at least one endpoint." } : null,
      !config.endpoints.every((endpoint) => endpoint.path.trim()) ? { severity: "error" as const, message: "Every HTTP endpoint needs a path." } : null,
      !config.description.trim() ? { severity: "warning" as const, message: "HTTP toolset is missing a description for operators." } : null,
    ].filter(Boolean)
  }

  if (config.kind === "mcp") {
    return [
      !config.description.trim()
        ? { severity: "warning" as const, message: "MCP toolset is missing a description for operators." }
        : null,
      !config.endpoint.trim() && !config.launchCommand.trim()
        ? { severity: "error" as const, message: "MCP toolset needs an endpoint or launch command." }
        : null,
      config.protocols.length === 0
        ? { severity: "error" as const, message: "MCP toolset needs at least one protocol." }
        : null,
    ].filter(Boolean)
  }

  const selectedScript = config.scripts.find((script) => script.id === config.selectedScriptId)
  return [
    !config.description.trim()
      ? { severity: "warning" as const, message: "Script toolset is missing a description for operators." }
      : null,
    config.scripts.length === 0
      ? { severity: "error" as const, message: "Script toolset needs at least one script entry." }
      : null,
    !selectedScript?.code.trim()
      ? { severity: "error" as const, message: "Selected script has no code body." }
      : null,
  ].filter(Boolean)
}

function getResolvedEndpoint(config: IntegrationConfig | null) {
  if (!config) {
    return "Pending config"
  }

  if (config.kind === "http") {
    const endpoint = getSelectedHttpEndpoint(config)
    return endpoint ? buildHttpEndpointUrl(config.baseUrl, endpoint.path) : "Pending config"
  }

  if (config.kind === "mcp") {
    return config.endpoint || config.launchCommand || "Pending config"
  }

  return config.scripts.find((script) => script.id === config.selectedScriptId)?.handler || config.scripts[0]?.handler || "Pending config"
}

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
  const [isTryRunOpen, setIsTryRunOpen] = useState(false)

  useEffect(() => {
    if (!data) {
      return
    }

    setTitle(data.integration.title)
    setConfig(data.config)
    setSelectedVersionId(data.selectedVersion.id)
  }, [data])

  const handleConfigChange = (next: IntegrationConfig) => {
    if (next.kind === "http") {
      setConfig(syncHttpIntegrationConfig(next))
      return
    }

    if (next.kind === "mcp") {
      setConfig({
        ...next,
        tools: readMcpTools(next.toolCatalogJson),
      } satisfies McpIntegrationConfig)
      return
    }

    setConfig(next)
  }

  const handleSave = async () => {
    if (!integrationId || !config) {
      return
    }

    const next = await saveIntegrationDraft(integrationId, {
      title,
      kind: config.kind,
      config,
      selectedVersionId: data?.selectedVersion.id,
    })
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

  const issues = useMemo(() => getIntegrationIssues(config), [config])
  const hasBlockingIssues = issues.some((issue) => issue.severity === "error")
  const currentFingerprint = useMemo(
    () => buildIntegrationFingerprint({ title, config: config ?? FALLBACK_HTTP_CONFIG }),
    [config, title]
  )
  const savedFingerprint = useMemo(() => {
    if (!data) {
      return ""
    }

    return buildIntegrationFingerprint({
      title: data.integration.title,
      config: data.config,
    })
  }, [data])
  const hasUnsavedChanges = Boolean(data && config) && currentFingerprint !== savedFingerprint
  const resolvedEndpoint = useMemo(() => getResolvedEndpoint(config), [config])
  const isReleaseVersion = Boolean(data?.selectedVersion.isRelease)
  const canTryRun = !hasUnsavedChanges && !hasBlockingIssues

  const openTryRunForHttpEndpoint = (endpointId: string) => {
    if (!config || config.kind !== "http") {
      return
    }

    setConfig(syncHttpIntegrationConfig({
      ...config,
      selectedEndpointId: endpointId,
    }))
    setIsTryRunOpen(true)
  }

  const openTryRunForScript = (scriptId: string) => {
    if (!config || config.kind !== "scripts") {
      return
    }

    setConfig({
      ...config,
      selectedScriptId: scriptId,
    })
    setIsTryRunOpen(true)
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={data?.integration.title ?? "Integration"}
        actions={data ? (
          <>
            <VersionSelect versions={data.versions} value={data.selectedVersion.id} onChange={setSelectedVersionId} />
            <Badge variant={isReleaseVersion ? "secondary" : "outline"}>{isReleaseVersion ? "Release revision" : "Draft revision"}</Badge>
            <Badge variant={hasUnsavedChanges ? "destructive" : "outline"}>{hasUnsavedChanges ? "Unsaved changes" : "Saved"}</Badge>
            <Badge variant={issues.length ? "destructive" : "outline"}>{issues.length} config issue{issues.length === 1 ? "" : "s"}</Badge>
            <Button size="sm" variant="outline" onClick={() => setIsTryRunOpen(true)} disabled={hasUnsavedChanges || hasBlockingIssues}>Try run</Button>
            <Button size="sm" onClick={handleSave} disabled={!hasUnsavedChanges}>Save draft</Button>
            <Button size="sm" variant="outline" onClick={handlePublish} disabled={hasUnsavedChanges || hasBlockingIssues}>Publish</Button>
          </>
        ) : null}
      />

      <div className="flex min-h-0 flex-1 p-6">
        <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading integration..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data && config ? (
            <>
              <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
                <Card>
                  <CardHeader>
                    <CardTitle>Toolset hub</CardTitle>
                    <CardDescription>Use the current draft as the operator-facing source of truth before running or publishing.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1fr)_20rem]">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border bg-muted/20 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Kind</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{config.kind}</div>
                      </div>
                      <div className="rounded-xl border bg-muted/20 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Selected revision</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{data.selectedVersion.label}</div>
                      </div>
                      <div className="rounded-xl border bg-muted/20 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Executions</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{data.executions.length}</div>
                      </div>
                    </div>
                    <div className="rounded-xl border p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Resolved endpoint</div>
                      <div className="mt-1 break-all text-sm font-medium text-foreground">{resolvedEndpoint}</div>
                      <div className="mt-2 text-xs text-muted-foreground">Try run is blocked while the draft is unsaved or has configuration errors.</div>
                    </div>
                  </CardContent>
                </Card>

                {issues.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Config checks</CardTitle>
                      <CardDescription>These checks mirror the missing operator guidance from the forhub toolset flow.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {issues.map((issue) => (
                        <div key={issue.message} className={`rounded-xl border px-3 py-2 text-sm ${issue.severity === "error" ? "border-destructive/35 bg-destructive/5 text-destructive" : "border-amber-500/35 bg-amber-500/5 text-amber-700 dark:text-amber-300"}`}>
                          {issue.message}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}

                <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <div className="flex min-h-0 flex-col gap-4">
                    <IntegrationBasicEditor config={config} title={title} onChange={handleConfigChange} onTitleChange={setTitle} />
                    {config.kind === "scripts" ? <IntegrationParameterEditor config={config} onChange={handleConfigChange} /> : null}
                  </div>

                  {config.kind === "http" ? (
                    <IntegrationHttpEndpointsPanel config={config as HttpIntegrationConfig} canTryRun={canTryRun} onChange={handleConfigChange} onTryRun={openTryRunForHttpEndpoint} />
                  ) : null}
                  {config.kind === "scripts" ? (
                    <IntegrationScriptWorkbench config={config} canTryRun={canTryRun} onChange={handleConfigChange} onTryRun={openTryRunForScript} />
                  ) : null}
                  {config.kind === "mcp" ? (
                    <IntegrationMcpToolsPanel config={config as McpIntegrationConfig} />
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {data ? <IntegrationTryRunSheet executions={data.executions} input={runInput} isOpen={isTryRunOpen} isRunning={isRunning} onChangeInput={setRunInput} onOpenChange={setIsTryRunOpen} onRun={() => void handleRun()} /> : null}
    </div>
  )
}

export default IntegrationsDetailPage