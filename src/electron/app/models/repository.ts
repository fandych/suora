import crypto from "node:crypto"
import { desc, eq } from "drizzle-orm"
import { getDrizzleDatabase } from "@/drizzle/db"
import { providers } from "@/drizzle/schema"
import { protectCredential, revealCredential } from "@/electron/infrastructure/credential-vault"

export async function listModels() {
  const rows = await getDrizzleDatabase().select().from(providers).orderBy(desc(providers.updatedAt))
  return rows.map((row) => ({ ...row, apiKey: revealCredential(row.apiKey) }))
}

export async function getModel(providerId: string) {
  const [row] = await getDrizzleDatabase().select().from(providers).where(eq(providers.id, providerId)).limit(1)
  return row ? { ...row, apiKey: revealCredential(row.apiKey) } : null
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
  modelsJson: string
  enabled: boolean
}) {
  const database = getDrizzleDatabase()
  await database
    .update(providers)
    .set({
      title: payload.title,
      description: payload.description,
      providerType: payload.providerType,
      baseUrl: payload.baseUrl,
      apiKey: protectCredential(payload.apiKey),
      modelsJson: payload.modelsJson,
      enabled: payload.enabled,
      updatedAt: Date.now(),
    })
    .where(eq(providers.id, payload.id))
  return getModel(payload.id)
}

export async function deleteModel(providerId: string) {
  await getDrizzleDatabase().delete(providers).where(eq(providers.id, providerId))
  return { success: true }
}
