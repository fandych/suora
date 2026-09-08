import { desc } from "drizzle-orm"

import type { SimpleCatalogItem } from "@/data/domain/models"
import { getDatabaseContext } from "@/data/db/client"
import { agents, channels, integrations, providers, schedulers } from "@/data/db/schema"
import { toTimestamp } from "@/data/domain/versioning"
import { ensureSeeded } from "@/data/repositories/seed-repository"

function mapItem(row: { id: string; title: string; updatedAt: Date; kind?: string; providerType?: string; platform?: string; summary?: string; schedule?: string; endpoint?: string }) {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind ?? row.providerType ?? row.platform ?? "default",
    meta: row.summary ?? row.schedule ?? row.endpoint,
    updatedAt: toTimestamp(row.updatedAt),
  } satisfies SimpleCatalogItem
}

export async function listAgents() {
  await ensureSeeded()
  const context = await getDatabaseContext()
  return (await context.db.select().from(agents).orderBy(desc(agents.updatedAt)).all()).map(mapItem)
}

export async function listProviders() {
  await ensureSeeded()
  const context = await getDatabaseContext()
  return (await context.db.select().from(providers).orderBy(desc(providers.updatedAt)).all()).map(mapItem)
}

export async function listIntegrations() {
  await ensureSeeded()
  const context = await getDatabaseContext()
  return (await context.db.select().from(integrations).orderBy(desc(integrations.updatedAt)).all()).map(mapItem)
}

export async function listSchedulers() {
  await ensureSeeded()
  const context = await getDatabaseContext()
  return (await context.db.select().from(schedulers).orderBy(desc(schedulers.updatedAt)).all()).map(mapItem)
}

export async function listChannels() {
  await ensureSeeded()
  const context = await getDatabaseContext()
  return (await context.db.select().from(channels).orderBy(desc(channels.updatedAt)).all()).map(mapItem)
}
