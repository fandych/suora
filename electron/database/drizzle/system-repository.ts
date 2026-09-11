import { and, desc, eq } from "drizzle-orm"
import { getDrizzleDatabase } from "@electron/database/drizzle/client"
import { appMeta, agents, integrations, providers, schedulers, workflows, workflowVersions } from "@electron/database/drizzle/schema"
import { protectCredential, revealCredential } from "@electron/others/infrastructure/credential-vault"

export async function getAppMetaValue(key: string) {
  const [row] = await getDrizzleDatabase().select({ value: appMeta.value }).from(appMeta).where(eq(appMeta.key, key)).limit(1)
  return row?.value ?? null
}

export async function setAppMetaValue(key: string, value: string) {
  const database = getDrizzleDatabase()
  await database.insert(appMeta).values({ key, value }).onConflictDoUpdate({ target: appMeta.key, set: { value } })
}

export async function getPreferenceValue() {
  const value = await getAppMetaValue("preference_settings")
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    if (typeof parsed.mailServerPassword === "string") parsed.mailServerPassword = revealCredential(parsed.mailServerPassword)
    return JSON.stringify(parsed)
  } catch { return value }
}

export async function setPreferenceValue(value: string) {
  const parsed = JSON.parse(value) as Record<string, unknown>
  if (typeof parsed.mailServerPassword === "string") parsed.mailServerPassword = protectCredential(parsed.mailServerPassword)
  await setAppMetaValue("preference_settings", JSON.stringify(parsed))
}

export async function listCatalogItems(route: "/agents" | "/models" | "/integrations" | "/schedulers" | "/workflows") {
  const database = getDrizzleDatabase()
  if (route === "/agents") return database.select({ id: agents.id, title: agents.title, kind: agents.kind, summary: agents.summary, updatedAt: agents.updatedAt }).from(agents).orderBy(desc(agents.updatedAt))
  if (route === "/models") return database.select({ id: providers.id, title: providers.title, providerType: providers.providerType, updatedAt: providers.updatedAt }).from(providers).orderBy(desc(providers.updatedAt))
  if (route === "/integrations") return database.select({ id: integrations.id, title: integrations.title, kind: integrations.kind, endpoint: integrations.endpoint, updatedAt: integrations.updatedAt }).from(integrations).orderBy(desc(integrations.updatedAt))
  if (route === "/schedulers") return database.select({ id: schedulers.id, title: schedulers.title, schedule: schedulers.schedule, updatedAt: schedulers.updatedAt }).from(schedulers).orderBy(desc(schedulers.updatedAt))
  return database.select({ id: workflows.id, title: workflows.title, summary: workflows.summary, updatedAt: workflows.updatedAt }).from(workflows).orderBy(desc(workflows.updatedAt))
}

export async function getWorkflowVersionPolicy(workflowId: string, versionId: string) {
  const [row] = await getDrizzleDatabase().select({ id: workflows.id }).from(workflows).innerJoin(workflowVersions, eq(workflowVersions.workflowId, workflows.id)).where(and(eq(workflows.id, workflowId), eq(workflowVersions.id, versionId))).limit(1)
  if (!row) throw new Error("Workflow or version not found")
}
