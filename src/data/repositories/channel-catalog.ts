import type { ChannelDetail } from "@/data/domain/models"
import { eq } from "drizzle-orm"
import { channels } from "@/data/db/schema"
import { executePersistedMutation, getDatabaseContext } from "@/data/db/client"
import { CHANNEL_CATALOG_TEMPLATES, buildChannelCatalogId, createDefaultChannelConfig, createDefaultChannelRuntime } from "@/data/repositories/channel-defaults"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { normalizeChannelConfig } from "@/data/domain/channel-config"

let ensureChannelCatalogPromise: Promise<void> | undefined
let hasEnsuredChannelCatalog = false

function getCatalogId(configJson: string) {
  try {
    const config = JSON.parse(configJson) as { catalogId?: unknown }
    return typeof config.catalogId === "string" ? config.catalogId : undefined
  } catch {
    return undefined
  }
}

function createCatalogChannel(template: typeof CHANNEL_CATALOG_TEMPLATES[number], now: number): ChannelDetail {
  const channel = normalizeChannelConfig({
    ...createDefaultChannelConfig({
      id: `channel-${buildChannelCatalogId(template).replace(/^catalog-/, "")}`,
      title: template.title,
      platform: template.platform,
      now,
      connectionMode: template.connectionMode,
      customPlatformName: template.customPlatformName,
      customPlatformIcon: template.customPlatformIcon,
    }),
    title: template.title,
    catalogId: buildChannelCatalogId(template),
    customPlatformName: template.customPlatformName,
    customPlatformIcon: template.customPlatformIcon,
  })

  return {
    channel,
    runtime: createDefaultChannelRuntime(),
  }
}

export async function ensureChannelCatalogItems() {
  await ensureSeeded()

  if (hasEnsuredChannelCatalog) {
    return
  }

  if (!ensureChannelCatalogPromise) {
    ensureChannelCatalogPromise = (async () => {
      const context = await getDatabaseContext()
      const existingRows = await context.db.select({ id: channels.id, title: channels.title, configJson: channels.configJson }).from(channels).all()
      const existingIds = new Set(existingRows.map((row) => row.id))
      const existingCatalogIds = new Set(existingRows.map((row) => getCatalogId(row.configJson)).filter((catalogId): catalogId is string => Boolean(catalogId)))
      const missing = CHANNEL_CATALOG_TEMPLATES.filter((item) => {
        const catalogId = buildChannelCatalogId(item)
        return !existingCatalogIds.has(catalogId) && !existingIds.has(`channel-${catalogId.replace(/^catalog-/, "")}`)
      })

      const renamedCatalogEntries = existingRows.flatMap((row) => {
        const catalogId = getCatalogId(row.configJson)
        const template = CHANNEL_CATALOG_TEMPLATES.find((item) => buildChannelCatalogId(item) === catalogId)
        if (!template || row.title === template.title) {
          return []
        }

        try {
          const config = JSON.parse(row.configJson) as Record<string, unknown>
          return [{ id: row.id, title: template.title, configJson: JSON.stringify({ ...config, title: template.title }) }]
        } catch {
          return []
        }
      })

      if (!missing.length && !renamedCatalogEntries.length) {
        hasEnsuredChannelCatalog = true
        return
      }

      await executePersistedMutation(async ({ db }) => {
        for (const entry of renamedCatalogEntries) {
          await db.update(channels)
            .set({ title: entry.title, configJson: entry.configJson, updatedAt: new Date() })
            .where(eq(channels.id, entry.id))
        }

        if (!missing.length) {
          return
        }

        const now = Date.now()
        await db.insert(channels)
          .values(missing.map((template, index) => {
            const detail = createCatalogChannel(template, now - index)
            return {
              id: detail.channel.id,
              title: detail.channel.title,
              platform: detail.channel.platform,
              enabled: detail.channel.enabled,
              status: detail.channel.status,
              connectionMode: detail.channel.connectionMode,
              webhookPath: detail.channel.webhookPath,
              webhookSecret: detail.channel.webhookSecret,
              autoReply: detail.channel.autoReply,
              replyAgentId: detail.channel.replyAgentId,
              createdAt: new Date(detail.channel.createdAt),
              lastMessageAt: null,
              messageCount: 0,
              configJson: JSON.stringify(detail.channel),
              runtimeJson: JSON.stringify(detail.runtime),
              updatedAt: new Date(detail.channel.updatedAt),
            }
          }))
          .onConflictDoNothing({ target: channels.id })
          .run()
      })

      hasEnsuredChannelCatalog = true
    })().finally(() => {
      ensureChannelCatalogPromise = undefined
    })
  }

  await ensureChannelCatalogPromise
}