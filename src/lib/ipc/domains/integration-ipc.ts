import type { IntegrationConfig, IntegrationDetail, IntegrationExecutionRecord, IntegrationSummary, VersionOption } from "@/data/domain/models"
import { getVersionLabel } from "@/data/domain/versioning"
import { getProjectBridge } from "@/lib/ipc/bridge"
import { parseObjectJson } from "@/lib/serialization/json"
type VersionRow = { id: string; major: number; minor: number; isRelease: boolean; createdAt: number; configJson: string }
type Payload = { integration: IntegrationSummary | null; versions: VersionRow[]; executions: IntegrationExecutionRecord[] }
const fallback = (): IntegrationConfig => ({ kind: "http", baseUrl: "", selectedEndpointId: "", endpoints: [], method: "GET", url: "", description: "", headersJson: "{}", queryJson: "{}", bodyJson: "{}", authType: "none", authConfigJson: "{}", parameterSchemaJson: "{}" })
const versions = (rows: VersionRow[]) => rows.map((row) => ({ ...row, label: getVersionLabel(row) })) as VersionOption[]
const detail = (payload: Payload, selectedId?: string): IntegrationDetail | null => { if (!payload.integration) return null; const mapped = versions(payload.versions); const row = payload.versions.find((item) => item.id === selectedId) ?? payload.versions[0]; return { integration: { ...payload.integration, enabled: Boolean(payload.integration.enabled) }, versions: mapped, latestVersion: mapped[0], selectedVersion: mapped.find((item) => item.id === row?.id) ?? mapped[0], config: parseObjectJson<IntegrationConfig>(row?.configJson, fallback()), executions: payload.executions } }
export const integrationIpc = {
  list: async () => (await getProjectBridge().integrations.list() as IntegrationSummary[]).map((row) => ({ ...row, enabled: Boolean(row.enabled) })),
  get: async (id: string, versionId?: string) => detail(await getProjectBridge().integrations.get(id) as Payload, versionId),
  create: async (payload?: Partial<IntegrationSummary & { configJson: string }>) => detail(await getProjectBridge().integrations.create(payload) as Payload) as IntegrationDetail,
  fetchApiDoc: async (url: string) => getProjectBridge().integrations.fetchApiDoc(url) as Promise<string>,
  save: async (payload: { id: string; title: string; kind: string; endpoint: string; config: IntegrationConfig; enabled?: boolean; selectedVersionId?: string; publish?: boolean }) => detail(await getProjectBridge().integrations.save({ ...payload, configJson: JSON.stringify(payload.config) }) as Payload, payload.selectedVersionId) as IntegrationDetail,
  setEnabled: async (payload: { id: string; enabled: boolean }) => { const result = await getProjectBridge().integrations.setEnabled(payload) as IntegrationSummary; return { ...result, enabled: Boolean(result.enabled) } },
  delete: async (id: string) => getProjectBridge().integrations.delete(id),
  recordExecution: async (payload: { id: string; versionId: string; status: string; input: string; output: string }) => getProjectBridge().integrations.recordExecution(payload) as Promise<IntegrationExecutionRecord[]>,
  execute: async (payload: unknown) => getProjectBridge().integrations.execute(payload),
}
