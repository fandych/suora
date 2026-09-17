import type { VersionOption } from "@/types/version"
import type {
  WorkflowDefinition,
  WorkflowDetail,
  WorkflowInvocationRecord,
  WorkflowRunAccepted,
  WorkflowRunEvent,
  WorkflowRunStartCommand,
  WorkflowSummary,
} from "@/types/workflow"
import { getVersionLabel } from "@/services/versioning"
import { parseArrayJson, parseJson } from "@/lib/serialization/json"

export const WorkflowApi = {
  listAll: () => window.app!.workflows.list() as Promise<WorkflowSummary[]>,
  get: async (workflowId: string, versionId?: string) => {
    const payload = (await window.app!.workflows.get(workflowId, versionId)) as {
      workflow: WorkflowSummary | null
      versions: Array<
        WorkflowDefinition & {
          definitionJson?: string
          id: string
          major: number
          minor: number
          isRelease: boolean
          createdAt: number
        }
      >
      invocations: Array<WorkflowInvocationRecord & { traceJson?: string }>
    }
    if (!payload.workflow) return null
    const versions = payload.versions.map((version) => ({
      ...version,
      label: getVersionLabel(version),
    })) as VersionOption[]
    const selected = payload.versions.find((version) => version.id === versionId) ?? payload.versions[0]
    return {
      workflow: payload.workflow,
      versions,
      latestVersion: versions[0],
      selectedVersion: versions.find((version) => version.id === selected?.id) ?? versions[0],
      definition: parseJson(selected?.definitionJson, {
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      } as WorkflowDefinition),
      invocations: payload.invocations.map((item) => ({
        ...item,
        traces: parseArrayJson<WorkflowInvocationRecord["traces"][number]>(item.traceJson, []),
      })),
    } satisfies WorkflowDetail
  },
  create: () => window.app!.workflows.create() as Promise<WorkflowDetail>,
  save: (payload: {
    id: string
    title: string
    summary: string
    enabled?: boolean
    definition: WorkflowDefinition
    selectedVersionId?: string
    publish?: boolean
  }) =>
    window.app!.workflows.save({
      ...payload,
      definitionJson: JSON.stringify(payload.definition),
    }) as Promise<WorkflowDetail>,
  remove: (workflowId: string) => window.app!.workflows.delete(workflowId),
  run: (payload: WorkflowRunStartCommand) => window.app!.workflows.startRun(payload) as Promise<WorkflowRunAccepted>,
  cancelRun: (requestId: string) => window.app!.workflows.cancelRun(requestId),
  onRunEvent: (listener: (event: WorkflowRunEvent) => void) => {
    const bridgeListener = (_event: Electron.IpcRendererEvent, event: WorkflowRunEvent) => listener(event)
    window.app!.workflows.onRunEvent(bridgeListener)
    return bridgeListener
  },
  offRunEvent: (listener: (_event: Electron.IpcRendererEvent, event: WorkflowRunEvent) => void) =>
    window.app!.workflows.offRunEvent(listener),
}

export const listWorkflows = WorkflowApi.listAll
export const getWorkflowDetail = async (workflowId: string, selectedVersionId?: string) => {
  const detail = await WorkflowApi.get(workflowId, selectedVersionId)
  if (!detail) throw new Error(`Workflow ${workflowId} was not found.`)
  return detail
}
export const saveWorkflowDraft = (
  workflowId: string,
  payload: { title: string; summary: string; definition: WorkflowDefinition; selectedVersionId?: string },
) => WorkflowApi.save({ ...payload, id: workflowId })
export const deleteWorkflow = WorkflowApi.remove
export const publishWorkflowVersion = async (workflowId: string, versionId: string) => {
  const detail = await getWorkflowDetail(workflowId, versionId)
  return WorkflowApi.save({
    id: workflowId,
    title: detail.workflow.title,
    summary: detail.workflow.summary,
    definition: detail.definition,
    selectedVersionId: detail.selectedVersion.id,
    publish: true,
  })
}
export const createWorkflow = WorkflowApi.create
export const runWorkflow = (
  workflowId: string,
  selectedVersionId: string,
  definition: WorkflowDefinition,
  input: unknown,
) =>
  WorkflowApi.run({
    requestId: crypto.randomUUID(),
    workflowId,
    versionId: selectedVersionId,
    definition,
    input,
    mode: "manual",
  })
export const dryRunWorkflowSnapshot = (input: {
  requestId: string
  workflowId: string
  versionId: string
  definition: WorkflowDefinition
  input: unknown
  mode: "dry-run" | "manual"
}) => WorkflowApi.run(input)

export type { WorkflowDetail, WorkflowSummary }
export type { WorkflowInvocationRecord }
