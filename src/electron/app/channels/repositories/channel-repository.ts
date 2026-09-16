import crypto from "node:crypto"
import { desc, eq } from "drizzle-orm"
import { getDrizzleDatabase } from "@/drizzle/db"
import { channels } from "@/drizzle/schema"
import { parseChannelDetailRow } from "@/electron/app/channels/repositories/channel-store"
import type { ChannelDetail } from "@/types/channel"
import { normalizeChannelRuntimeState } from "@/electron/app/channels/application/channel-status-policy"

export async function listChannels() {
  const rows = await getDrizzleDatabase().select().from(channels).orderBy(desc(channels.updatedAt))
  return rows.map((row) => parseChannelDetailRow(row as never).channel)
}

export async function getChannel(id: string) {
  const [row] = await getDrizzleDatabase().select().from(channels).where(eq(channels.id, id)).limit(1)
  return row ? parseChannelDetailRow(row as never) : null
}

export async function saveChannel(detail: ChannelDetail) {
  const channel = normalizeChannelRuntimeState(detail.channel)
  const database = getDrizzleDatabase()
  await database
    .update(channels)
    .set({
      title: channel.title,
      platform: channel.platform,
      enabled: channel.enabled,
      status: channel.status,
      connectionMode: channel.connectionMode,
      webhookPath: channel.webhookPath,
      webhookSecret: channel.webhookSecret,
      autoReply: channel.autoReply,
      replyAgentId: channel.replyAgentId,
      createdAt: channel.createdAt,
      lastMessageAt: channel.lastMessageAt ?? null,
      messageCount: channel.messageCount,
      configJson: JSON.stringify(channel),
      runtimeJson: JSON.stringify(detail.runtime),
      updatedAt: Date.now(),
    })
    .where(eq(channels.id, detail.channel.id))
  return getChannel(detail.channel.id)
}

export async function createChannel(defaults?: { providerId?: string; modelId?: string }) {
  const id = crypto.randomUUID()
  const now = Date.now()
  const channel = {
    id,
    title: "New channel",
    platform: "custom",
    enabled: false,
    status: "draft",
    connectionMode: "webhook",
    webhookPath: `/webhook/custom/${id}`,
    webhookSecret: "",
    autoReply: false,
    replyAgentId: "",
    providerId: defaults?.providerId ?? "",
    modelId: defaults?.modelId ?? "",
    createdAt: now,
    messageCount: 0,
  }
  const runtime = { health: { isHealthy: false, latencyMs: 0, lastCheckAt: 0, errorCount: 0 }, debugLog: [] }
  await getDrizzleDatabase()
    .insert(channels)
    .values({
      id,
      title: channel.title,
      platform: channel.platform,
      enabled: channel.enabled,
      status: channel.status,
      connectionMode: channel.connectionMode,
      webhookPath: channel.webhookPath,
      webhookSecret: "",
      autoReply: false,
      replyAgentId: "",
      createdAt: now,
      messageCount: 0,
      configJson: JSON.stringify(channel),
      runtimeJson: JSON.stringify(runtime),
      updatedAt: now,
    })
  return getChannel(id)
}

export async function deleteChannel(id: string) {
  await getDrizzleDatabase().delete(channels).where(eq(channels.id, id))
  return { success: true }
}
