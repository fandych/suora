import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router"
import { PlayIcon, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { useAsyncResource } from "@/hooks/use-async-resource"
import type { HttpIntegrationConfig, IntegrationConfig, McpIntegrationConfig } from "@/data/domain/models"
import { getIntegrationDetail, publishIntegrationVersion, runIntegrationAndPersist, saveIntegrationDraft } from "@/data/repositories/integration-repository"
import { IntegrationBasicEditor } from "@/views/integrations/components/integration-basic-editor"
import { IntegrationHttpEndpointsPanel } from "@/views/integrations/components/integration-http-endpoints-panel"
import { IntegrationMcpToolsPanel } from "@/views/integrations/components/integration-mcp-tools-panel"
import { IntegrationScriptWorkbench } from "@/views/integrations/components/integration-script-workbench"
import { IntegrationTryRunSheet } from "@/views/integrations/components/integration-try-run-sheet"
import { createDefaultHttpIntegrationConfig, readMcpTools, syncHttpIntegrationConfig } from "@/lib/integration-http"

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
    ].filter((issue): issue is { severity: "warning" | "error"; message: string } => Boolean(issue))
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
    ].filter((issue): issue is { severity: "warning" | "error"; message: string } => Boolean(issue))
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
  ].filter((issue): issue is { severity: "warning" | "error"; message: string } => Boolean(issue))
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
        description="Configure shared connection details and the HTTP operations available to this toolset."
      />

      <div className="flex-1 overflow-x-hidden p-4">
        <div className="flex w-full min-w-0 flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading integration..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data && config ? (
            <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
              <div className="min-w-0 space-y-3">
                <IntegrationBasicEditor config={config} title={title} onChange={handleConfigChange} onTitleChange={setTitle} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setIsTryRunOpen(true)} disabled={!canTryRun}><PlayIcon />Try run</Button>
                  <Button size="sm" onClick={handleSave} disabled={!hasUnsavedChanges}>Save draft</Button>
                  <Button size="sm" variant="outline" onClick={handlePublish} disabled={hasUnsavedChanges || hasBlockingIssues}><UploadIcon />Publish</Button>
                </div>
                {issues.length > 0 ? <div className="flex flex-col gap-2">{issues.map((issue) => <p key={issue.message} className="text-sm text-muted-foreground">{issue.message}</p>)}</div> : null}
              </div>
              {config.kind === "http" ? <IntegrationHttpEndpointsPanel config={config as HttpIntegrationConfig} canTryRun={canTryRun} onChange={handleConfigChange} onTryRun={openTryRunForHttpEndpoint} /> : null}
              {config.kind === "scripts" ? <IntegrationScriptWorkbench config={config} canTryRun={canTryRun} onChange={handleConfigChange} onTryRun={openTryRunForScript} /> : null}
              {config.kind === "mcp" ? <IntegrationMcpToolsPanel config={config as McpIntegrationConfig} /> : null}
            </div>
          ) : null}
        </div>
      </div>

      {data ? <IntegrationTryRunSheet executions={data.executions} input={runInput} isOpen={isTryRunOpen} isRunning={isRunning} httpConfig={config?.kind === "http" ? config : undefined} scriptConfig={config?.kind === "scripts" ? config : undefined} onChangeInput={setRunInput} onOpenChange={setIsTryRunOpen} onRun={() => void handleRun()} /> : null}
    </div>
  )
}

export default IntegrationsDetailPage