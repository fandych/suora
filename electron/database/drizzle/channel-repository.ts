import { desc, eq } from "drizzle-orm"
import { getDrizzleDatabase } from "@electron/database/drizzle/client"
import { channels } from "@electron/database/drizzle/schema"
import { parseChannelDetailRow } from "@electron/others/channels/channel-store"
import type { ChannelDetail } from "@/data/domain/channel-models"

export async function listChannelsWithDrizzle() {
  const rows = await getDrizzleDatabase().select().from(channels).orderBy(desc(channels.updatedAt))
  return rows.map((row) => parseChannelDetailRow(row as never))
}

export async function getChannelWithDrizzle(id: string) {
  const [row] = await getDrizzleDatabase().select().from(channels).where(eq(channels.id, id)).limit(1)
  return row ? parseChannelDetailRow(row as never) : null
}

export async function saveChannelWithDrizzle(detail: ChannelDetail) {
  const database = getDrizzleDatabase()
  await database.update(channels).set({ title: detail.channel.title, platform: detail.channel.platform, enabled: detail.channel.enabled, status: detail.channel.status, connectionMode: detail.channel.connectionMode, webhookPath: detail.channel.webhookPath, webhookSecret: detail.channel.webhookSecret, autoReply: detail.channel.autoReply, replyAgentId: detail.channel.replyAgentId, createdAt: detail.channel.createdAt, lastMessageAt: detail.channel.lastMessageAt ?? null, messageCount: detail.channel.messageCount, configJson: JSON.stringify(detail.channel), runtimeJson: JSON.stringify(detail.runtime), updatedAt: Date.now() }).where(eq(channels.id, detail.channel.id))
  return getChannelWithDrizzle(detail.channel.id)
}
