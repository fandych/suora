import type { ChannelConfigRecord, ChannelDetail, ChannelSummary } from "@/data/domain/models"
import { applyDefaultChannelDescription, resolveDefaultChannelModel } from "@/data/repositories/channel-defaults"
import { ensureChannelCatalogItems } from "@/data/repositories/channel-catalog"
import { emitDataChanged } from "@/data/repositories/data-events"
import { buildChannelWebhookUrl, normalizeChannelConfig } from "@/data/domain/channel-config"
import { listModelProviders } from "@/data/repositories/model-config-repository"
import { projectIpc } from "@/lib/ipc"
import { getChannelRuntimeStatus as getRuntimeStatus, restoreChannelRuntime as restoreRuntime, startChannelRuntime as startRuntime, stopChannelRuntime as stopRuntime, syncChannelRuntimeRegistration } from "@/services/channels/channel-runtime-service"
import { appendChannelDebug, formatWeChatPersonalDiagnostic, mergeChannelDebugLogEntries } from "@/services/channels/channel-diagnostics-service"
import { bindChannel as bindChannelService, unbindChannel as unbindChannelService, waitForWeChatPersonalBinding as waitForWeChatPersonalBindingService } from "@/services/channels/channel-binding-service"
import { sendChannelReply as sendChannelReplyService, sendMockChannelMessage as sendMockChannelMessageService } from "@/services/channels/channel-messaging-service"

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

export async function restoreChannelRuntime() {
  return restoreRuntime(listChannels)
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
  await syncChannelRuntimeRegistration(listChannels).catch(() => undefined)
  return next
}

export async function runChannelHealthCheck(detail: ChannelDetail) {
  await syncChannelRuntimeRegistration(listChannels).catch(() => undefined)
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

async function legacyWaitForWeChatPersonalBinding(detail: ChannelDetail, verificationCode?: string, timeoutMs = 35_000) {
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
      debugLog: appendChannelDebug(
        {
          ...detail,
          runtime: {
            ...detail.runtime,
            debugLog: appendChannelDebug(detail, result.status === "connected" ? "success" : result.success ? "info" : "error", result.message || "Personal WeChat binding updated.", timestamp),
          },
        },
        result.success ? "info" : "error",
        `QR diagnostic: ${formatWeChatPersonalDiagnostic(result)}`,
        timestamp,
      ),
    },
  })
  await syncChannelRuntimeRegistration(listChannels).catch(() => undefined)

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
        debugLog: appendChannelDebug(detail, "error", "Verification code must contain at least 4 characters.", timestamp),
      },
    })
  }

  const result = await legacyWaitForWeChatPersonalBinding(detail, code)
  return result.detail
}

export const getChannelRuntimeStatus = getRuntimeStatus
export const startChannelRuntime = startRuntime
export const stopChannelRuntime = stopRuntime

export const persist = persistChannelDetail
export const bindChannel = (detail: ChannelDetail) => bindChannelService(detail, persistChannelDetail, () => syncChannelRuntimeRegistration(listChannels))
export const unbindChannel = (detail: ChannelDetail) => unbindChannelService(detail, persistChannelDetail, () => syncChannelRuntimeRegistration(listChannels))
export const waitForWeChatPersonalBinding = (detail: ChannelDetail, verificationCode?: string, timeoutMs = 35_000) => waitForWeChatPersonalBindingService(detail, persistChannelDetail, () => syncChannelRuntimeRegistration(listChannels), verificationCode, timeoutMs)

export async function getChannelWebhookRuntimeUrl(channel: ChannelConfigRecord) {
  const result = await projectIpc.channels.getWebhookUrl({ id: channel.id }) as { success?: boolean; url?: string }
  return result.url ?? buildChannelWebhookUrl(channel)
}

export const sendMockChannelMessage = (detail: ChannelDetail, message: string) => sendMockChannelMessageService(detail, message, () => syncChannelRuntimeRegistration(listChannels), getChannel)
export const sendChannelReply = sendChannelReplyService