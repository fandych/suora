import type { VersionOption, WorkflowDefinition, WorkflowDetail, WorkflowInvocationRecord, WorkflowSummary } from "@/data/domain/models"
import { getVersionLabel } from "@/data/domain/versioning"
import { getProjectBridge } from "@/lib/ipc/bridge"
import { parseArrayJson, parseJson } from "@/lib/serialization/json"
import { normalizeWorkflowDefinition } from "@/data/domain/workflows/workflow-definition-normalizer"
type VersionRow = { id: string; major: number; minor: number; isRelease: boolean; createdAt: number; definitionJson: string }
type InvocationRow = { id: string; versionId: string; status: string; trigger: string; input: string; output: string; traceJson: string; createdAt: number }
type Payload = { workflow: WorkflowSummary | null; versions: VersionRow[]; invocations: InvocationRow[] }
const map = (payload: Payload, selectedId?: string): WorkflowDetail | null => { if (!payload.workflow) return null; const versions = payload.versions.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]; const row = payload.versions.find((version) => version.id === selectedId) ?? payload.versions[0]; return { workflow: payload.workflow, versions, latestVersion: versions[0], selectedVersion: versions.find((version) => version.id === row?.id) ?? versions[0], definition: normalizeWorkflowDefinition(parseJson(row?.definitionJson, { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } } as WorkflowDefinition)), invocations: payload.invocations.map((item) => ({ ...item, traces: parseArrayJson<WorkflowInvocationRecord["traces"][number]>(item.traceJson, []) })) } }
export const workflowIpc = {
  list: async () => getProjectBridge().workflows.list() as Promise<WorkflowSummary[]>,
  get: async (id: string, versionId?: string) => map(await getProjectBridge().workflows.get(id) as Payload, versionId),
  create: async () => map(await getProjectBridge().workflows.create() as Payload) as WorkflowDetail,
  save: async (payload: { id: string; title: string; summary: string; definition: WorkflowDefinition; selectedVersionId?: string; publish?: boolean }) => map(await getProjectBridge().workflows.save({ ...payload, definitionJson: JSON.stringify(payload.definition) }) as Payload, payload.selectedVersionId) as WorkflowDetail,
  delete: async (id: string) => getProjectBridge().workflows.delete(id) as Promise<boolean>,
  recordInvocation: async (payload: { workflowId: string; versionId: string; status: string; trigger: string; input: string; output: string; traceJson: string }) => getProjectBridge().workflows.recordInvocation(payload) as Promise<InvocationRow[]>,
}
