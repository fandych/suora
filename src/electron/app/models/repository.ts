import crypto from "node:crypto"
import { desc, eq } from "drizzle-orm"
import { getDrizzleDatabase } from "@/drizzle/db"
import { providers } from "@/drizzle/schema"
import { protectCredential, revealCredentialState } from "@/electron/infrastructure/credential-vault"

async function migrateLegacyProviderCredential(providerId: string, apiKey: string) {
  await getDrizzleDatabase().update(providers).set({ apiKey: protectCredential(apiKey) }).where(eq(providers.id, providerId))
}

export async function listModels() {
  const rows = await getDrizzleDatabase().select().from(providers).orderBy(desc(providers.updatedAt))
  return rows.map((row) => {
    const credential = revealCredentialState(row.apiKey)
    if (credential.legacyPlaintext && credential.value) {
      void migrateLegacyProviderCredential(row.id, credential.value)
    }
    return { ...row, apiKey: credential.value }
  })
}

export async function getModel(providerId: string) {
  const [row] = await getDrizzleDatabase().select().from(providers).where(eq(providers.id, providerId)).limit(1)
  if (!row) return null
  const credential = revealCredentialState(row.apiKey)
  if (credential.legacyPlaintext && credential.value) {
    void migrateLegacyProviderCredential(providerId, credential.value)
  }
  return { ...row, apiKey: credential.value }
}

export async function createModel(payload: {
  title?: string
  description?: string
  providerType?: string
  baseUrl?: string
  apiKey?: string
  modelsJson?: string
  enabled?: boolean
}) {
  const database = getDrizzleDatabase()
  const id = crypto.randomUUID()
  await database
    .insert(providers)
    .values({
      id,
      title: payload.title || "New provider",
      description: payload.description || "",
      providerType: payload.providerType || "openai-compatible",
      baseUrl: payload.baseUrl || "",
      apiKey: protectCredential(payload.apiKey || ""),
      modelsJson: payload.modelsJson || "[]",
      enabled: payload.enabled !== false,
      updatedAt: Date.now(),
    })
  return getModel(id)
}

export async function saveModel(payload: {
  id: string
  title: string
  description: string
  providerType: string
  baseUrl: string
  apiKey: string
  apiKeyConfigured?: boolean
  modelsJson: string
  enabled: boolean
}) {
  const database = getDrizzleDatabase()
  const [existing] = await database
    .select({ id: providers.id, apiKey: providers.apiKey })
    .from(providers)
    .where(eq(providers.id, payload.id))
    .limit(1)
  const nextApiKey = payload.apiKey
    ? protectCredential(payload.apiKey)
    : payload.apiKeyConfigured !== false && typeof existing?.apiKey === "string"
      ? existing.apiKey
      : ""
  const values = {
    title: payload.title,
    description: payload.description,
    providerType: payload.providerType,
    baseUrl: payload.baseUrl,
    apiKey: nextApiKey,
    modelsJson: payload.modelsJson,
    enabled: payload.enabled,
    updatedAt: Date.now(),
  }
  if (existing) {
    await database.update(providers).set(values).where(eq(providers.id, payload.id))
  } else {
    await database.insert(providers).values({ id: payload.id, ...values })
  }
  return getModel(payload.id)
}

export async function deleteModel(providerId: string) {
  await getDrizzleDatabase().delete(providers).where(eq(providers.id, providerId))
  return { success: true }
}
