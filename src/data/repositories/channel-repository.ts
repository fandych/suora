import type { SimpleCatalogItem } from "@/data/domain/models"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { suoraIpc } from "@/lib/ipc"

export async function listChannels() {
  await ensureSeeded()
  return suoraIpc.channels.list() as Promise<SimpleCatalogItem[]>
}

export async function getChannel(channelId: string) {
  await ensureSeeded()
  const item = await suoraIpc.channels.get(channelId) as SimpleCatalogItem | null
  if (!item) {
    throw new Error(`Channel ${channelId} was not found.`)
  }
  return item
}

export async function createChannel() {
  await ensureSeeded()
  return suoraIpc.channels.create() as Promise<SimpleCatalogItem>
}

export async function saveChannel(payload: { id: string; title: string; platform: string }) {
  await ensureSeeded()
  return suoraIpc.channels.save(payload) as Promise<SimpleCatalogItem>
}