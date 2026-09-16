import crypto from "node:crypto"
import { and, desc, eq } from "drizzle-orm"
import { getDrizzleDatabase } from "@/drizzle/db"
import { integrationExecutions, integrationVersions, integrations } from "@/drizzle/schema"

export async function listIntegrations() {
  return getDrizzleDatabase().select().from(integrations).orderBy(desc(integrations.updatedAt))
}

export async function getIntegration(id: string) {
  const database = getDrizzleDatabase()
  const [integration] = await database.select().from(integrations).where(eq(integrations.id, id)).limit(1)
  const versions = await database
    .select()
    .from(integrationVersions)
    .where(eq(integrationVersions.integrationId, id))
    .orderBy(desc(integrationVersions.major), desc(integrationVersions.minor), desc(integrationVersions.createdAt))
  const executions = await database
    .select()
    .from(integrationExecutions)
    .where(eq(integrationExecutions.integrationId, id))
    .orderBy(desc(integrationExecutions.createdAt))
  return { integration: integration ?? null, versions, executions }
}

export async function createIntegration(payload?: {
  kind?: string
  title?: string
  endpoint?: string
  configJson?: string
}) {
  const database = getDrizzleDatabase()
  const id = crypto.randomUUID()
  const now = Date.now()
  await database.insert(integrations).values({
    id,
    title: payload?.title || `New ${payload?.kind || "http"} integration`,
    kind: payload?.kind || "http",
    endpoint: payload?.endpoint || "",
    enabled: true,
    updatedAt: now,
  })
  await database.insert(integrationVersions).values({
    id: crypto.randomUUID(),
    integrationId: id,
    major: 1,
    minor: 0,
    isRelease: false,
    configJson: payload?.configJson || "{}",
    createdAt: now,
  })
  return getIntegration(id)
}

export async function saveIntegration(payload: {
  id: string
  title: string
  kind: string
  endpoint: string
  configJson: string
  enabled?: boolean
  selectedVersionId?: string
  publish?: boolean
}) {
  const database = getDrizzleDatabase()
  const now = Date.now()
  const [latest] = await database
    .select()
    .from(integrationVersions)
    .where(eq(integrationVersions.integrationId, payload.id))
    .orderBy(desc(integrationVersions.major), desc(integrationVersions.minor), desc(integrationVersions.createdAt))
    .limit(1)
  const [selected] = payload.selectedVersionId
    ? await database
        .select()
        .from(integrationVersions)
        .where(
          and(eq(integrationVersions.integrationId, payload.id), eq(integrationVersions.id, payload.selectedVersionId)),
        )
        .limit(1)
    : []
  const [draft] = await database
    .select()
    .from(integrationVersions)
    .where(and(eq(integrationVersions.integrationId, payload.id), eq(integrationVersions.isRelease, false)))
    .orderBy(desc(integrationVersions.major), desc(integrationVersions.minor), desc(integrationVersions.createdAt))
    .limit(1)
  const target = selected && !selected.isRelease ? selected : draft
  await database
    .update(integrations)
    .set({
      title: payload.title,
      kind: payload.kind,
      endpoint: payload.endpoint,
      enabled: payload.enabled ?? true,
      updatedAt: now,
    })
    .where(eq(integrations.id, payload.id))
  if (!payload.publish && target) {
    await database
      .update(integrationVersions)
      .set({ configJson: payload.configJson, createdAt: now })
      .where(eq(integrationVersions.id, target.id))
  } else {
    await database.insert(integrationVersions).values({
      id: crypto.randomUUID(),
      integrationId: payload.id,
      major: !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major,
      minor: !latest || latest.isRelease ? 0 : latest.minor + 1,
      isRelease: Boolean(payload.publish),
      configJson: payload.configJson,
      createdAt: now,
    })
  }
  return getIntegration(payload.id)
}

export async function setIntegrationEnabled(id: string, enabled: boolean) {
  const database = getDrizzleDatabase()
  await database.update(integrations).set({ enabled, updatedAt: Date.now() }).where(eq(integrations.id, id))
  const [row] = await database.select().from(integrations).where(eq(integrations.id, id)).limit(1)
  return row ?? null
}

export async function deleteIntegration(id: string) {
  const database = getDrizzleDatabase()
  const existing = await database
    .select({ id: integrations.id })
    .from(integrations)
    .where(eq(integrations.id, id))
    .limit(1)
  await database.delete(integrationExecutions).where(eq(integrationExecutions.integrationId, id))
  await database.delete(integrationVersions).where(eq(integrationVersions.integrationId, id))
  await database.delete(integrations).where(eq(integrations.id, id))
  return { ok: existing.length > 0 }
}

export async function recordIntegrationExecution(payload: {
  id: string
  versionId: string
  status: string
  input: string
  output: string
}) {
  const database = getDrizzleDatabase()
  await database.insert(integrationExecutions).values({
    id: crypto.randomUUID(),
    integrationId: payload.id,
    versionId: payload.versionId,
    status: payload.status,
    inputJson: payload.input,
    outputJson: payload.output,
    createdAt: Date.now(),
  })
  return getIntegration(payload.id)
}

export async function assertIntegrationEnabled(id: string) {
  const [row] = await getDrizzleDatabase()
    .select({ enabled: integrations.enabled })
    .from(integrations)
    .where(eq(integrations.id, id))
    .limit(1)
  if (!row) throw new Error("Integration not found")
  if (!row.enabled) throw new Error("Integration is disabled")
}
