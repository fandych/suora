import type { ChannelDetail } from "@/data/domain/channel-models"
import { CHANNEL_CATALOG_TEMPLATES, buildChannelCatalogId, createDefaultChannelConfig, createDefaultChannelRuntime } from "@/data/repositories/channel-defaults"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { normalizeChannelConfig } from "@/data/domain/channel-config"
import { getProjectBridge } from "@/lib/ipc"

let ensureChannelCatalogPromise: Promise<void> | undefined
let hasEnsuredChannelCatalog = false

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
      const existingRows = await getProjectBridge().catalog.list("/channels") as Array<{ id: string; title: string; catalogId?: string }>
      const existingIds = new Set(existingRows.map((row) => row.id))
      const existingCatalogIds = new Set(existingRows.map((row) => row.catalogId).filter((catalogId): catalogId is string => Boolean(catalogId)))
      const missing = CHANNEL_CATALOG_TEMPLATES.filter((item) => {
        const catalogId = buildChannelCatalogId(item)
        return !existingCatalogIds.has(catalogId) && !existingIds.has(`channel-${catalogId.replace(/^catalog-/, "")}`)
      })

      const renamedCatalogEntries = existingRows.flatMap((row) => {
        const catalogId = row.catalogId
        const template = CHANNEL_CATALOG_TEMPLATES.find((item) => buildChannelCatalogId(item) === catalogId)
        if (!template || row.title === template.title) {
          return []
        }

        return [{ id: row.id, title: template.title }]
      })

      if (!missing.length && !renamedCatalogEntries.length) {
        hasEnsuredChannelCatalog = true
        return
      }

      const now = Date.now()
      await getProjectBridge().database.syncChannelCatalog({
        renamed: renamedCatalogEntries,
        channels: missing.map((template, index) => {
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
          }),
      })

      hasEnsuredChannelCatalog = true
    })().finally(() => {
      ensureChannelCatalogPromise = undefined
    })
  }

  await ensureChannelCatalogPromise
}