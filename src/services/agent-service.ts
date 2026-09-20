import { getVersionLabel } from "@/services/versioning"
import { requireAppBridge } from "@/services/bridge"
import type { AgentConfigRecord, AgentDetail, AgentSummary } from "@/types/agent"
import type { VersionOption } from "@/types/version"

type AgentVersionRow = {
  id: string
  major: number
  minor: number
  isRelease: boolean
  createdAt: number
  configJson: string
}

type AgentPayload = { agent: AgentSummary | null; versions: AgentVersionRow[] }

const mapVersions = (rows: AgentVersionRow[]) =>
  rows.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]

function toAgentDetail(payload: AgentPayload, selectedVersionId?: string): AgentDetail | null {
  if (!payload.agent) return null

  const versions = mapVersions(payload.versions)
  const row = payload.versions.find((version) => version.id === selectedVersionId) ?? payload.versions[0]
  if (!row || versions.length === 0) return null

  return {
    agent: payload.agent,
    versions,
    latestVersion: versions[0],
    selectedVersion: versions.find((version) => version.id === row.id) ?? versions[0],
    config: parseJson(row.configJson),
  }
}

function parseJson(value: string): AgentConfigRecord {
  try {
    return JSON.parse(value) as AgentConfigRecord
  } catch {
    return {
      instructions: "You are a helpful agent.",
      providerId: "provider-openai",
      modelId: "gpt-5",
      maxSteps: 100,
      workflowIds: [],
      skillIds: [],
      toolsetIds: [],
      documentIds: [],
      privateToolIds: [],
    }
  }
}

type AgentSavePayload = {
  id: string
  title: string
  kind: string
  summary: string
  config: AgentConfigRecord
  selectedVersionId?: string
  publish?: boolean
}

function parseSettings(value: string | null) {
  try {
    const parsed = value ? (JSON.parse(value) as { disabledSystemAgentIds?: unknown }) : {}
    return new Set(
      Array.isArray(parsed.disabledSystemAgentIds)
        ? parsed.disabledSystemAgentIds.filter((id): id is string => typeof id === "string")
        : [],
    )
  } catch {
    return new Set<string>()
  }
}

export const AgentApi = {
  listAll: (options?: { source?: "custom" | "system"; title?: string; isDisabled?: boolean }) =>
    requireAppBridge().agents.listAll(options) as Promise<AgentSummary[]>,
  listAvailable: () => AgentApi.listAll({ isDisabled: false }),
  get: async (agentId: string, versionId?: string) => {
    const detail = toAgentDetail((await requireAppBridge().agents.get(agentId)) as AgentPayload, versionId)
    return detail
  },
  create: async () => {
    const detail = toAgentDetail((await requireAppBridge().agents.create()) as AgentPayload)
    if (!detail) throw new Error("Failed to create agent.")
    return detail
  },
  save: async (payload: AgentSavePayload) => {
    const result = (await requireAppBridge().agents.save({
      ...payload,
      configJson: JSON.stringify(payload.config),
    })) as AgentPayload & { selectedVersionId: string | null }
    const detail = toAgentDetail(result, result.selectedVersionId ?? undefined)
    if (!detail) throw new Error("Failed to save agent.")
    return detail
  },
  remove: (agentId: string) => requireAppBridge().agents.delete(agentId),
  getSettings: () => requireAppBridge().agents.getSettings() as Promise<string | null>,
  saveSettings: (payload: unknown) => requireAppBridge().agents.saveSettings(payload),
}

export async function listAgents() {
  return AgentApi.listAll()
}
export async function getAgentDetail(agentId: string, selectedVersionId?: string) {
  return AgentApi.get(agentId, selectedVersionId)
}
export async function createAgent() {
  return AgentApi.create()
}
export async function saveAgentDraft(agent: AgentDetail, publish = false) {
  return AgentApi.save({
    id: agent.agent.id,
    title: agent.agent.title,
    kind: agent.agent.kind,
    summary: agent.agent.summary,
    config: agent.config,
    selectedVersionId: agent.selectedVersion.id,
    publish,
  })
}
export async function deleteAgent(agentId: string) {
  return AgentApi.remove(agentId)
}
export async function setSystemAgentDisabled(agentId: string, disabled: boolean) {
  const ids = parseSettings(await AgentApi.getSettings())
  if (disabled) ids.add(agentId)
  else ids.delete(agentId)
  const next = { disabledSystemAgentIds: [...ids].sort() }
  await AgentApi.saveSettings(next)
  return next
}
export async function listAvailableAgents() {
  return (await listAgents()).filter((agent) => !agent.isDisabled)
}

export type { AgentDetail, AgentSummary }
