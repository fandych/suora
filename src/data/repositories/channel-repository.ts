import type { ChannelDetail, ChannelSummary } from "@/data/domain/models"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { suoraIpc } from "@/lib/ipc"

export async function listChannels() {
  await ensureSeeded()
  return suoraIpc.channels.list() as Promise<ChannelSummary[]>
}

export async function getChannel(channelId: string) {
  await ensureSeeded()
  const item = await suoraIpc.channels.get(channelId) as ChannelDetail | null
  if (!item) {
    throw new Error(`Channel ${channelId} was not found.`)
  }
  return item
}

export async function createChannel() {
  await ensureSeeded()
  return suoraIpc.channels.create() as Promise<ChannelDetail>
}

export async function saveChannel(payload: ChannelDetail) {
  await ensureSeeded()
  return suoraIpc.channels.save(payload) as Promise<ChannelDetail>
}