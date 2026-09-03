import type { ChannelConfigRecord, ChannelDetail, ChannelRuntimeState } from "@/data/domain/models"
import { applyMigrations, openDatabase } from "@electron/database/db-core"

type RawChannelRow = {
  id: string
  title: string
  platform: string
  enabled?: number | boolean
  status?: string
  connectionMode?: string
  webhookPath?: string
  webhookSecret?: string
  autoReply?: number | boolean
  replyAgentId?: string
  createdAt?: number
  lastMessageAt?: number | null
  messageCount?: number
  configJson?: string
  runtimeJson?: string
  updatedAt: number
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function createDefaultRuntime(): ChannelRuntimeState {
  return {
    messages: [],
    users: [],
    health: {
      isHealthy: null,
      errorCount: 0,
    },
    debugLog: [],
  }
}

function createDefaultConfig(row: RawChannelRow): ChannelConfigRecord {
  return {
    id: row.id,
    title: row.title,
    platform: (row.platform || "web") as ChannelConfigRecord["platform"],
    enabled: Boolean(row.enabled),
    status: (row.status || "inactive") as ChannelConfigRecord["status"],
    bindingState: "unconfigured",
    connectionMode: (row.connectionMode || "webhook") as ChannelConfigRecord["connectionMode"],
    webhookPath: row.webhookPath || `/channels/${row.id}`,
    webhookSecret: row.webhookSecret || "",
    autoReply: row.autoReply == null ? true : Boolean(row.autoReply),
    replyAgentId: row.replyAgentId || "",
    createdAt: row.createdAt ?? row.updatedAt,
    updatedAt: row.updatedAt,
    lastMessageAt: row.lastMessageAt ?? undefined,
    messageCount: row.messageCount ?? 0,
    emailFilters: [],
    emailActions: [],
    emailMarkAsRead: true,
    emailUseGlobalMailService: false,
  }
}

export function parseChannelDetailRow(row: RawChannelRow): ChannelDetail {
  const baseConfig = createDefaultConfig(row)
  const parsedConfig = parseJson<Partial<ChannelConfigRecord>>(row.configJson, {})
  const parsedRuntime = parseJson<Partial<ChannelRuntimeState>>(row.runtimeJson, {})
  const baseRuntime = createDefaultRuntime()

  return {
    channel: {
      ...baseConfig,
      ...parsedConfig,
      id: row.id,
      title: row.title,
      platform: (row.platform || parsedConfig.platform || "web") as ChannelConfigRecord["platform"],
      enabled: row.enabled == null ? (parsedConfig.enabled ?? false) : Boolean(row.enabled),
      status: (row.status || parsedConfig.status || "inactive") as ChannelConfigRecord["status"],
      connectionMode: (row.connectionMode || parsedConfig.connectionMode || "webhook") as ChannelConfigRecord["connectionMode"],
      webhookPath: row.webhookPath || parsedConfig.webhookPath || `/channels/${row.id}`,
      webhookSecret: row.webhookSecret || parsedConfig.webhookSecret || "",
      autoReply: row.autoReply == null ? (parsedConfig.autoReply ?? true) : Boolean(row.autoReply),
      replyAgentId: row.replyAgentId || parsedConfig.replyAgentId || "",
      createdAt: row.createdAt ?? parsedConfig.createdAt ?? row.updatedAt,
      updatedAt: row.updatedAt,
      lastMessageAt: row.lastMessageAt ?? parsedConfig.lastMessageAt,
      messageCount: row.messageCount ?? parsedConfig.messageCount ?? 0,
      emailFilters: parsedConfig.emailFilters ?? [],
      emailActions: parsedConfig.emailActions ?? [],
      emailMarkAsRead: parsedConfig.emailMarkAsRead ?? true,
      emailUseGlobalMailService: parsedConfig.emailUseGlobalMailService ?? false,
    },
    runtime: {
      ...baseRuntime,
      ...parsedRuntime,
      messages: parsedRuntime.messages ?? baseRuntime.messages,
      users: parsedRuntime.users ?? baseRuntime.users,
      debugLog: parsedRuntime.debugLog ?? baseRuntime.debugLog,
      health: {
        ...baseRuntime.health,
        ...(parsedRuntime.health ?? {}),
      },
    },
  }
}

function readChannelRows() {
  const database = openDatabase()
  applyMigrations(database)
  return database.prepare(`SELECT id, title, platform, enabled, status, connection_mode as connectionMode, webhook_path as webhookPath, webhook_secret as webhookSecret, auto_reply as autoReply, reply_agent_id as replyAgentId, created_at as createdAt, last_message_at as lastMessageAt, message_count as messageCount, config_json as configJson, runtime_json as runtimeJson, updated_at as updatedAt FROM channels ORDER BY updated_at DESC`).all() as RawChannelRow[]
}

export function listChannelDetails() {
  return readChannelRows().map(parseChannelDetailRow)
}

export function listEnabledChannelDetails() {
  return listChannelDetails().filter((detail) => detail.channel.enabled)
}

export function getChannelDetail(channelId: string) {
  const database = openDatabase()
  applyMigrations(database)
  const row = database.prepare(`SELECT id, title, platform, enabled, status, connection_mode as connectionMode, webhook_path as webhookPath, webhook_secret as webhookSecret, auto_reply as autoReply, reply_agent_id as replyAgentId, created_at as createdAt, last_message_at as lastMessageAt, message_count as messageCount, config_json as configJson, runtime_json as runtimeJson, updated_at as updatedAt FROM channels WHERE id = ?`).get(channelId) as RawChannelRow | undefined
  return row ? parseChannelDetailRow(row) : null
}

export function saveChannelDetail(detail: ChannelDetail) {
  const database = openDatabase()
  applyMigrations(database)
  const now = Date.now()
  database.prepare(`UPDATE channels SET title = ?, platform = ?, enabled = ?, status = ?, connection_mode = ?, webhook_path = ?, webhook_secret = ?, auto_reply = ?, reply_agent_id = ?, created_at = ?, last_message_at = ?, message_count = ?, config_json = ?, runtime_json = ?, updated_at = ? WHERE id = ?`).run(
    detail.channel.title,
    detail.channel.platform,
    detail.channel.enabled ? 1 : 0,
    detail.channel.status,
    detail.channel.connectionMode,
    detail.channel.webhookPath,
    detail.channel.webhookSecret,
    detail.channel.autoReply ? 1 : 0,
    detail.channel.replyAgentId,
    detail.channel.createdAt,
    detail.channel.lastMessageAt ?? null,
    detail.channel.messageCount,
    JSON.stringify({ ...detail.channel, updatedAt: now }),
    JSON.stringify(detail.runtime),
    now,
    detail.channel.id,
  )

  return getChannelDetail(detail.channel.id)
}

export function updateChannelDetail(
  channelId: string,
  updater: (detail: ChannelDetail) => ChannelDetail,
) {
  const current = getChannelDetail(channelId)
  if (!current) {
    return null
  }

  return saveChannelDetail(updater(current))
}
