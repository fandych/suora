import type { SimpleCatalogItem } from "@/data/domain/navigation-models"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { projectIpc } from "@/lib/ipc"

function mapItem(row: { id: string; title: string; updatedAt: number; kind?: string; providerType?: string; platform?: string; summary?: string; schedule?: string; endpoint?: string }) {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind ?? row.providerType ?? row.platform ?? "default",
    meta: row.summary ?? row.schedule ?? row.endpoint,
    updatedAt: row.updatedAt,
  } satisfies SimpleCatalogItem
}

export async function getCatalogDetail(route: string, itemId: string) {
  await ensureSeeded()
  const row = await projectIpc.catalog.get(route, itemId) as { id: string; title: string; updatedAt: number; kind?: string; providerType?: string; platform?: string; summary?: string; schedule?: string; endpoint?: string } | null
  return row ? mapItem(row) : null
}