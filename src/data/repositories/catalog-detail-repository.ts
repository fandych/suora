import { eq } from "drizzle-orm"

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

export async function getCatalogDetail(route: string, itemId: string) {
  await ensureSeeded()
  const context = await getDatabaseContext()

  switch (route) {
    case "/agents": {
      const row = (await context.db.select().from(agents).where(eq(agents.id, itemId)).all())[0]
      return row ? mapItem(row) : null
    }
    case "/models": {
      const row = (await context.db.select().from(providers).where(eq(providers.id, itemId)).all())[0]
      return row ? mapItem(row) : null
    }
    case "/integrations": {
      const row = (await context.db.select().from(integrations).where(eq(integrations.id, itemId)).all())[0]
      return row ? mapItem(row) : null
    }
    case "/schedulers": {
      const row = (await context.db.select().from(schedulers).where(eq(schedulers.id, itemId)).all())[0]
      return row ? mapItem(row) : null
    }
    case "/channels": {
      const row = (await context.db.select().from(channels).where(eq(channels.id, itemId)).all())[0]
      return row ? mapItem(row) : null
    }
    default:
      return null
  }
}