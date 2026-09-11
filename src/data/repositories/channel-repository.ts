import type { ChannelConfigRecord, ChannelDetail, ChannelSummary } from "@/data/domain/channel-models"
import { applyDefaultChannelDescription, resolveDefaultChannelModel } from "@/data/repositories/channel-defaults"
import { ensureChannelCatalogItems } from "@/data/repositories/channel-catalog"
import { emitDataChanged } from "@/data/repositories/data-events"
import { buildChannelWebhookUrl, normalizeChannelConfig } from "@/data/domain/channel-config"
import { listModelProviders } from "@/data/repositories/model-config-repository"
import { projectIpc } from "@/lib/ipc"
import { appendChannelDebug, mergeChannelDebugLogEntries } from "@/data/domain/channel-diagnostics"

export async function persistChannelDetail(detail: ChannelDetail) {
  const current = await projectIpc.channels.get(detail.channel.id) as ChannelDetail | null
  const normalized = {
    ...detail,
    channel: normalizeChannelConfig({
      ...detail.channel,
      updatedAt: Date.now(),
    }),
    runtime: {
      ...detail.runtime,
      debugLog: mergeChannelDebugLogEntries(detail.runtime.debugLog, current?.runtime.debugLog ?? []),
    },
  }
  const next = await projectIpc.channels.save(normalized) as ChannelDetail
  emitDataChanged("/channels")
  return next
}

export async function listChannels() {
  await ensureChannelCatalogItems()
  return projectIpc.channels.list() as Promise<ChannelSummary[]>
}

export async function getChannel(channelId: string) {
  await ensureChannelCatalogItems()
  const item = await projectIpc.channels.get(channelId) as ChannelDetail | null
  if (!item) {
    throw new Error(`Channel ${channelId} was not found.`)
  }
  return item
}

export async function createChannel() {
  await ensureChannelCatalogItems()
  const providers = await listModelProviders().catch(() => [])
  const defaultModel = resolveDefaultChannelModel(providers)
  const item = await projectIpc.channels.create({ providerId: defaultModel.providerId, modelId: defaultModel.modelId })
  emitDataChanged("/channels")
  return item
}

export async function saveChannel(payload: ChannelDetail) {
  await ensureChannelCatalogItems()
  const next = await persist({
    ...payload,
    channel: {
      ...payload.channel,
      description: applyDefaultChannelDescription(payload.channel),
    },
  })
  return next
}

export async function runChannelHealthCheck(detail: ChannelDetail) {
  const result = await projectIpc.channels.healthCheck(detail.channel.id) as { isHealthy: boolean; latencyMs: number; error?: string }
  const refreshed = await getChannel(detail.channel.id)
  if (refreshed.runtime.health.lastCheckAt) {
    return refreshed
  }
  const timestamp = Date.now()
  return persist({
    ...refreshed,
    runtime: {
      ...refreshed.runtime,
      health: {
        isHealthy: result.isHealthy,
        latencyMs: result.latencyMs,
        lastCheckAt: timestamp,
        errorCount: result.isHealthy ? refreshed.runtime.health.errorCount : refreshed.runtime.health.errorCount + 1,
        lastError: result.error,
      },
      debugLog: appendChannelDebug(refreshed, result.isHealthy ? "success" : "error", result.isHealthy ? "Health check passed." : result.error || "Health check failed.", timestamp),
    },
  })
}

export async function clearChannelDebugLog(detail: ChannelDetail) {
  return persist({
    ...detail,
    runtime: {
      ...detail.runtime,
      debugLog: [],
    },
  })
}

export const persist = persistChannelDetail

export async function getChannelWebhookRuntimeUrl(channel: ChannelConfigRecord) {
  const result = await projectIpc.channels.getWebhookUrl({ id: channel.id }) as { success?: boolean; url?: string }
  return result.url ?? buildChannelWebhookUrl(channel)
}
