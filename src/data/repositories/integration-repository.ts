import type {
  HttpIntegrationConfig,
  IntegrationConfig,
  IntegrationDetail,
  IntegrationSummary,
  McpIntegrationConfig,
  ScriptIntegrationConfig,
} from "@/data/domain/models"
import { executeIntegration } from "@/data/repositories/integration-execution-repository"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { suoraIpc } from "@/lib/ipc"

function getDefaultConfig(kind: string): IntegrationConfig {
  if (kind === "mcp") {
    return {
      kind: "mcp",
      endpoint: "",
      launchCommand: "",
      protocols: ["stdio"],
      authModes: ["none"],
      authConfigJson: "{}",
    } satisfies McpIntegrationConfig
  }

  if (kind === "scripts") {
    return {
      kind: "scripts",
      runtime: "node",
      timeoutMs: 30000,
      inputSchemaJson: "{\n  \"type\": \"object\",\n  \"properties\": {}\n}",
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

  return {
    kind: "http",
    method: "POST",
    url: "",
    description: "",
    headersJson: "{}",
    queryJson: "{}",
    bodyJson: "{}",
    authType: "none",
    authConfigJson: "{}",
    parameterSchemaJson: "{\n  \"type\": \"object\",\n  \"properties\": {}\n}",
  } satisfies HttpIntegrationConfig
}

function getConfigEndpoint(config: IntegrationConfig) {
  switch (config.kind) {
    case "http":
      return config.url
    case "mcp":
      return config.endpoint || config.launchCommand
    case "scripts":
      return config.scripts.find((item) => item.id === config.selectedScriptId)?.handler || config.scripts[0]?.handler || ""
  }
}

function normalizeIntegrationConfig(config: IntegrationConfig): IntegrationConfig {
  if (config.kind === "http") {
    return {
      ...getDefaultConfig("http"),
      ...config,
    } as HttpIntegrationConfig
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
      scripts,
      selectedScriptId: maybeLegacy.selectedScriptId || scripts[0].id,
      outputSchemaJson: maybeLegacy.outputSchemaJson || fallback.outputSchemaJson,
    } as ScriptIntegrationConfig
  }

  return {
    ...getDefaultConfig("mcp"),
    ...config,
  } as McpIntegrationConfig
}

function validateIntegrationConfig(config: IntegrationConfig) {
  if (config.kind === "http") {
    if (!config.url.trim()) {
      throw new Error("HTTP integration URL is required.")
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
  return suoraIpc.integrations.list() as Promise<IntegrationSummary[]>
}

export async function getIntegrationDetail(integrationId: string, selectedVersionId?: string) {
  await ensureSeeded()
  const detail = await suoraIpc.integrations.get(integrationId) as IntegrationDetail | null
  if (!detail) {
    throw new Error(`Integration ${integrationId} was not found.`)
  }
  if (!selectedVersionId || detail.selectedVersion.id === selectedVersionId) {
    return { ...detail, config: normalizeIntegrationConfig(detail.config) }
  }
  const selectedVersion = detail.versions.find((version) => version.id === selectedVersionId) ?? detail.selectedVersion
  return { ...detail, selectedVersion, config: normalizeIntegrationConfig(detail.config) }
}

export async function createIntegration(kind: IntegrationConfig["kind"] = "http") {
  await ensureSeeded()
  const config = getDefaultConfig(kind)
  return suoraIpc.integrations.create({ kind, title: `New ${kind} integration`, endpoint: getConfigEndpoint(config), configJson: JSON.stringify(config) }) as Promise<IntegrationDetail>
}

export async function saveIntegrationDraft(integrationId: string, payload: { title: string; kind: IntegrationConfig["kind"]; config: IntegrationConfig }) {
  await ensureSeeded()
  validateIntegrationConfig(payload.config)
  return suoraIpc.integrations.save({ id: integrationId, title: payload.title, kind: payload.kind, endpoint: getConfigEndpoint(payload.config), config: payload.config }) as Promise<IntegrationDetail>
}

export async function publishIntegrationVersion(integrationId: string, versionId: string) {
  await ensureSeeded()
  const detail = await getIntegrationDetail(integrationId, versionId)
  return suoraIpc.integrations.save({ id: integrationId, title: detail.integration.title, kind: detail.integration.kind, endpoint: detail.integration.endpoint, config: detail.config, publish: true }) as Promise<IntegrationDetail>
}

export async function runIntegrationAndPersist(integrationId: string, selectedVersionId?: string, inputJson = "{}") {
  await ensureSeeded()
  const snapshot = await getIntegrationDetail(integrationId, selectedVersionId)
  validateIntegrationConfig(snapshot.config)
  const result = await executeIntegration(snapshot.config, inputJson)
  await suoraIpc.integrations.recordExecution({ id: integrationId, versionId: snapshot.selectedVersion.id, status: result.ok ? "success" : "error", input: inputJson, output: result.body })
  const detail = await getIntegrationDetail(integrationId, selectedVersionId)
  return { detail, result }
}