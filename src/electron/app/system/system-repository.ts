import crypto from "node:crypto"
import { desc, eq } from "drizzle-orm"
import { getDrizzleDatabase } from "@/drizzle/db"
import { appMeta, agents, providers, workflows } from "@/drizzle/schema"
import type { RecentlyDeletedResourceEntry, RecentlyDeletedResourceKind } from "@/types/system"

const RECENTLY_DELETED_RESOURCES_KEY = "recently_deleted_resources"
const MAX_RECENTLY_DELETED_RESOURCES = 20

type RecentlyDeletedResource = {
  entryId: string
  resourceId: string
  kind: RecentlyDeletedResourceKind
  title: string
  deletedAt: number
  snapshot: unknown
}

export async function getAppMetaValue(key: string) {
  const [row] = await getDrizzleDatabase()
    .select({ value: appMeta.value })
    .from(appMeta)
    .where(eq(appMeta.key, key))
    .limit(1)
  return row?.value ?? null
}

export async function setAppMetaValue(key: string, value: string) {
  const database = getDrizzleDatabase()
  await database.insert(appMeta).values({ key, value }).onConflictDoUpdate({ target: appMeta.key, set: { value } })
}

function parseRecentlyDeletedResources(value: string | null) {
  if (!value) return [] as RecentlyDeletedResource[]
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return [] as RecentlyDeletedResource[]
    return parsed.flatMap((item): RecentlyDeletedResource[] => {
      if (!item || typeof item !== "object") return []
      const candidate = item as Partial<RecentlyDeletedResource> & { id?: string }
      const entryId =
        typeof candidate.entryId === "string" && candidate.entryId
          ? candidate.entryId
          : typeof candidate.kind === "string" && typeof candidate.deletedAt === "number"
            ? `${candidate.kind}:${candidate.id ?? candidate.resourceId ?? "unknown"}:${candidate.deletedAt}`
            : null
      const resourceId =
        typeof candidate.resourceId === "string" && candidate.resourceId
          ? candidate.resourceId
          : typeof candidate.id === "string"
            ? candidate.id
            : null
      if (!entryId || !resourceId || typeof candidate.title !== "string" || typeof candidate.deletedAt !== "number") {
        return []
      }
      if (candidate.kind !== "chat" && candidate.kind !== "document" && candidate.kind !== "workflow") {
        return []
      }
      return [{ entryId, resourceId, kind: candidate.kind, title: candidate.title, deletedAt: candidate.deletedAt, snapshot: candidate.snapshot }]
    })
  } catch {
    return [] as RecentlyDeletedResource[]
  }
}

export async function recordRecentlyDeletedResource(
  entry: Omit<RecentlyDeletedResource, "entryId"> & { entryId?: string },
) {
  const existing = parseRecentlyDeletedResources(await getAppMetaValue(RECENTLY_DELETED_RESOURCES_KEY))
  const nextEntry: RecentlyDeletedResource = {
    ...entry,
    entryId: entry.entryId ?? crypto.randomUUID(),
  }
  const next = [nextEntry, ...existing].slice(0, MAX_RECENTLY_DELETED_RESOURCES)
  await setAppMetaValue(RECENTLY_DELETED_RESOURCES_KEY, JSON.stringify(next))
  return nextEntry.entryId
}

export async function listRecentlyDeletedResources(kind?: RecentlyDeletedResourceKind): Promise<RecentlyDeletedResourceEntry[]> {
  const entries = parseRecentlyDeletedResources(await getAppMetaValue(RECENTLY_DELETED_RESOURCES_KEY))
  return entries
    .filter((entry) => !kind || entry.kind === kind)
    .sort((left, right) => right.deletedAt - left.deletedAt)
    .map(({ entryId, resourceId, title, kind: entryKind, deletedAt }) => ({
      entryId,
      resourceId,
      title,
      kind: entryKind,
      deletedAt,
    }))
}

export async function getRecentlyDeletedResource(entryId: string) {
  return parseRecentlyDeletedResources(await getAppMetaValue(RECENTLY_DELETED_RESOURCES_KEY)).find(
    (entry) => entry.entryId === entryId,
  )
}

export async function removeRecentlyDeletedResource(entryId: string) {
  const existing = parseRecentlyDeletedResources(await getAppMetaValue(RECENTLY_DELETED_RESOURCES_KEY))
  const next = existing.filter((entry) => entry.entryId !== entryId)
  await setAppMetaValue(RECENTLY_DELETED_RESOURCES_KEY, JSON.stringify(next))
}

export async function listCatalogItems(route: "/agents" | "/models" | "/workflows") {
  const database = getDrizzleDatabase()
  if (route === "/agents")
    return database
      .select({
        id: agents.id,
        title: agents.title,
        kind: agents.kind,
        summary: agents.summary,
        updatedAt: agents.updatedAt,
      })
      .from(agents)
      .orderBy(desc(agents.updatedAt))
  if (route === "/models")
    return database
      .select({
        id: providers.id,
        title: providers.title,
        providerType: providers.providerType,
        updatedAt: providers.updatedAt,
      })
      .from(providers)
      .orderBy(desc(providers.updatedAt))
  return database
    .select({ id: workflows.id, title: workflows.title, summary: workflows.summary, updatedAt: workflows.updatedAt })
    .from(workflows)
    .orderBy(desc(workflows.updatedAt))
}
