import type { ProviderConfigRecord } from "@/data/domain/models"
import { getSuoraBridge } from "@/lib/ipc-utils"
import { parseArrayJson } from "@/lib/ipc-utils"

type RawProviderRow = {
  id: string
  title: string
  providerType: string
  baseUrl: string
  apiKey: string
  modelsJson: string
  enabled: number | boolean
  updatedAt: number
}

function parseProviderRow(row: RawProviderRow): ProviderConfigRecord {
  return { id: row.id, title: row.title, providerType: row.providerType, baseUrl: row.baseUrl, apiKey: row.apiKey, enabled: Boolean(row.enabled), models: parseArrayJson(row.modelsJson, []), updatedAt: row.updatedAt }
}

export const modelIpc = {
  list: async () => (await getSuoraBridge().models.list() as RawProviderRow[]).map(parseProviderRow),
  get: async (providerId: string) => {
    const row = await getSuoraBridge().models.get(providerId) as RawProviderRow | null
    return row ? parseProviderRow(row) : null
  },
  create: async (payload?: Partial<ProviderConfigRecord>) => parseProviderRow(await getSuoraBridge().models.create(payload) as RawProviderRow),
  save: async (provider: ProviderConfigRecord) => parseProviderRow(await getSuoraBridge().models.save({ ...provider, modelsJson: JSON.stringify(provider.models) }) as RawProviderRow),
  delete: async (providerId: string) => getSuoraBridge().models.delete(providerId),
  discover: async (payload: Pick<ProviderConfigRecord, "providerType" | "baseUrl" | "apiKey">) => getSuoraBridge().models.discover(payload) as Promise<{ models: ProviderConfigRecord["models"]; source: string }>,
}
