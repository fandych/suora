import type { IntegrationDetail, IntegrationSummary } from "@/types/integration"
import type { IntegrationExecutionResult } from "@/types/integration"
import { requireAppBridge } from "@/services/bridge"

export const IntegrationApi = {
  listAll: () => requireAppBridge().integrations.list() as Promise<IntegrationSummary[]>,
  get: (integrationId: string, versionId?: string) =>
    requireAppBridge().integrations.get(integrationId, versionId) as Promise<IntegrationDetail | null>,
  create: (payload?: unknown) => requireAppBridge().integrations.create(payload) as Promise<IntegrationDetail>,
  save: (payload: {
    id: string
    title: string
    kind: string
    endpoint?: string
    config: unknown
    enabled?: boolean
    selectedVersionId?: string
    publish?: boolean
  }) =>
    requireAppBridge().integrations.save({
      ...payload,
      endpoint: payload.endpoint ?? "",
      configJson: JSON.stringify(payload.config),
    }) as Promise<IntegrationDetail>,
  remove: (integrationId: string) => requireAppBridge().integrations.delete(integrationId),
  setEnabled: (payload: { id: string; enabled: boolean }) =>
    requireAppBridge().integrations.setEnabled(payload) as Promise<IntegrationSummary>,
  execute: (payload: unknown) => requireAppBridge().integrations.execute(payload) as Promise<IntegrationExecutionResult>,
  recordExecution: (payload: { id: string; versionId: string; status: string; input: string; output: string }) =>
    requireAppBridge().integrations.recordExecution(payload),
  fetchApiDoc: (sourceUrl: string) => requireAppBridge().integrations.fetchApiDoc(sourceUrl),
}

export const listIntegrationSummaries = IntegrationApi.listAll
export const getIntegrationDetail = async (integrationId: string, versionId?: string) => {
  const detail = await IntegrationApi.get(integrationId, versionId)
  if (!detail) throw new Error(`Integration ${integrationId} was not found.`)
  return detail
}
export const createIntegration = (kind: string = "http") => IntegrationApi.create({ kind })
export const saveIntegrationDraft = (
  integrationId: string,
  payload: { title: string; kind: string; config: unknown; enabled?: boolean; selectedVersionId?: string },
) => IntegrationApi.save({ ...payload, id: integrationId, endpoint: "" })
export const deleteIntegration = async (integrationId: string) => {
  const result = (await IntegrationApi.remove(integrationId)) as { ok?: boolean }
  if (!result.ok) throw new Error(`Integration ${integrationId} was not found.`)
}
export const setIntegrationEnabled = (integrationId: string, enabled: boolean) =>
  IntegrationApi.setEnabled({ id: integrationId, enabled })
export const executeIntegration = (config: unknown, inputJson = "{}", integrationId?: string) =>
  IntegrationApi.execute({
    ...(integrationId ? { integrationId } : {}),
    kind: (config as { kind: "http" | "scripts" | "mcp" }).kind,
    config,
    inputJson,
  })
export const runIntegrationAndPersist = (integrationId: string, _selectedVersionId?: string, inputJson = "{}") =>
  IntegrationApi.execute({ integrationId, inputJson })

export type { IntegrationDetail, IntegrationSummary }
