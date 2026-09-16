import type { IntegrationDetail, IntegrationSummary } from "@/types/integration"
import type { IntegrationExecutionResult } from "@/types/integration"

export const IntegrationApi = {
  listAll: () => window.app!.integrations.list() as Promise<IntegrationSummary[]>,
  get: (integrationId: string, versionId?: string) =>
    window.app!.integrations.get(integrationId, versionId) as Promise<IntegrationDetail | null>,
  create: (payload?: unknown) => window.app!.integrations.create(payload) as Promise<IntegrationDetail>,
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
    window.app!.integrations.save({
      ...payload,
      endpoint: payload.endpoint ?? "",
      configJson: JSON.stringify(payload.config),
    }) as Promise<IntegrationDetail>,
  remove: (integrationId: string) => window.app!.integrations.delete(integrationId),
  setEnabled: (payload: { id: string; enabled: boolean }) =>
    window.app!.integrations.setEnabled(payload) as Promise<IntegrationSummary>,
  execute: (payload: unknown) => window.app!.integrations.execute(payload) as Promise<IntegrationExecutionResult>,
  fetchApiDoc: (sourceUrl: string) => window.app!.integrations.fetchApiDoc(sourceUrl),
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
