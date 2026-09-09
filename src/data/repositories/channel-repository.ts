import type { ChannelConfigRecord, ChannelDetail, ChannelRuntimeState, ChannelSummary } from "@/data/domain/models"
import { applyDefaultChannelDescription, buildUnboundChannelDetail, resolveDefaultChannelModel } from "@/data/repositories/channel-defaults"
import { ensureChannelCatalogItems } from "@/data/repositories/channel-catalog"
import { emitDataChanged } from "@/data/repositories/data-events"
import { buildChannelWebhookUrl, getChannelCredentialIssues, normalizeChannelConfig } from "@/data/domain/channel-config"
import { listModelProviders } from "@/data/repositories/model-config-repository"
import { projectIpc } from "@/lib/ipc"

function appendDebug(detail: ChannelDetail, tone: "info" | "success" | "error", text: string, timestamp: number) {
  return [
    {
      id: crypto.randomUUID(),
      timestamp,
      tone,
      text,
    },
    ...detail.runtime.debugLog,
  ].slice(0, 300)
}

function mergeDebugLogEntries(current: ChannelRuntimeState["debugLog"], incoming: ChannelRuntimeState["debugLog"]) {
  const merged = [...incoming, ...current]
  const seen = new Set<string>()
  return merged.filter((entry) => {
    if (seen.has(entry.id)) {
      return false
    }
    seen.add(entry.id)
    return true
  }).slice(0, 300)
}

function formatWeChatPersonalDiagnostic(result: {
  status?: string
  upstreamStatus?: string
  diagnosticEvent?: string
  diagnosticMessage?: string
  pollBaseUrl?: string
  pollEndpoint?: string
}) {
  return [
    `status=${result.status || "unknown"}`,
    `upstreamStatus=${result.upstreamStatus || "unknown"}`,
    `event=${result.diagnosticEvent || "unknown"}`,
    `baseUrl=${result.pollBaseUrl || "unknown"}`,
    `endpoint=${result.pollEndpoint || "unknown"}`,
    `message=${result.diagnosticMessage || "none"}`,
  ].join(" | ")
}

async function persist(detail: ChannelDetail) {
  const current = await projectIpc.channels.get(detail.channel.id) as ChannelDetail | null
  const normalized = {
    ...detail,
    channel: normalizeChannelConfig({
      ...detail.channel,
      updatedAt: Date.now(),
    }),
    runtime: {
      ...detail.runtime,
      debugLog: mergeDebugLogEntries(detail.runtime.debugLog, current?.runtime.debugLog ?? []),
    },
  }
  const next = await projectIpc.channels.save(normalized) as ChannelDetail
  emitDataChanged("/channels")
  return next
}

async function syncRuntimeRegistration() {
  await projectIpc.channels.registerRuntime()
  const channels = await listChannels()
  const hasEnabledChannels = channels.some((item) => item.enabled)
  const hasEnabledWebhookTransport = channels.some((item) => item.enabled && item.connectionMode === "webhook")

  if (hasEnabledWebhookTransport) {
    await projectIpc.channels.startRuntime()
    return
  }

  if (!hasEnabledChannels) {
    const status = await projectIpc.channels.getRuntimeStatus() as { running: boolean }
    if (status.running) {
      await projectIpc.channels.stopRuntime()
    }
  }
}

export async function restoreChannelRuntime() {
  await ensureChannelCatalogItems()
  const channels = await listChannels()
  await projectIpc.channels.registerRuntime()
  if (channels.some((item) => item.enabled && item.connectionMode === "webhook")) {
    await projectIpc.channels.startRuntime()
  }
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
  await syncRuntimeRegistration().catch(() => undefined)
  return next
}

export async function unbindChannel(detail: ChannelDetail) {
  const timestamp = Date.now()
  const next = await persist({
    ...buildUnboundChannelDetail(detail),
    runtime: {
      ...detail.runtime,
      debugLog: appendDebug(detail, "info", "Channel binding was removed.", timestamp),
    },
  })
  await syncRuntimeRegistration().catch(() => undefined)
  return next
}

export async function runChannelHealthCheck(detail: ChannelDetail) {
  await syncRuntimeRegistration().catch(() => undefined)
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
  await projectIpc.channels.debugSend({ channelId: detail.channel.id, content: trimmed })
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
    const result = await projectIpc.channels.startWeChatPersonalLogin(detail.channel.id, true) as { success?: boolean; qrCodeUrl?: string; sessionKey?: string; message?: string }
    const hasExistingBinding = detail.channel.wechatPersonalBindingStatus === "bound" && Boolean(detail.channel.wechatPersonalBotToken)
    return persist({
      channel: {
        ...detail.channel,
        connectionMode: "stream",
        wechatPersonalBindingStatus: result.success ? (hasExistingBinding ? "bound" : "pending") : hasExistingBinding ? "bound" : "error",
        wechatPersonalQrStatus: result.success ? "wait" : undefined,
        wechatPersonalSessionKey: result.success ? result.sessionKey : undefined,
        wechatPersonalQrCodeUrl: result.qrCodeUrl || detail.channel.wechatPersonalQrCodeUrl,
        bindingState: result.success ? (hasExistingBinding ? "connected" : "draft") : hasExistingBinding ? "connected" : "error",
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

export async function waitForWeChatPersonalBinding(detail: ChannelDetail, verificationCode?: string, timeoutMs = 35_000) {
  const timestamp = Date.now()

  if (detail.channel.platform !== "wechat_personal") {
    return {
      detail,
      status: "error",
      message: "Channel is not a Personal WeChat binding.",
    }
  }

  const sessionKey = detail.channel.wechatPersonalSessionKey
  const trimmedCode = verificationCode?.trim()
  const result = sessionKey
    ? await projectIpc.channels.waitForWeChatPersonalLogin(detail.channel.id, sessionKey, trimmedCode, timeoutMs) as { success?: boolean; status?: string; message?: string; botToken?: string; baseUrl?: string; accountId?: string; userId?: string; qrCodeUrl?: string; upstreamStatus?: string; diagnosticEvent?: string; diagnosticMessage?: string; pollBaseUrl?: string; pollEndpoint?: string }
    : { success: false, status: "error", message: "Missing WeChat login session." }
  const isAlreadyBoundWithLocalToken = result.status === "already_bound" && Boolean(detail.channel.wechatPersonalBotToken)
  const preservedQrStatus = result.status === "timeout"
    && (detail.channel.wechatPersonalQrStatus === "scaned" || detail.channel.wechatPersonalQrStatus === "need_verifycode")
    ? detail.channel.wechatPersonalQrStatus
    : undefined

  const next = await persist({
    channel: {
      ...detail.channel,
      enabled: result.status === "connected" || isAlreadyBoundWithLocalToken ? true : detail.channel.enabled,
      connectionMode: "stream",
      wechatPersonalBindingStatus: result.status === "connected" || isAlreadyBoundWithLocalToken ? "bound" : result.status === "need_verifycode" || result.status === "timeout" || result.status === "expired" || result.status === "already_bound" || result.status === "scaned" ? "pending" : "error",
      wechatPersonalQrStatus: result.status === "connected" || isAlreadyBoundWithLocalToken
        ? undefined
        : result.status === "need_verifycode"
          ? "need_verifycode"
          : result.status === "scaned"
            ? "scaned"
            : preservedQrStatus
              ? preservedQrStatus
              : result.status === "timeout" || result.status === "expired"
              ? "wait"
              : detail.channel.wechatPersonalQrStatus,
      wechatPersonalSessionKey: result.status === "connected" || isAlreadyBoundWithLocalToken ? undefined : sessionKey,
      wechatPersonalBotToken: result.botToken || detail.channel.wechatPersonalBotToken,
      wechatPersonalBaseUrl: result.baseUrl || detail.channel.wechatPersonalBaseUrl,
      wechatPersonalAccountId: result.accountId || detail.channel.wechatPersonalAccountId,
      wechatPersonalUserId: result.userId || detail.channel.wechatPersonalUserId,
      wechatPersonalQrCodeUrl: result.status === "connected" || isAlreadyBoundWithLocalToken ? undefined : result.qrCodeUrl || detail.channel.wechatPersonalQrCodeUrl,
      bindingState: result.status === "connected" || isAlreadyBoundWithLocalToken ? "connected" : result.success ? "draft" : "error",
    },
    runtime: {
      ...detail.runtime,
      debugLog: appendDebug(
        {
          ...detail,
          runtime: {
            ...detail.runtime,
            debugLog: appendDebug(detail, result.status === "connected" ? "success" : result.success ? "info" : "error", result.message || "Personal WeChat binding updated.", timestamp),
          },
        },
        result.success ? "info" : "error",
        `QR diagnostic: ${formatWeChatPersonalDiagnostic(result)}`,
        timestamp,
      ),
    },
  })
  await syncRuntimeRegistration().catch(() => undefined)

  return {
    detail: next,
    status: result.status ?? "error",
    message: result.message,
  }
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
        wechatPersonalQrStatus: undefined,
        bindingState: "error",
      },
      runtime: {
        ...detail.runtime,
        debugLog: appendDebug(detail, "error", "Verification code must contain at least 4 characters.", timestamp),
      },
    })
  }

  const result = await waitForWeChatPersonalBinding(detail, code)
  return result.detail
}

export async function getChannelRuntimeStatus() {
  return projectIpc.channels.getRuntimeStatus() as Promise<{ running: boolean }>
}

export async function startChannelRuntime() {
  return projectIpc.channels.startRuntime()
}

export async function stopChannelRuntime() {
  return projectIpc.channels.stopRuntime()
}

export async function getChannelWebhookRuntimeUrl(channel: ChannelConfigRecord) {
  const result = await projectIpc.channels.getWebhookUrl(channel) as { success?: boolean; url?: string }
  return result.url ?? buildChannelWebhookUrl(channel)
}

export async function sendChannelReply(payload: { channelId: string; chatId: string; content: string }) {
  return projectIpc.channels.sendMessage(payload) as Promise<{ success: boolean; error?: string }>
}