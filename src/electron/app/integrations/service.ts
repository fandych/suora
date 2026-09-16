import {
  assertIntegrationEnabled,
  createIntegration,
  deleteIntegration,
  getIntegration,
  listIntegrations,
  recordIntegrationExecution,
  saveIntegration,
  setIntegrationEnabled,
} from "@/electron/app/integrations/repository"
import { executeIntegration } from "@/electron/app/integrations/executor"
import { normalizeIntegrationConfig } from "@/electron/app/integrations/config-normalizer"

type VersionRow = {
  id: string
  major: number
  minor: number
  isRelease: boolean
  createdAt: number
  configJson: string
}
type IntegrationRow = {
  id: string
  title: string
  kind: string
  endpoint: string
  enabled: boolean | number
  updatedAt: number
}
type ExecutionRow = {
  id: string
  versionId: string
  status: string
  inputJson: string
  outputJson: string
  createdAt: number
}
type IntegrationConfig = Record<string, unknown>

function parseConfig(value: string | undefined): IntegrationConfig {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === "object" ? (parsed as IntegrationConfig) : {}
  } catch {
    return {}
  }
}

function normalizeConfig(kind: string, configJson: string) {
  return JSON.stringify(normalizeIntegrationConfig(kind, parseConfig(configJson)))
}

function toDetail(
  payload: { integration: IntegrationRow | null; versions: VersionRow[]; executions: ExecutionRow[] },
  selectedVersionId?: string,
) {
  if (!payload.integration) return null
  const versions = payload.versions.map((version) => ({
    ...version,
    label: `${version.major}.${version.minor}${version.isRelease ? " (Release)" : ""}`,
  }))
  const selected = payload.versions.find((version) => version.id === selectedVersionId) ?? payload.versions[0]
  return {
    integration: { ...payload.integration, enabled: Boolean(payload.integration.enabled) },
    versions,
    latestVersion: versions[0],
    selectedVersion: versions.find((version) => version.id === selected?.id) ?? versions[0],
    config: normalizeIntegrationConfig(payload.integration.kind, parseConfig(selected?.configJson)),
    executions: payload.executions.map((execution) => ({
      id: execution.id,
      versionId: execution.versionId,
      status: execution.status,
      input: execution.inputJson,
      output: execution.outputJson,
      createdAt: execution.createdAt,
    })),
  }
}

export const integrationApplicationService = {
  list: async () => (await listIntegrations()).map((item) => ({ ...item, enabled: Boolean(item.enabled) })),
  get: (integrationId: string, versionId?: string) =>
    getIntegration(integrationId).then((payload) => toDetail(payload, versionId)),
  create: (payload?: { kind?: string; title?: string; endpoint?: string; configJson?: string }) =>
    createIntegration(payload).then((result) => toDetail(result)),
  save: (payload: {
    id: string
    title: string
    kind: string
    endpoint: string
    configJson: string
    enabled?: boolean
    selectedVersionId?: string
    publish?: boolean
  }) =>
    saveIntegration({ ...payload, configJson: normalizeConfig(payload.kind, payload.configJson) }).then(
      (result) => toDetail(result, payload.selectedVersionId),
    ),
  setEnabled: (payload: { id: string; enabled: boolean }) =>
    setIntegrationEnabled(payload.id, payload.enabled).then(
      (result) => result && { ...result, enabled: Boolean(result.enabled) },
    ),
  remove: (integrationId: string) => deleteIntegration(integrationId),
  execute: async (payload: {
    integrationId?: string
    kind: "http" | "scripts" | "mcp"
    config: IntegrationConfig
    inputJson?: string
  }) => {
    if (payload.integrationId) await assertIntegrationEnabled(payload.integrationId)
    return executeIntegration(payload)
  },
  recordExecution: (payload: { id: string; versionId: string; status: string; input: string; output: string }) =>
    recordIntegrationExecution(payload),
}
