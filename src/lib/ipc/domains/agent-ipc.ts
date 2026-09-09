import type { AgentConfigRecord, AgentDetail, AgentSummary, VersionOption } from "@/data/domain/models"
import { getVersionLabel } from "@/data/domain/versioning"
import { getProjectBridge } from "@/lib/ipc/bridge"
import { parseObjectJson } from "@/lib/serialization/json"
type AgentVersionRow = { id: string; major: number; minor: number; isRelease: boolean; createdAt: number; configJson: string }
type AgentPayload = { agent: AgentSummary | null; versions: AgentVersionRow[] }
const defaultConfig = (): AgentConfigRecord => ({ instructions: "You are a helpful agent.", providerId: "provider-openai", modelId: "gpt-5", maxSteps: 100, workflowIds: [], skillIds: [], toolsetIds: [], documentIds: [], privateToolIds: [] })
const mapVersions = (rows: AgentVersionRow[]) => rows.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]
export const agentIpc = {
  list: async () => getProjectBridge().agents.list() as Promise<AgentSummary[]>,
  get: async (id: string, selectedVersionId?: string) => { const payload = await getProjectBridge().agents.get(id) as AgentPayload; if (!payload.agent) return null; const versions = mapVersions(payload.versions); const row = payload.versions.find((version) => version.id === selectedVersionId) ?? payload.versions[0]; if (!row || versions.length === 0) { const fallback = { id: "draft", major: 1, minor: 0, isRelease: false, createdAt: Date.now(), label: "v1.0-draft" } satisfies VersionOption; return { agent: payload.agent, versions: [fallback], latestVersion: fallback, selectedVersion: fallback, config: defaultConfig() } satisfies AgentDetail } return { agent: payload.agent, versions, latestVersion: versions[0], selectedVersion: versions.find((version) => version.id === row.id) ?? versions[0], config: parseObjectJson<AgentConfigRecord>(row.configJson, defaultConfig()) } satisfies AgentDetail },
  create: async () => { const payload = await getProjectBridge().agents.create() as AgentPayload; const versions = mapVersions(payload.versions); return { agent: payload.agent as AgentSummary, versions, latestVersion: versions[0], selectedVersion: versions[0], config: parseObjectJson<AgentConfigRecord>(payload.versions[0]?.configJson, defaultConfig()) } satisfies AgentDetail },
  save: async (payload: { id: string; title: string; kind: string; summary: string; config: AgentConfigRecord; selectedVersionId?: string; publish?: boolean }) => { const result = await getProjectBridge().agents.save({ ...payload, configJson: JSON.stringify(payload.config) }) as AgentPayload & { selectedVersionId: string | null }; const versions = mapVersions(result.versions); const row = result.versions.find((version) => version.id === result.selectedVersionId) ?? result.versions[0]; return { agent: result.agent as AgentSummary, versions, latestVersion: versions[0], selectedVersion: versions.find((version) => version.id === row.id) ?? versions[0], config: parseObjectJson<AgentConfigRecord>(row.configJson, defaultConfig()) } satisfies AgentDetail },
  delete: async (id: string) => getProjectBridge().agents.delete(id),
  getSettings: async () => getProjectBridge().agents.getSettings() as Promise<string | null>,
  saveSettings: async (payload: unknown) => getProjectBridge().agents.saveSettings(payload),
}
