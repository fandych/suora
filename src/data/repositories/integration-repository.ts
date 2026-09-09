import type {
  IntegrationConfig,
  IntegrationDetail,
  IntegrationSummary,
  McpIntegrationConfig,
  ScriptIntegrationConfig,
} from "@/data/domain/models"
import { executeIntegration } from "@/data/repositories/integration-execution-repository"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { projectIpc } from "@/lib/ipc"
import { buildHttpEndpointUrl, createDefaultHttpIntegrationConfig, getSelectedHttpEndpoint, normalizeHttpIntegrationConfig, readMcpTools, DEFAULT_PARAMETER_SCHEMA_JSON } from "@/data/domain/integrations"

function getDefaultConfig(kind: string): IntegrationConfig {
  if (kind === "mcp") {
    return {
      kind: "mcp",
      description: "",
      endpoint: "",
      launchCommand: "",
      protocols: ["stdio"],
      authModes: ["none"],
      authConfigJson: "{}",
      toolCatalogJson: "[]",
      tools: [],
    } satisfies McpIntegrationConfig
  }

  if (kind === "scripts") {
    return {
      kind: "scripts",
      description: "",
      runtime: "node",
      timeoutMs: 30000,
      inputSchemaJson: DEFAULT_PARAMETER_SCHEMA_JSON,
      outputSchemaJson: "{\n  \"type\": \"object\"\n}",
      selectedScriptId: "script-main",
      scripts: [
        {
          id: "script-main",
          name: "Main Script",
          handler: "main",
          code: "export async function main(input) {\n  return { ok: true, input }\n}\n",
        },
      ],
    } satisfies ScriptIntegrationConfig
  }

  return createDefaultHttpIntegrationConfig()
}

function getConfigEndpoint(config: IntegrationConfig) {
  switch (config.kind) {
    case "http":
      return buildHttpEndpointUrl(config.baseUrl, getSelectedHttpEndpoint(config)?.path ?? "/")
    case "mcp":
      return config.endpoint || config.launchCommand
    case "scripts":
      return config.scripts.find((item) => item.id === config.selectedScriptId)?.handler || config.scripts[0]?.handler || ""
  }
}

function normalizeIntegrationConfig(config: IntegrationConfig): IntegrationConfig {
  if (config.kind === "http") {
    return normalizeHttpIntegrationConfig(config)
  }

  if (config.kind === "scripts") {
    const fallback = getDefaultConfig("scripts") as ScriptIntegrationConfig
    const maybeLegacy = config as ScriptIntegrationConfig & { handler?: string; code?: string }
    const scripts = maybeLegacy.scripts?.length
      ? maybeLegacy.scripts
      : [{ id: "script-main", name: "Main Script", handler: maybeLegacy.handler || "main", code: maybeLegacy.code || fallback.scripts[0].code }]

    return {
      ...fallback,
      ...config,
      description: maybeLegacy.description ?? fallback.description,
      scripts,
      selectedScriptId: maybeLegacy.selectedScriptId || scripts[0].id,
      outputSchemaJson: maybeLegacy.outputSchemaJson || fallback.outputSchemaJson,
    } as ScriptIntegrationConfig
  }

  return {
    ...getDefaultConfig("mcp"),
    ...config,
    description: (config as Partial<McpIntegrationConfig>).description ?? "",
    toolCatalogJson: (config as Partial<McpIntegrationConfig>).toolCatalogJson ?? "[]",
    tools: readMcpTools((config as Partial<McpIntegrationConfig>).toolCatalogJson ?? "[]"),
  } as McpIntegrationConfig
}

function validateIntegrationConfig(config: IntegrationConfig) {
  if (config.kind === "http") {
    if (!config.baseUrl.trim()) {
      throw new Error("HTTP integration base URL is required.")
    }
    if (!config.endpoints.every((endpoint) => endpoint.path.trim())) {
      throw new Error("Every HTTP endpoint requires a path.")
    }
    return
  }

  if (config.kind === "scripts") {
    if (!config.scripts.length) {
      throw new Error("At least one script is required.")
    }
    const selectedScript = config.scripts.find((item) => item.id === config.selectedScriptId)
    if (!selectedScript) {
      throw new Error("A selected script is required.")
    }
    return
  }

  if (!config.endpoint.trim() && !config.launchCommand.trim()) {
    throw new Error("MCP integration requires either an endpoint or a launch command.")
  }
  if (config.protocols.length === 0) {
    throw new Error("MCP integration requires at least one protocol.")
  }
  if (config.authModes.length === 0) {
    throw new Error("MCP integration requires at least one auth mode.")
  }
}

export async function listIntegrationSummaries() {
  await ensureSeeded()
  const summaries = await projectIpc.integrations.list() as IntegrationSummary[]
  return summaries.map((summary) => ({ ...summary, enabled: Boolean(summary.enabled) }))
}

export async function getIntegrationDetail(integrationId: string, selectedVersionId?: string) {
  await ensureSeeded()
  const detail = await projectIpc.integrations.get(integrationId, selectedVersionId) as IntegrationDetail | null
  if (!detail) {
    throw new Error(`Integration ${integrationId} was not found.`)
  }
  return { ...detail, integration: { ...detail.integration, enabled: Boolean(detail.integration.enabled) }, config: normalizeIntegrationConfig(detail.config) }
}

export async function createIntegration(kind: IntegrationConfig["kind"] = "http") {
  await ensureSeeded()
  const config = getDefaultConfig(kind)
  return projectIpc.integrations.create({ kind, title: `New ${kind} integration`, endpoint: getConfigEndpoint(config), configJson: JSON.stringify(config) }) as Promise<IntegrationDetail>
}

export async function saveIntegrationDraft(integrationId: string, payload: { title: string; kind: IntegrationConfig["kind"]; config: IntegrationConfig; enabled?: boolean; selectedVersionId?: string }) {
  await ensureSeeded()
  validateIntegrationConfig(payload.config)
  return projectIpc.integrations.save({ id: integrationId, title: payload.title, kind: payload.kind, endpoint: getConfigEndpoint(payload.config), config: payload.config, enabled: payload.enabled, selectedVersionId: payload.selectedVersionId }) as Promise<IntegrationDetail>
}

export async function deleteIntegration(integrationId: string) {
  await ensureSeeded()
  const result = await projectIpc.integrations.delete(integrationId) as { ok: boolean }
  if (!result.ok) {
    throw new Error(`Integration ${integrationId} was not found.`)
  }
}

export async function setIntegrationEnabled(integrationId: string, enabled: boolean) {
  await ensureSeeded()
  const summary = await projectIpc.integrations.setEnabled({ id: integrationId, enabled })
  if (!summary) {
    throw new Error(`Integration ${integrationId} was not found.`)
  }
  return { ...summary, enabled: Boolean(summary.enabled) }
}

export async function runIntegrationAndPersist(integrationId: string, selectedVersionId?: string, inputJson = "{}", selectedEntryId?: string) {
  await ensureSeeded()
  const snapshot = await getIntegrationDetail(integrationId, selectedVersionId)
  const runtimeConfig = snapshot.config.kind === "http" && selectedEntryId
    ? { ...snapshot.config, selectedEndpointId: selectedEntryId }
    : snapshot.config.kind === "scripts" && selectedEntryId
      ? { ...snapshot.config, selectedScriptId: selectedEntryId }
      : snapshot.config
  validateIntegrationConfig(runtimeConfig)
  const targetExists = runtimeConfig.kind === "http"
    ? runtimeConfig.endpoints.some((endpoint) => endpoint.id === runtimeConfig.selectedEndpointId)
    : runtimeConfig.kind === "scripts"
      ? runtimeConfig.scripts.some((script) => script.id === runtimeConfig.selectedScriptId)
      : true
  const result = targetExists
    ? await executeIntegration(runtimeConfig, inputJson)
    : { ok: false, status: 400, body: "The selected entry is not available in this saved version. Save the draft and try again." }
  await projectIpc.integrations.recordExecution({ id: integrationId, versionId: snapshot.selectedVersion.id, status: result.ok ? "success" : "error", input: inputJson, output: result.body })
  const detail = await getIntegrationDetail(integrationId, selectedVersionId)
  return { detail, result }
}