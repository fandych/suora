import type { ChannelDetail } from "@/data/domain/channel-models"
import { buildUnboundChannelDetail } from "@/data/repositories/channel-defaults"
import { buildChannelWebhookUrl, getChannelCredentialIssues } from "@/data/domain/channel-config"
import { projectIpc } from "@/lib/ipc"
import { appendChannelDebug, formatWeChatPersonalDiagnostic } from "@/data/domain/channel-diagnostics"

type PersistChannel = (detail: ChannelDetail) => Promise<ChannelDetail>
type SyncRuntime = () => Promise<unknown>

type WeChatLoginResult = {
  success?: boolean
  status?: string
  message?: string
  botToken?: string
  baseUrl?: string
  accountId?: string
  userId?: string
  qrCodeUrl?: string
  sessionKey?: string
  upstreamStatus?: string
  diagnosticEvent?: string
  diagnosticMessage?: string
  pollBaseUrl?: string
  pollEndpoint?: string
}

export async function bindChannel(detail: ChannelDetail, persist: PersistChannel, syncRuntime: SyncRuntime) {
  const timestamp = Date.now()
  if (detail.channel.platform === "wechat_personal") {
    const result = await projectIpc.channels.startWeChatPersonalLogin(detail.channel.id, true) as WeChatLoginResult
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
      runtime: { ...detail.runtime, debugLog: appendChannelDebug(detail, result.success ? "info" : "error", result.message || "QR binding session created.", timestamp) },
    })
  }

  const issues = getChannelCredentialIssues(detail.channel)
  if (issues.length) {
    return persist({
      channel: { ...detail.channel, bindingState: "error" },
      runtime: { ...detail.runtime, debugLog: appendChannelDebug(detail, "error", `Binding blocked. Complete these fields first: ${issues.join(", ")}.`, timestamp) },
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
    runtime: { ...detail.runtime, debugLog: appendChannelDebug(detail, "success", `Channel binding is ready. Incoming traffic will use ${callbackUrl}.`, timestamp) },
  })
  await syncRuntime().catch(() => undefined)
  return next
}

  export function startChannelWeChatPersonalLogin(channelId: string, force = false) {
    return projectIpc.channels.startWeChatPersonalLogin(channelId, force)
  }

export async function unbindChannel(detail: ChannelDetail, persist: PersistChannel, syncRuntime: SyncRuntime) {
  const next = await persist({
    ...buildUnboundChannelDetail(detail),
    runtime: { ...detail.runtime, debugLog: appendChannelDebug(detail, "info", "Channel binding was removed.", Date.now()) },
  })
  await syncRuntime().catch(() => undefined)
  return next
}

export async function waitForWeChatPersonalBinding(detail: ChannelDetail, persist: PersistChannel, syncRuntime: SyncRuntime, verificationCode?: string, timeoutMs = 35_000) {
  const timestamp = Date.now()
  if (detail.channel.platform !== "wechat_personal") return { detail, status: "error", message: "Channel is not a Personal WeChat binding." }

  const sessionKey = detail.channel.wechatPersonalSessionKey
  const trimmedCode = verificationCode?.trim()
  const result = sessionKey
    ? await projectIpc.channels.waitForWeChatPersonalLogin(detail.channel.id, sessionKey, trimmedCode, timeoutMs) as WeChatLoginResult
    : { success: false, status: "error", message: "Missing WeChat login session." }
  const isAlreadyBoundWithLocalToken = result.status === "already_bound" && Boolean(detail.channel.wechatPersonalBotToken)
  const preservedQrStatus = result.status === "timeout" && (detail.channel.wechatPersonalQrStatus === "scaned" || detail.channel.wechatPersonalQrStatus === "need_verifycode") ? detail.channel.wechatPersonalQrStatus : undefined
  const connected = result.status === "connected" || isAlreadyBoundWithLocalToken
  const next = await persist({
    channel: {
      ...detail.channel,
      enabled: connected ? true : detail.channel.enabled,
      connectionMode: "stream",
      wechatPersonalBindingStatus: connected ? "bound" : ["need_verifycode", "timeout", "expired", "already_bound", "scaned"].includes(result.status ?? "") ? "pending" : "error",
      wechatPersonalQrStatus: connected ? undefined : result.status === "need_verifycode" ? "need_verifycode" : result.status === "scaned" ? "scaned" : preservedQrStatus ?? (result.status === "timeout" || result.status === "expired" ? "wait" : detail.channel.wechatPersonalQrStatus),
      wechatPersonalSessionKey: connected ? undefined : sessionKey,
      wechatPersonalBotToken: result.botToken || detail.channel.wechatPersonalBotToken,
      wechatPersonalBaseUrl: result.baseUrl || detail.channel.wechatPersonalBaseUrl,
      wechatPersonalAccountId: result.accountId || detail.channel.wechatPersonalAccountId,
      wechatPersonalUserId: result.userId || detail.channel.wechatPersonalUserId,
      wechatPersonalQrCodeUrl: connected ? undefined : result.qrCodeUrl || detail.channel.wechatPersonalQrCodeUrl,
      bindingState: connected ? "connected" : result.success ? "draft" : "error",
    },
    runtime: {
      ...detail.runtime,
      debugLog: appendChannelDebug({ ...detail, runtime: { ...detail.runtime, debugLog: appendChannelDebug(detail, connected ? "success" : result.success ? "info" : "error", result.message || "Personal WeChat binding updated.", timestamp) } }, result.success ? "info" : "error", `QR diagnostic: ${formatWeChatPersonalDiagnostic(result)}`, timestamp),
    },
  })
  await syncRuntime().catch(() => undefined)
  return { detail: next, status: result.status ?? "error", message: result.message }
}
