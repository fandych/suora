import type { ChannelConfigRecord, ChannelDetail, ChannelRuntimeState, ChannelSummary } from "@/data/domain/channel-models"
import { inferChannelBindingState } from "@/data/domain/channel-config"
import { parseJson } from "@/lib/serialization/json"

export type RawChannelRow = { id: string; title: string; platform: string; enabled?: number | boolean; status?: string; connectionMode?: string; webhookPath?: string; webhookSecret?: string; autoReply?: number | boolean; replyAgentId?: string; createdAt?: number; lastMessageAt?: number | null; messageCount?: number; configJson?: string; runtimeJson?: string; updatedAt: number }

function createDefaultChannelConfig(row: RawChannelRow): ChannelConfigRecord {
  return { id: row.id, title: row.title, platform: (row.platform || "web") as ChannelConfigRecord["platform"], catalogId: row.id, bindingState: "unconfigured", enabled: Boolean(row.enabled), status: (row.status || "inactive") as ChannelConfigRecord["status"], connectionMode: (row.connectionMode || "webhook") as ChannelConfigRecord["connectionMode"], webhookPath: row.webhookPath || `/channels/${row.id}`, webhookSecret: row.webhookSecret || "", autoReply: row.autoReply == null ? true : Boolean(row.autoReply), replyAgentId: row.replyAgentId || "", createdAt: row.createdAt ?? row.updatedAt, updatedAt: row.updatedAt, lastMessageAt: row.lastMessageAt ?? undefined, messageCount: row.messageCount ?? 0, emailFilters: [], emailActions: [], emailMarkAsRead: true, emailUseGlobalMailService: false }
}

export function parseChannelDetailRow(row: RawChannelRow): ChannelDetail {
  const baseConfig = createDefaultChannelConfig(row)
  const parsedConfig = parseJson<Partial<ChannelConfigRecord>>(row.configJson, {})
  const parsedRuntime = parseJson<Partial<ChannelRuntimeState>>(row.runtimeJson, {})
  const baseRuntime: ChannelRuntimeState = { messages: [], users: [], health: { isHealthy: null, errorCount: 0 }, debugLog: [] }
  const channel = { ...baseConfig, ...parsedConfig, id: row.id, title: row.title, platform: (row.platform || parsedConfig.platform || "web") as ChannelConfigRecord["platform"], enabled: row.enabled == null ? (parsedConfig.enabled ?? false) : Boolean(row.enabled), status: (row.status || parsedConfig.status || "inactive") as ChannelConfigRecord["status"], connectionMode: (row.connectionMode || parsedConfig.connectionMode || "webhook") as ChannelConfigRecord["connectionMode"], webhookPath: row.webhookPath || parsedConfig.webhookPath || `/channels/${row.id}`, webhookSecret: row.webhookSecret || parsedConfig.webhookSecret || "", autoReply: row.autoReply == null ? (parsedConfig.autoReply ?? true) : Boolean(row.autoReply), replyAgentId: row.replyAgentId || parsedConfig.replyAgentId || "", createdAt: row.createdAt ?? parsedConfig.createdAt ?? row.updatedAt, updatedAt: row.updatedAt, lastMessageAt: row.lastMessageAt ?? parsedConfig.lastMessageAt, messageCount: row.messageCount ?? parsedConfig.messageCount ?? 0, emailFilters: parsedConfig.emailFilters ?? [], emailActions: parsedConfig.emailActions ?? [], emailMarkAsRead: parsedConfig.emailMarkAsRead ?? true, emailUseGlobalMailService: parsedConfig.emailUseGlobalMailService ?? false } satisfies ChannelConfigRecord
  return { channel: { ...channel, catalogId: parsedConfig.catalogId || row.id, bindingState: parsedConfig.bindingState || inferChannelBindingState(channel) }, runtime: { ...baseRuntime, ...parsedRuntime, messages: parsedRuntime.messages ?? baseRuntime.messages, users: parsedRuntime.users ?? baseRuntime.users, debugLog: parsedRuntime.debugLog ?? baseRuntime.debugLog, health: { ...baseRuntime.health, ...(parsedRuntime.health ?? {}) } } }
}

export function parseChannelSummaryRow(row: RawChannelRow): ChannelSummary {
  const detail = parseChannelDetailRow(row)
  return { id: detail.channel.id, title: detail.channel.title, platform: detail.channel.platform, catalogId: detail.channel.catalogId, connectionMode: detail.channel.connectionMode, bindingState: detail.channel.bindingState, enabled: detail.channel.enabled, status: detail.channel.status, updatedAt: detail.channel.updatedAt, lastMessageAt: detail.channel.lastMessageAt, messageCount: detail.channel.messageCount, meta: `${detail.channel.platform} · ${detail.channel.connectionMode}`, customPlatformName: detail.channel.customPlatformName, customPlatformIcon: detail.channel.customPlatformIcon }
}
