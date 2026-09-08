import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { EllipsisIcon, PowerIcon, Trash2Icon } from "lucide-react"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { useAsyncResource } from "@/hooks/use-async-resource"
import type { HttpIntegrationConfig, IntegrationConfig, McpIntegrationConfig } from "@/data/domain/models"
import { deleteIntegration, getIntegrationDetail, runIntegrationAndPersist, saveIntegrationDraft, setIntegrationEnabled } from "@/data/repositories/integration-repository"
import { emitDataChanged } from "@/data/repositories/data-events"
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
  const navigate = useNavigate()
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
  const [tryRunTargetId, setTryRunTargetId] = useState<string | undefined>()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  useEffect(() => {
    if (!data) {
      return
    }

    setTitle(data.integration.title)
    setConfig(data.config)
    setSelectedVersionId(data.selectedVersion.id)
  }, [data])

  useEffect(() => {
    if (error instanceof Error && error.message.startsWith("Integration ") && error.message.endsWith(" was not found.")) {
      navigate("/integrations", { replace: true })
    }
  }, [error, navigate])

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

  const handleToggleEnabled = async () => {
    if (!integrationId || !data) {
      return
    }

    const summary = await setIntegrationEnabled(integrationId, !data.integration.enabled)
    setData({ ...data, integration: summary })
  }

  const handleDelete = async () => {
    if (!integrationId) {
      return
    }

    await deleteIntegration(integrationId)
    navigate("/integrations")
    window.setTimeout(() => emitDataChanged("/integrations"), 0)
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

      const { detail } = await runIntegrationAndPersist(integrationId, data?.selectedVersion.id, runInput, tryRunTargetId)
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

    setTryRunTargetId(endpointId)
    setIsTryRunOpen(true)
  }

  const openTryRunForScript = (scriptId: string) => {
    if (!config || config.kind !== "scripts") {
      return
    }

    setTryRunTargetId(scriptId)
    setIsTryRunOpen(true)
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={data?.integration.title ?? "Integration"}
        description={config?.description || "No description configured."}
        actions={data ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="icon-sm" variant="outline" aria-label="Integration actions" />}>
              <EllipsisIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 min-w-44">
              <DropdownMenuItem onClick={() => void handleToggleEnabled()}>
                <PowerIcon />
                {data.integration.enabled ? "Disable" : "Enable"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} variant="destructive">
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      />

      <div className="flex-1 overflow-x-hidden p-4">
        <div className="flex w-full min-w-0 flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading integration..." /> : null}
          {error && !(error.message.startsWith("Integration ") && error.message.endsWith(" was not found.")) ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data && config ? (
            <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
              <div className="min-w-0 space-y-3">
                <IntegrationBasicEditor config={config} title={title} onChange={handleConfigChange} onTitleChange={setTitle} onSave={handleSave} saveDisabled={!hasUnsavedChanges} />
                {issues.length > 0 ? <div className="flex flex-col gap-2">{issues.map((issue) => <p key={issue.message} className="text-sm text-muted-foreground">{issue.message}</p>)}</div> : null}
              </div>
              {config.kind === "http" ? <IntegrationHttpEndpointsPanel config={config as HttpIntegrationConfig} canTryRun={canTryRun} onChange={handleConfigChange} onTryRun={openTryRunForHttpEndpoint} /> : null}
              {config.kind === "scripts" ? <IntegrationScriptWorkbench config={config} canTryRun={canTryRun} onChange={handleConfigChange} onTryRun={openTryRunForScript} /> : null}
              {config.kind === "mcp" ? <IntegrationMcpToolsPanel config={config as McpIntegrationConfig} /> : null}
            </div>
          ) : null}
        </div>
      </div>

      {data ? <IntegrationTryRunSheet executions={data.executions} input={runInput} isOpen={isTryRunOpen} isRunning={isRunning} httpConfig={config?.kind === "http" ? { ...config, selectedEndpointId: tryRunTargetId ?? config.selectedEndpointId } : undefined} scriptConfig={config?.kind === "scripts" ? { ...config, selectedScriptId: tryRunTargetId ?? config.selectedScriptId } : undefined} onChangeInput={setRunInput} onOpenChange={setIsTryRunOpen} onRun={() => void handleRun()} /> : null}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete integration?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the integration, its versions, and execution history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void handleDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default IntegrationsDetailPage