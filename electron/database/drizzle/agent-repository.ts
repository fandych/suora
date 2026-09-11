import crypto from "node:crypto"
import { and, desc, eq, sql } from "drizzle-orm"
import { getDrizzleDatabase } from "@electron/database/drizzle/client"
import { agentVersions, agents, appMeta } from "@electron/database/drizzle/schema"

const defaultConfig = JSON.stringify({ instructions: "You are a helpful agent.", providerId: "provider-openai", modelId: "gpt-5", maxSteps: 100, workflowIds: [], skillIds: [], toolsetIds: [], documentIds: [] })

export async function listAgentsWithDrizzle() {
  return getDrizzleDatabase().select().from(agents).orderBy(desc(agents.updatedAt))
}

async function ensureVersion(agentId: string) {
  const database = getDrizzleDatabase()
  const existing = await database.select({ id: agentVersions.id }).from(agentVersions).where(eq(agentVersions.agentId, agentId)).limit(1)
  if (existing.length === 0) {
    await database.insert(agentVersions).values({ id: crypto.randomUUID(), agentId, major: 1, minor: 0, isRelease: false, configJson: defaultConfig, createdAt: Date.now() })
  }
}

export async function getAgentWithDrizzle(agentId: string, selectedVersionId?: string) {
  const database = getDrizzleDatabase()
  const [agent] = await database.select().from(agents).where(eq(agents.id, agentId)).limit(1)
  if (!agent) return { agent: null, versions: [] }
  await ensureVersion(agentId)
  const versions = await database.select().from(agentVersions).where(eq(agentVersions.agentId, agentId)).orderBy(desc(agentVersions.major), desc(agentVersions.minor), desc(agentVersions.createdAt))
  return { agent, versions, ...(selectedVersionId ? { selectedVersionId } : {}) }
}

export async function createAgentWithDrizzle() {
  const database = getDrizzleDatabase()
  const id = crypto.randomUUID()
  const now = Date.now()
  await database.insert(agents).values({ id, title: "New agent", kind: "custom", summary: "", updatedAt: now })
  await database.insert(agentVersions).values({ id: crypto.randomUUID(), agentId: id, major: 1, minor: 0, isRelease: false, configJson: defaultConfig, createdAt: now })
  return getAgentWithDrizzle(id)
}

export async function saveAgentWithDrizzle(payload: { id: string; title: string; kind?: string; summary: string; configJson?: string; selectedVersionId?: string; publish?: boolean }) {
  const database = getDrizzleDatabase()
  const now = Date.now()
  const configJson = payload.configJson || defaultConfig
  await database.insert(agents).values({ id: payload.id, title: payload.title, kind: payload.kind || "custom", summary: payload.summary, updatedAt: now }).onConflictDoUpdate({ target: agents.id, set: { title: payload.title, kind: payload.kind || "custom", summary: payload.summary, updatedAt: now } })
  const [draft] = payload.selectedVersionId ? await database.select().from(agentVersions).where(and(eq(agentVersions.agentId, payload.id), eq(agentVersions.id, payload.selectedVersionId))).limit(1) : []
  const [latest] = await database.select().from(agentVersions).where(eq(agentVersions.agentId, payload.id)).orderBy(desc(agentVersions.major), desc(agentVersions.minor), desc(agentVersions.createdAt)).limit(1)
  if (!payload.publish && draft && !draft.isRelease) {
    await database.update(agentVersions).set({ configJson, createdAt: now }).where(eq(agentVersions.id, draft.id))
  } else {
    await database.insert(agentVersions).values({ id: crypto.randomUUID(), agentId: payload.id, major: !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major, minor: !latest || latest.isRelease ? 0 : latest.minor + 1, isRelease: Boolean(payload.publish), configJson, createdAt: now })
  }
  return getAgentWithDrizzle(payload.id)
}

export async function deleteAgentWithDrizzle(agentId: string) {
  const database = getDrizzleDatabase()
  await database.delete(agentVersions).where(eq(agentVersions.agentId, agentId))
  await database.delete(agents).where(eq(agents.id, agentId))
  return { success: true }
}

export async function getAgentSettingWithDrizzle(key: string) {
  const database = getDrizzleDatabase()
  const [row] = await database.select({ value: appMeta.value }).from(appMeta).where(eq(appMeta.key, key)).limit(1)
  return row?.value ?? null
}

export async function saveAgentSettingWithDrizzle(key: string, value: unknown) {
  const database = getDrizzleDatabase()
  const serialized = JSON.stringify(value)
  await database.insert(appMeta).values({ key, value: serialized }).onConflictDoUpdate({ target: appMeta.key, set: { value: sql`excluded.value` } })
  return value
}
