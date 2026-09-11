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

export async function listAgents() {
  await ensureSeeded()
  return (await projectIpc.catalog.list("/agents") as Array<{ id: string; title: string; updatedAt: number; kind?: string; summary?: string }>).map(mapItem)
}

export async function listProviders() {
  await ensureSeeded()
  return (await projectIpc.catalog.list("/models") as Array<{ id: string; title: string; updatedAt: number; providerType?: string }>).map(mapItem)
}

export async function listIntegrations() {
  await ensureSeeded()
  return (await projectIpc.catalog.list("/integrations") as Array<{ id: string; title: string; updatedAt: number; kind?: string; endpoint?: string }>).map(mapItem)
}

export async function listSchedulers() {
  await ensureSeeded()
  return (await projectIpc.catalog.list("/schedulers") as Array<{ id: string; title: string; updatedAt: number; schedule?: string }>).map(mapItem)
}

export async function listChannels() {
  await ensureSeeded()
  return (await projectIpc.catalog.list("/channels") as Array<{ id: string; title: string; updatedAt: number; platform?: string }>).map(mapItem)
}
