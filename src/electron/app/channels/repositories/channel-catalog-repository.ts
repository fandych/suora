import { eq } from "drizzle-orm"
import { getDrizzleDatabase } from "@/drizzle/db"
import { channels } from "@/drizzle/schema"

type CatalogEntry = {
  id: string
  title: string
  platform: string
  enabled: boolean
  status: string
  connectionMode: string
  webhookPath: string
  webhookSecret: string
  autoReply: boolean
  replyAgentId: string
  createdAt: number
  configJson: string
  runtimeJson: string
  updatedAt: number
}

export async function syncChannelCatalog(input: {
  renamed: Array<{ id: string; title: string }>
  channels: CatalogEntry[]
}) {
  const database = getDrizzleDatabase()
  await database.transaction(async (tx) => {
    for (const entry of input.renamed) {
      const [existing] = await tx
        .select({ configJson: channels.configJson })
        .from(channels)
        .where(eq(channels.id, entry.id))
        .limit(1)
      let configJson = existing?.configJson ?? "{}"
      try {
        const config = JSON.parse(configJson) as Record<string, unknown>
        config.title = entry.title
        configJson = JSON.stringify(config)
      } catch {
        configJson = JSON.stringify({ title: entry.title })
      }
      await tx
        .update(channels)
        .set({ title: entry.title, configJson, updatedAt: Date.now() })
        .where(eq(channels.id, entry.id))
    }
    for (const entry of input.channels) {
      await tx
        .insert(channels)
        .values({
          id: entry.id,
          title: entry.title,
          platform: entry.platform,
          enabled: entry.enabled,
          status: entry.status,
          connectionMode: entry.connectionMode,
          webhookPath: entry.webhookPath,
          webhookSecret: entry.webhookSecret,
          autoReply: entry.autoReply,
          replyAgentId: entry.replyAgentId,
          createdAt: entry.createdAt,
          lastMessageAt: null,
          messageCount: 0,
          configJson: entry.configJson,
          runtimeJson: entry.runtimeJson,
          updatedAt: entry.updatedAt,
        })
        .onConflictDoNothing()
    }
  })
  return { ok: true }
}
