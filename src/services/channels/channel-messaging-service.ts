import type { ChannelDetail } from "@/data/domain/models"
import { projectIpc } from "@/lib/ipc"

type SyncRuntime = () => Promise<unknown>
type GetChannel = (channelId: string) => Promise<ChannelDetail>

export async function sendMockChannelMessage(detail: ChannelDetail, message: string, syncRuntime: SyncRuntime, getChannel: GetChannel) {
  const trimmed = message.trim()
  if (!trimmed) return detail
  await syncRuntime().catch(() => undefined)
  await projectIpc.channels.debugSend({ channelId: detail.channel.id, content: trimmed })
  return getChannel(detail.channel.id)
}

export function sendChannelReply(payload: { channelId: string; chatId: string; content: string }) {
  return projectIpc.channels.sendMessage(payload) as Promise<{ success: boolean; error?: string }>
}

export function sendQueuedChannelReply(payload: { channelId: string; chatId: string; content: string }) {
  return projectIpc.channels.sendMessageQueued(payload) as Promise<{ success: boolean; error?: string }>
}
