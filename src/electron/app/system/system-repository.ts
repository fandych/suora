import crypto from "node:crypto"
import { desc, eq } from "drizzle-orm"
import { getDrizzleDatabase } from "@/drizzle/db"
import { appMeta, agents, providers, workflows } from "@/drizzle/schema"
import type { RecentlyDeletedResourceEntry, RecentlyDeletedResourceKind } from "@/types/system"

const RECENTLY_DELETED_RESOURCES_KEY = "recently_deleted_resources"
const MAX_RECENTLY_DELETED_RESOURCES = 20
const MAX_RECENTLY_DELETED_AGE_MS = 30 * 24 * 60 * 60 * 1000

let recentlyDeletedMutationQueue: Promise<void> = Promise.resolve()

type RecentlyDeletedResource = {
  entryId: string
  resourceId: string
  kind: RecentlyDeletedResourceKind
  title: string
  deletedAt: number
  snapshot: unknown
  restoring?: boolean
}

type RecentlyDeletedClaimResult =
  | { status: "claimed"; entry: RecentlyDeletedResource }
  | { status: "missing" }
  | { status: "restoring" }

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
          : crypto.randomUUID()
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
      return [{ entryId, resourceId, kind: candidate.kind, title: candidate.title, deletedAt: candidate.deletedAt, snapshot: candidate.snapshot, restoring: candidate.restoring === true }]
    })
  } catch {
    return [] as RecentlyDeletedResource[]
  }
}

function normalizeRecentlyDeletedResources(entries: RecentlyDeletedResource[]) {
  const cutoff = Date.now() - MAX_RECENTLY_DELETED_AGE_MS
  const normalized: RecentlyDeletedResource[] = []
  const seenEntryIds = new Set<string>()
  for (const entry of entries) {
    if (!entry.entryId || seenEntryIds.has(entry.entryId)) continue
    if (entry.deletedAt < cutoff) continue
    seenEntryIds.add(entry.entryId)
    normalized.push({ ...entry, restoring: entry.restoring === true })
  }
  normalized.sort((left, right) => right.deletedAt - left.deletedAt)
  return normalized.slice(0, MAX_RECENTLY_DELETED_RESOURCES)
}

async function withRecentlyDeletedMutation<T>(
  operation: (entries: RecentlyDeletedResource[]) => Promise<{ entries: RecentlyDeletedResource[]; result: T }> | { entries: RecentlyDeletedResource[]; result: T },
) {
  const previous = recentlyDeletedMutationQueue
  let release!: () => void
  recentlyDeletedMutationQueue = new Promise<void>((resolve) => {
    release = resolve
  })
  await previous
  try {
    const currentEntries = normalizeRecentlyDeletedResources(
      parseRecentlyDeletedResources(await getAppMetaValue(RECENTLY_DELETED_RESOURCES_KEY)),
    )
    const output = await operation(currentEntries)
    const nextEntries = normalizeRecentlyDeletedResources(output.entries)
    await setAppMetaValue(RECENTLY_DELETED_RESOURCES_KEY, JSON.stringify(nextEntries))
    return output.result
  } finally {
    release()
  }
}

export async function recordRecentlyDeletedResource(
  entry: Omit<RecentlyDeletedResource, "entryId"> & { entryId?: string },
) {
  return withRecentlyDeletedMutation(async (existing) => {
    const nextEntry: RecentlyDeletedResource = {
      ...entry,
      entryId: entry.entryId ?? crypto.randomUUID(),
      restoring: false,
    }
    return { entries: [nextEntry, ...existing], result: nextEntry.entryId }
  })
}

export async function listRecentlyDeletedResources(kind?: RecentlyDeletedResourceKind): Promise<RecentlyDeletedResourceEntry[]> {
  return withRecentlyDeletedMutation(async (entries) => ({
    entries,
    result: entries
      .filter((entry) => entry.restoring !== true)
      .filter((entry) => !kind || entry.kind === kind)
      .map(({ entryId, resourceId, title, kind: entryKind, deletedAt }) => ({
        entryId,
        resourceId,
        title,
        kind: entryKind,
        deletedAt,
      })),
  }))
}

export async function getRecentlyDeletedResource(entryId: string) {
  return withRecentlyDeletedMutation(async (entries) => ({
    entries,
    result: entries.find((entry) => entry.entryId === entryId) ?? null,
  }))
}

export async function claimRecentlyDeletedResource(entryId: string): Promise<RecentlyDeletedClaimResult> {
  return withRecentlyDeletedMutation(async (entries) => {
    const index = entries.findIndex((entry) => entry.entryId === entryId)
    if (index === -1) return { entries, result: { status: "missing" } as RecentlyDeletedClaimResult }
    const entry = entries[index]
    if (entry.restoring) {
      return { entries, result: { status: "restoring" } as RecentlyDeletedClaimResult }
    }
    const nextEntries = [...entries]
    nextEntries[index] = { ...entry, restoring: true }
    return { entries: nextEntries, result: { status: "claimed", entry: nextEntries[index] } as RecentlyDeletedClaimResult }
  })
}

export async function removeRecentlyDeletedResource(entryId: string) {
  return withRecentlyDeletedMutation(async (entries) => ({
    entries: entries.filter((entry) => entry.entryId !== entryId),
    result: undefined,
  }))
}

export async function clearRecentlyDeletedResourceRestore(entryId: string) {
  return withRecentlyDeletedMutation(async (entries) => ({
    entries: entries.map((entry) => (entry.entryId === entryId ? { ...entry, restoring: false } : entry)),
    result: undefined,
  }))
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
