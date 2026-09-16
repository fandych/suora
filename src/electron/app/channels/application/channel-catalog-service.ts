import { getDrizzleDatabase } from "@/drizzle/db"
import { channels } from "@/drizzle/schema"
import { eq } from "drizzle-orm"

const channelTemplates = [
  ["catalog-wechat-personal", "WeChat Personal", "wechat_personal", "stream"],
  ["catalog-wechat", "WeChat Enterprise", "wechat", "webhook"],
  ["catalog-wechat-official", "WeChat Official Account", "wechat_official", "webhook"],
  ["catalog-wechat-miniprogram", "WeChat Mini Program", "wechat_miniprogram", "webhook"],
  ["catalog-feishu", "Feishu", "feishu", "webhook"],
  ["catalog-dingtalk", "DingTalk", "dingtalk", "stream"],
  ["catalog-qq", "QQ", "custom", "webhook"],
  ["catalog-teams", "Microsoft Teams", "teams", "webhook"],
  ["catalog-telegram", "Telegram", "telegram", "webhook"],
  ["catalog-email-inbox", "Email Inbox", "email", "stream"],
  ["catalog-custom-webhook", "Custom Webhook", "custom", "webhook"],
  ["catalog-custom-websocket", "Custom WebSocket", "custom", "stream"],
] as const

type CatalogRow = (typeof channelTemplates)[number]

export async function ensureChannelCatalog() {
  const database = getDrizzleDatabase()
  const existing = await database
    .select({ id: channels.id, title: channels.title, configJson: channels.configJson })
    .from(channels)
  const existingByCatalogId = new Map<string, (typeof existing)[number]>()

  for (const row of existing) {
    try {
      const config = JSON.parse(row.configJson) as { catalogId?: string }
      if (config.catalogId) existingByCatalogId.set(config.catalogId, row)
    } catch {
      // Invalid legacy config is repaired when the catalog entry is recreated.
    }
  }

  for (const [catalogId, title, platform, connectionMode] of channelTemplates) {
    const existingRow = existingByCatalogId.get(catalogId)
    if (existingRow) {
      if (existingRow.title !== title) {
        const config = JSON.parse(existingRow.configJson || "{}") as Record<string, unknown>
        config.title = title
        await database
          .update(channels)
          .set({ title, configJson: JSON.stringify(config), updatedAt: Date.now() })
          .where(eq(channels.id, existingRow.id))
      }
      continue
    }

    const now = Date.now()
    const id = `channel-${catalogId.replace(/^catalog-/, "")}`
    const config = {
      id,
      title,
      catalogId,
      platform,
      enabled: false,
      status: "inactive",
      connectionMode,
      webhookPath: `/channels/${id}`,
      webhookSecret: "",
      autoReply: true,
      replyAgentId: "",
      createdAt: now,
      updatedAt: now,
    }
    await database
      .insert(channels)
      .values({
        id,
        title,
        platform,
        enabled: false,
        status: "inactive",
        connectionMode,
        webhookPath: `/channels/${id}`,
        webhookSecret: "",
        autoReply: true,
        replyAgentId: "",
        createdAt: now,
        lastMessageAt: null,
        messageCount: 0,
        configJson: JSON.stringify(config),
        runtimeJson: JSON.stringify({
          messages: [],
          users: [],
          health: { isHealthy: null, errorCount: 0 },
          debugLog: [],
        }),
        updatedAt: now,
      })
      .onConflictDoNothing()
  }
}

export type ChannelCatalogTemplate = CatalogRow
