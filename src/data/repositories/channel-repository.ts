import type { ChannelConfigRecord, ChannelDetail, ChannelRuntimeState, ChannelSummary } from "@/data/domain/models"
import { channels } from "@/data/db/schema"
import { executePersistedMutation, getDatabaseContext } from "@/data/db/client"
import { emitDataChanged } from "@/data/repositories/data-events"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { buildChannelWebhookUrl, getChannelCredentialIssues, normalizeChannelConfig } from "@/lib/channel-config"
import { suoraIpc } from "@/lib/ipc"

type ChannelCatalogTemplate = {
  id: string
  title: string
  platform: ChannelConfigRecord["platform"]
  connectionMode: ChannelConfigRecord["connectionMode"]
  customPlatformName?: string
}

const channelCatalogTemplates: ChannelCatalogTemplate[] = [
  { id: "channel-wechat-personal", title: "Personal WeChat", platform: "wechat_personal", connectionMode: "stream" },
  { id: "channel-wecom-enterprise", title: "Enterprise WeChat", platform: "wechat", connectionMode: "webhook" },
  { id: "channel-feishu", title: "Feishu", platform: "feishu", connectionMode: "webhook" },
  { id: "channel-dingtalk", title: "DingTalk", platform: "dingtalk", connectionMode: "stream" },
  { id: "channel-teams", title: "Microsoft Teams", platform: "teams", connectionMode: "webhook" },
  { id: "channel-telegram", title: "Telegram", platform: "telegram", connectionMode: "webhook" },
  { id: "channel-email-inbox", title: "Email Inbox", platform: "email", connectionMode: "stream" },
  { id: "channel-custom-webhook", title: "Custom Webhook", platform: "custom", connectionMode: "webhook", customPlatformName: "Custom Webhook" },
  { id: "channel-custom-websocket", title: "Custom WebSocket", platform: "custom", connectionMode: "stream", customPlatformName: "Custom WebSocket" },
]

let ensureChannelCatalogPromise: Promise<void> | undefined
let hasEnsuredChannelCatalog = false

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

function createCatalogChannel(template: ChannelCatalogTemplate, now: number): ChannelDetail {
  const channel = normalizeChannelConfig({
    id: template.id,
    title: template.title,
    platform: template.platform,
    catalogId: `catalog-${template.id.replace(/^channel-/, "")}`,
    enabled: false,
    status: "inactive",
    bindingState: "unconfigured",
    connectionMode: template.connectionMode,
    webhookPath: `/channels/${template.id.replace(/^channel-/, "")}`,
    webhookSecret: "",
    autoReply: true,
    replyAgentId: "agent-crm-sync",
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    emailFilters: [],
    emailActions: [],
    emailMarkAsRead: true,
    customPlatformName: template.customPlatformName,
    wechatPersonalBindingStatus: template.platform === "wechat_personal" ? "unbound" : undefined,
  })

  return {
    channel,
    runtime: createDefaultRuntime(),
  }
}

async function ensureChannelCatalogItems() {
  await ensureSeeded()

  if (hasEnsuredChannelCatalog) {
    return
  }

  if (!ensureChannelCatalogPromise) {
    ensureChannelCatalogPromise = (async () => {
      const context = await getDatabaseContext()
      const existingRows = await context.db.select({ id: channels.id }).from(channels).all()
      const existingIds = new Set(existingRows.map((row) => row.id))
      const missing = channelCatalogTemplates.filter((item) => !existingIds.has(item.id))

      if (!missing.length) {
        hasEnsuredChannelCatalog = true
        return
      }

      await executePersistedMutation(async ({ db }) => {
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

function appendDebug(detail: ChannelDetail, tone: "info" | "success" | "error", text: string, timestamp: number) {
  return [
    {
      id: crypto.randomUUID(),
      timestamp,
      tone,
      text,
    },
    ...detail.runtime.debugLog,
  ]
}

async function persist(detail: ChannelDetail) {
  const normalized = {
    ...detail,
    channel: normalizeChannelConfig({
      ...detail.channel,
      updatedAt: Date.now(),
    }),
  }
  const next = await suoraIpc.channels.save(normalized) as ChannelDetail
  emitDataChanged("/channels")
  return next
}

async function syncRuntimeRegistration() {
  await suoraIpc.channels.registerRuntime()
  const channels = await listChannels()
  const hasEnabledChannels = channels.some((item) => item.enabled)
  const hasEnabledWebhookTransport = channels.some((item) => item.enabled && item.connectionMode === "webhook")

  if (hasEnabledWebhookTransport) {
    await suoraIpc.channels.startRuntime()
    return
  }

  if (!hasEnabledChannels) {
    const status = await suoraIpc.channels.getRuntimeStatus() as { running: boolean }
    if (status.running) {
      await suoraIpc.channels.stopRuntime()
    }
  }
}

export async function restoreChannelRuntime() {
  await ensureChannelCatalogItems()
  const channels = await listChannels()
  await suoraIpc.channels.registerRuntime()
  if (channels.some((item) => item.enabled && item.connectionMode === "webhook")) {
    await suoraIpc.channels.startRuntime()
  }
}

function createWeChatPersonalQrDataUrl(channel: ChannelConfigRecord) {
  const label = encodeURIComponent(channel.title)
  const session = encodeURIComponent(channel.id)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><rect width="320" height="320" rx="28" fill="#fff7ed"/><rect x="28" y="28" width="264" height="264" rx="20" fill="#ffffff" stroke="#fdba74" stroke-width="8"/><path d="M84 84h48v48H84zM188 84h48v48h-48zM84 188h48v48H84z" fill="#111827"/><path d="M148 84h20v20h-20zM172 108h20v20h-20zM148 132h20v20h-20zM196 156h20v20h-20zM220 180h20v20h-20zM148 204h20v20h-20zM172 228h20v20h-20z" fill="#fb923c"/><text x="160" y="274" font-family="Arial, sans-serif" font-size="18" text-anchor="middle" fill="#9a3412">Scan to bind ${label}</text><text x="160" y="296" font-family="Arial, sans-serif" font-size="11" text-anchor="middle" fill="#c2410c">session ${session}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export async function listChannels() {
  await ensureChannelCatalogItems()
  return suoraIpc.channels.list() as Promise<ChannelSummary[]>
}

export async function getChannel(channelId: string) {
  await ensureChannelCatalogItems()
  const item = await suoraIpc.channels.get(channelId) as ChannelDetail | null
  if (!item) {
    throw new Error(`Channel ${channelId} was not found.`)
  }
  return item
}

export async function createChannel() {
  await ensureChannelCatalogItems()
  const item = await suoraIpc.channels.create() as Promise<ChannelDetail>
  emitDataChanged("/channels")
  return item
}

export async function saveChannel(payload: ChannelDetail) {
  await ensureChannelCatalogItems()
  const next = await persist(payload)
  await syncRuntimeRegistration().catch(() => undefined)
  return next
}

export async function runChannelHealthCheck(detail: ChannelDetail) {
  await syncRuntimeRegistration().catch(() => undefined)
  const result = await suoraIpc.channels.healthCheck(detail.channel.id) as { isHealthy: boolean; latencyMs: number; error?: string }
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
      debugLog: appendDebug(refreshed, result.isHealthy ? "success" : "error", result.isHealthy ? "Health check passed." : result.error || "Health check failed.", timestamp),
    },
  })
}

export async function sendMockChannelMessage(detail: ChannelDetail, message: string) {
  const trimmed = message.trim()
  if (!trimmed) {
    return detail
  }
  await syncRuntimeRegistration().catch(() => undefined)
  await suoraIpc.channels.debugSend({ channelId: detail.channel.id, content: trimmed })
  return getChannel(detail.channel.id)
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

export async function bindChannel(detail: ChannelDetail) {
  const timestamp = Date.now()
  if (detail.channel.platform === "wechat_personal") {
    const result = await suoraIpc.channels.startWeChatPersonalLogin(true) as { success?: boolean; qrCodeUrl?: string; sessionKey?: string; message?: string }
    return persist({
      channel: {
        ...detail.channel,
        connectionMode: "stream",
        wechatPersonalBindingStatus: result.success ? "pending" : "error",
        wechatPersonalSessionKey: result.sessionKey,
        wechatPersonalQrCodeUrl: result.qrCodeUrl ?? createWeChatPersonalQrDataUrl(detail.channel),
        bindingState: result.success ? "draft" : "error",
      },
      runtime: {
        ...detail.runtime,
        debugLog: appendDebug(detail, result.success ? "info" : "error", result.message || "QR binding session created.", timestamp),
      },
    })
  }

  const issues = getChannelCredentialIssues(detail.channel)
  if (issues.length) {
    return persist({
      channel: {
        ...detail.channel,
        bindingState: "error",
      },
      runtime: {
        ...detail.runtime,
        debugLog: appendDebug(detail, "error", `Binding blocked. Complete these fields first: ${issues.join(", ")}.`, timestamp),
      },
    })
  }

  const callbackUrl = buildChannelWebhookUrl(detail.channel)
  const next = await persist({
    channel: {
      ...detail.channel,
      enabled: true,
      callbackUrl,
      teamsBotEndpoint: detail.channel.platform === "teams" ? callbackUrl : detail.channel.teamsBotEndpoint,
      bindingState: "connected",
    },
    runtime: {
      ...detail.runtime,
      debugLog: appendDebug(detail, "success", `Channel binding is ready. Incoming traffic will use ${callbackUrl}.`, timestamp),
    },
  })
  await syncRuntimeRegistration().catch(() => undefined)
  return next
}

export async function confirmWeChatPersonalBinding(detail: ChannelDetail, verificationCode: string) {
  const code = verificationCode.trim()
  const timestamp = Date.now()

  if (detail.channel.platform !== "wechat_personal") {
    return detail
  }

  if (code.length < 4) {
    return persist({
      channel: {
        ...detail.channel,
        wechatPersonalBindingStatus: "error",
        bindingState: "error",
      },
      runtime: {
        ...detail.runtime,
        debugLog: appendDebug(detail, "error", "Verification code must contain at least 4 characters.", timestamp),
      },
    })
  }

  const sessionKey = detail.channel.wechatPersonalSessionKey
  const result = sessionKey
    ? await suoraIpc.channels.waitForWeChatPersonalLogin(sessionKey, code, 60_000) as { success?: boolean; status?: string; message?: string; botToken?: string; baseUrl?: string; accountId?: string; userId?: string; qrCodeUrl?: string }
    : { success: false, status: "error", message: "Missing WeChat login session." }

  const next = await persist({
    channel: {
      ...detail.channel,
      enabled: result.status === "connected" ? true : detail.channel.enabled,
      connectionMode: "stream",
      wechatPersonalBindingStatus: result.status === "connected" ? "bound" : result.status === "need_verifycode" ? "pending" : "error",
      wechatPersonalSessionKey: result.status === "connected" ? undefined : sessionKey,
      wechatPersonalBotToken: result.botToken || detail.channel.wechatPersonalBotToken,
      wechatPersonalBaseUrl: result.baseUrl || detail.channel.wechatPersonalBaseUrl,
      wechatPersonalAccountId: result.accountId || detail.channel.wechatPersonalAccountId,
      wechatPersonalUserId: result.userId || detail.channel.wechatPersonalUserId,
      wechatPersonalQrCodeUrl: result.qrCodeUrl || detail.channel.wechatPersonalQrCodeUrl,
      bindingState: result.status === "connected" ? "connected" : result.success ? "draft" : "error",
    },
    runtime: {
      ...detail.runtime,
      debugLog: appendDebug(detail, result.status === "connected" ? "success" : result.success ? "info" : "error", result.message || "Personal WeChat binding updated.", timestamp),
    },
  })
  await syncRuntimeRegistration().catch(() => undefined)
  return next
}

export async function getChannelRuntimeStatus() {
  return suoraIpc.channels.getRuntimeStatus() as Promise<{ running: boolean }>
}

export async function startChannelRuntime() {
  return suoraIpc.channels.startRuntime()
}

export async function stopChannelRuntime() {
  return suoraIpc.channels.stopRuntime()
}

export async function getChannelWebhookRuntimeUrl(channel: ChannelConfigRecord) {
  const result = await suoraIpc.channels.getWebhookUrl(channel) as { success?: boolean; url?: string }
  return result.url ?? buildChannelWebhookUrl(channel)
}

export async function sendChannelReply(payload: { channelId: string; chatId: string; content: string }) {
  return suoraIpc.channels.sendMessage(payload) as Promise<{ success: boolean; error?: string }>
}