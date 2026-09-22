import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { EllipsisIcon, PowerIcon, RefreshCcwIcon, Trash2Icon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { createDefaultHttpIntegrationConfig, readMcpTools, syncHttpIntegrationConfig } from "@/lib/integration"
import { useAppIntl } from "@/lib/i18n"
import PageHeader from "@/pages/components/page-header"
import { LoadingCard } from "@/pages/components/resource-state"
import { IntegrationBasicEditor } from "@/pages/integrations/components/integration-basic-editor"
import { IntegrationHttpEndpointsPanel } from "@/pages/integrations/components/integration-http-endpoints-panel"
import { IntegrationMcpToolsPanel } from "@/pages/integrations/components/integration-mcp-tools-panel"
import { IntegrationScriptWorkbench } from "@/pages/integrations/components/integration-script-workbench"
import { IntegrationTryRunSheet } from "@/pages/integrations/components/integration-try-run-sheet"
import { emitDataChanged } from "@/services/data-events"
import { IntegrationApi } from "@/services/integration-service"
import { showToast } from "@/services/toast-service"
import type {
  HttpIntegrationConfig,
  IntegrationConfig,
  IntegrationTryRunResult,
  McpIntegrationConfig,
} from "@/types/integration"

const FALLBACK_HTTP_CONFIG: IntegrationConfig = createDefaultHttpIntegrationConfig()

function buildIntegrationFingerprint(input: { title: string; config: IntegrationConfig }) {
  return JSON.stringify(input)
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function normalizeConfig(next: IntegrationConfig) {
  if (next.kind === "http") {
    return syncHttpIntegrationConfig(next)
  }

  if (next.kind === "mcp") {
    return {
      ...next,
      tools: readMcpTools(next.toolCatalogJson),
    } satisfies McpIntegrationConfig
  }

  return next
}

function getIntegrationIssues(config: IntegrationConfig | null, t: ReturnType<typeof useAppIntl>["t"]) {
  if (!config) {
    return [] as Array<{ severity: "warning" | "error"; message: string }>
  }

  if (config.kind === "http") {
    return [
      !config.baseUrl.trim()
        ? {
            severity: "error" as const,
            message: t("integrations.issue.httpBaseUrl", "HTTP toolset requires a base URL before it can run."),
          }
        : null,
      !config.endpoints.every((endpoint) => endpoint.path.trim())
        ? {
            severity: "error" as const,
            message: t("integrations.issue.httpPath", "Every HTTP endpoint needs a path."),
          }
        : null,
      !config.description.trim()
        ? {
            severity: "warning" as const,
            message: t("integrations.issue.httpDescription", "HTTP toolset is missing a description for operators."),
          }
        : null,
    ].filter((issue): issue is { severity: "warning" | "error"; message: string } => Boolean(issue))
  }

  if (config.kind === "mcp") {
    return [
      !config.description.trim()
        ? {
            severity: "warning" as const,
            message: t("integrations.issue.mcpDescription", "MCP toolset is missing a description for operators."),
          }
        : null,
      !config.endpoint.trim() && !config.launchCommand.trim()
        ? {
            severity: "error" as const,
            message: t("integrations.issue.mcpConnection", "MCP toolset needs an endpoint or launch command."),
          }
        : null,
      config.protocols.length === 0
        ? {
            severity: "error" as const,
            message: t("integrations.issue.mcpProtocols", "MCP toolset needs at least one protocol."),
          }
        : null,
    ].filter((issue): issue is { severity: "warning" | "error"; message: string } => Boolean(issue))
  }

  const selectedScript = config.scripts.find((script) => script.id === config.selectedScriptId)
  return [
    !config.description.trim()
      ? {
          severity: "warning" as const,
          message: t("integrations.issue.scriptDescription", "Script toolset is missing a description for operators."),
        }
      : null,
    config.scripts.length === 0
      ? {
          severity: "error" as const,
          message: t("integrations.issue.scriptEntries", "Script toolset needs at least one script entry."),
        }
      : null,
    !selectedScript?.code.trim()
      ? {
          severity: "error" as const,
          message: t("integrations.issue.scriptCode", "Selected script has no code body."),
        }
      : null,
  ].filter((issue): issue is { severity: "warning" | "error"; message: string } => Boolean(issue))
}

const IntegrationsDetailPage = () => {
  const { t } = useAppIntl()
  const { integrationId } = useParams<{ integrationId: string }>()
  const navigate = useNavigate()
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>()
  const { data, error, isLoading, reload, setData } = useAsyncResource(
    () => IntegrationApi.get(integrationId ?? "", selectedVersionId),
    [integrationId, selectedVersionId],
  )

  const [title, setTitle] = useState("")
  const [config, setConfig] = useState<IntegrationConfig | null>(null)
  const [runInput, setRunInput] = useState("{}")
  const [tryRunResult, setTryRunResult] = useState<IntegrationTryRunResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isTryRunOpen, setIsTryRunOpen] = useState(false)
  const [tryRunTargetId, setTryRunTargetId] = useState<string | undefined>()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isSavingBasic, setIsSavingBasic] = useState(false)
  const [isPersistingNested, setIsPersistingNested] = useState(false)
  const lastErrorMessageRef = useRef("")

  useEffect(() => {
    if (!data) {
      return
    }

    setTitle(data.integration.title)
    setConfig(normalizeConfig(data.config))
    setSelectedVersionId(data.selectedVersion.id)
  }, [data])

  useEffect(() => {
    if (
      error instanceof Error &&
      error.message.startsWith("Integration ") &&
      error.message.endsWith(" was not found.")
    ) {
      navigate("/integrations", { replace: true })
    }
  }, [error, navigate])

  useEffect(() => {
    if (!(error instanceof Error)) {
      lastErrorMessageRef.current = ""
      return
    }

    if (lastErrorMessageRef.current === error.message) {
      return
    }

    lastErrorMessageRef.current = error.message
    showToast({
      title: t("integrations.toast.loadFailed", "Failed to load integration"),
      description: error.message,
      type: "error",
    })
  }, [error, t])

  const handleConfigChange = (next: IntegrationConfig, options?: { persist?: boolean }) => {
    const normalized = normalizeConfig(next)
    setConfig(normalized)

    if (!options?.persist) {
      return
    }

    void persistConfig(normalized)
  }

  const persistDraft = async (nextConfig: IntegrationConfig, nextTitle: string) => {
    if (!integrationId || !data) {
      return null
    }

    const next = await IntegrationApi.save({
      id: integrationId,
      title: nextTitle,
      kind: nextConfig.kind,
      config: nextConfig,
      selectedVersionId: data.selectedVersion.id,
    })
    setData(next)
    setSelectedVersionId(next.selectedVersion.id)
    return next
  }

  const persistConfig = async (nextConfig: IntegrationConfig) => {
    setIsPersistingNested(true)
    try {
      await persistDraft(nextConfig, title)
    } catch (nextError) {
      showToast({
        title: t("integrations.toast.autoSaveFailed", "Failed to save integration changes"),
        description: toErrorMessage(nextError, t("integrations.toast.unknownError", "Unknown error")),
        type: "error",
      })
    } finally {
      setIsPersistingNested(false)
    }
  }

  const handleSave = async () => {
    if (!config) {
      return
    }

    setIsSavingBasic(true)
    try {
      await persistDraft(config, title)
      showToast({
        title: t("integrations.toast.saved", "Integration saved"),
        type: "success",
      })
    } catch (nextError) {
      showToast({
        title: t("integrations.toast.saveFailed", "Failed to save integration"),
        description: toErrorMessage(nextError, t("integrations.toast.unknownError", "Unknown error")),
        type: "error",
      })
    } finally {
      setIsSavingBasic(false)
    }
  }

  const handleToggleEnabled = async () => {
    if (!integrationId || !data) {
      return
    }

    try {
      const summary = await IntegrationApi.setEnabled({ id: integrationId, enabled: !data.integration.enabled })
      setData({ ...data, integration: summary })
      showToast({
        title: summary.enabled
          ? t("integrations.toast.enabled", "Integration enabled")
          : t("integrations.toast.disabled", "Integration disabled"),
        type: "success",
      })
    } catch (nextError) {
      showToast({
        title: t("integrations.toast.toggleFailed", "Failed to update integration"),
        description: toErrorMessage(nextError, t("integrations.toast.unknownError", "Unknown error")),
        type: "error",
      })
    }
  }

  const handleDelete = async () => {
    if (!integrationId) {
      return
    }

    try {
      await IntegrationApi.remove(integrationId)
      navigate("/integrations")
      window.setTimeout(() => emitDataChanged("/integrations"), 0)
      showToast({
        title: t("integrations.toast.deleted", "Integration deleted"),
        type: "success",
      })
    } catch (nextError) {
      showToast({
        title: t("integrations.toast.deleteFailed", "Failed to delete integration"),
        description: toErrorMessage(nextError, t("integrations.toast.unknownError", "Unknown error")),
        type: "error",
      })
    }
  }

  const handleRun = async () => {
    if (!config || !integrationId) {
      return
    }

    setIsRunning(true)
    setTryRunResult(null)
    try {
      const result = await IntegrationApi.execute({
        integrationId,
        kind: config.kind,
        config,
        inputJson: runInput,
      })
      setTryRunResult({
        ...result,
        executedAt: Date.now(),
        errorMessage: result.ok ? undefined : result.body,
      })
    } catch (nextError) {
      const message = toErrorMessage(nextError, t("integrations.toast.runFailedUnknown", "Unknown try run failure"))
      setTryRunResult({
        ok: false,
        status: 500,
        body: "",
        executedAt: Date.now(),
        errorMessage: message,
      })
      showToast({
        title: t("integrations.toast.runFailed", "Try run failed"),
        description: message,
        type: "error",
      })
    } finally {
      setIsRunning(false)
    }
  }

  const issues = useMemo(() => getIntegrationIssues(config, t), [config, t])
  const hasBlockingIssues = issues.some((issue) => issue.severity === "error")
  const currentFingerprint = useMemo(
    () => buildIntegrationFingerprint({ title, config: config ?? FALLBACK_HTTP_CONFIG }),
    [config, title],
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
  const canTryRun = !hasUnsavedChanges && !hasBlockingIssues && !isSavingBasic && !isPersistingNested

  const openTryRunForHttpEndpoint = (endpointId: string) => {
    if (!config || config.kind !== "http") {
      return
    }

    setTryRunTargetId(endpointId)
    setTryRunResult(null)
    setIsTryRunOpen(true)
  }

  const openTryRunForScript = (scriptId: string) => {
    if (!config || config.kind !== "scripts") {
      return
    }

    setTryRunTargetId(scriptId)
    setTryRunResult(null)
    setIsTryRunOpen(true)
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={title || data?.integration.title || t("integrations.detail.fallbackTitle", "Integration")}
        description={
          config?.description?.trim() || t("integrations.detail.noDescription", "No description configured.")
        }
        actions={
          data ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label={t("integrations.detail.actions", "Integration actions")}
                  />
                }
              >
                <EllipsisIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 min-w-44">
                <DropdownMenuItem onClick={() => void handleToggleEnabled()}>
                  <PowerIcon />
                  {data.integration.enabled
                    ? t("integrations.detail.disable", "Disable")
                    : t("integrations.detail.enable", "Enable")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} variant="destructive">
                  <Trash2Icon />
                  {t("confirmDelete.delete", "Delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
      />

      <div className="flex-1 overflow-x-hidden p-4">
        <div className="flex w-full min-w-0 flex-col gap-4">
          {isLoading || (!data && error) ? (
            <LoadingCard title={t("integrations.detail.loading", "Loading integration...")} />
          ) : null}
          {!isLoading && !data && error ? (
            <div className="flex justify-end">
              <Button variant="outline" onClick={reload}>
                <RefreshCcwIcon />
                {t("resource.error.retry", "Retry")}
              </Button>
            </div>
          ) : null}
          {!isLoading && data && config ? (
            <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
              <div className="min-w-0 space-y-3">
                <IntegrationBasicEditor
                  config={config}
                  title={title}
                  onChange={(nextConfig) => handleConfigChange(nextConfig)}
                  onTitleChange={setTitle}
                  onSave={() => void handleSave()}
                  saveDisabled={!hasUnsavedChanges || isSavingBasic || isPersistingNested}
                />
                {issues.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {issues.map((issue) => (
                      <p key={issue.message} className="text-sm text-muted-foreground">
                        {issue.message}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
              {config.kind === "http" ? (
                <IntegrationHttpEndpointsPanel
                  config={config as HttpIntegrationConfig}
                  canTryRun={canTryRun}
                  isSaving={isPersistingNested}
                  onChange={handleConfigChange}
                  onTryRun={openTryRunForHttpEndpoint}
                />
              ) : null}
              {config.kind === "scripts" ? (
                <IntegrationScriptWorkbench
                  config={config}
                  canTryRun={canTryRun}
                  isSaving={isPersistingNested}
                  onChange={handleConfigChange}
                  onTryRun={openTryRunForScript}
                />
              ) : null}
              {config.kind === "mcp" ? <IntegrationMcpToolsPanel config={config as McpIntegrationConfig} /> : null}
            </div>
          ) : null}
        </div>
      </div>

      {config ? (
        <IntegrationTryRunSheet
          input={runInput}
          isOpen={isTryRunOpen}
          isRunning={isRunning}
          result={tryRunResult}
          httpConfig={
            config.kind === "http"
              ? { ...config, selectedEndpointId: tryRunTargetId ?? config.selectedEndpointId }
              : undefined
          }
          scriptConfig={
            config.kind === "scripts"
              ? { ...config, selectedScriptId: tryRunTargetId ?? config.selectedScriptId }
              : undefined
          }
          onChangeInput={setRunInput}
          onOpenChange={(open) => {
            setIsTryRunOpen(open)
            if (!open) {
              setTryRunResult(null)
            }
          }}
          onRun={() => void handleRun()}
        />
      ) : null}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("integrations.detail.deleteTitle", "Delete integration?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "integrations.detail.deleteDescription",
                "This will permanently remove the integration, its versions, and execution history.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirmDelete.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void handleDelete()}>
              {t("confirmDelete.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default IntegrationsDetailPage
