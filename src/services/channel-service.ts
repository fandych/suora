import type { ChannelDetail, ChannelSummary } from "@/types/channel"

export const ChannelApi = {
  listAll: () => window.app!.channels.listAll() as Promise<ChannelSummary[]>,
  get: (channelId: string) => window.app!.channels.get(channelId) as Promise<ChannelDetail | null>,
  create: (defaults?: unknown) => window.app!.channels.create(defaults) as Promise<ChannelDetail>,
  save: (payload: ChannelDetail) => window.app!.channels.save(payload) as Promise<ChannelDetail>,
  remove: (channelId: string) => window.app!.channels.delete(channelId),
  startRuntime: () => window.app!.channels.startRuntime(),
  stopRuntime: () => window.app!.channels.stopRuntime(),
  syncRuntime: () => window.app!.channels.syncRuntime(),
  runtimeStatus: () => window.app!.channels.getRuntimeStatus(),
  healthCheck: (channelId: string) => window.app!.channels.healthCheck(channelId),
  sendMessage: (payload: unknown) => window.app!.channels.sendMessage(payload),
  sendMessageQueued: (payload: unknown) => window.app!.channels.sendMessageQueued(payload),
  getWebhookUrl: (channelId: string) => window.app!.channels.getWebhookUrl({ id: channelId }),
  debugSend: (payload: unknown) => window.app!.channels.debugSend(payload),
  startWeChatPersonalLogin: (channelId: string, force = false) =>
    window.app!.channels.startWeChatPersonalLogin(channelId, force),
  waitForWeChatPersonalLogin: (channelId: string, sessionKey: string, verifyCode?: string, timeoutMs?: number) =>
    window.app!.channels.waitForWeChatPersonalLogin(channelId, sessionKey, verifyCode, timeoutMs),
}

export const bindChannel = async (detail: ChannelDetail) => {
  if (detail.channel.platform === "wechat_personal") {
    const result = (await ChannelApi.startWeChatPersonalLogin(detail.channel.id, true)) as {
      success?: boolean
      sessionKey?: string
      qrCodeUrl?: string
    }
    return ChannelApi.save({
      ...detail,
      channel: {
        ...detail.channel,
        connectionMode: "stream",
        wechatPersonalBindingStatus: result.success ? "pending" : "error",
        wechatPersonalQrStatus: result.success ? "wait" : undefined,
        wechatPersonalSessionKey: result.sessionKey,
        wechatPersonalQrCodeUrl: result.qrCodeUrl ?? detail.channel.wechatPersonalQrCodeUrl,
        bindingState: result.success ? "draft" : "error",
      },
    })
  }
  return ChannelApi.save({ ...detail, channel: { ...detail.channel, enabled: true, bindingState: "connected" } })
}

export const unbindChannel = (detail: ChannelDetail) =>
  ChannelApi.save({
    ...detail,
    channel: { ...detail.channel, enabled: false, bindingState: "unconfigured", wechatPersonalSessionKey: undefined },
  })

export const waitForWeChatPersonalBinding = async (
  detail: ChannelDetail,
  verificationCode?: string,
  timeoutMs = 35_000,
) => {
  const sessionKey = detail.channel.wechatPersonalSessionKey
  if (!sessionKey) return { detail, status: "error", message: "Missing WeChat login session." }
  const result = (await ChannelApi.waitForWeChatPersonalLogin(
    detail.channel.id,
    sessionKey,
    verificationCode?.trim(),
    timeoutMs,
  )) as {
    status?: string
    success?: boolean
    message?: string
    botToken?: string
    baseUrl?: string
    accountId?: string
    userId?: string
    qrCodeUrl?: string
  }
  const connected = result.status === "connected" || result.status === "already_bound"
  const next = await ChannelApi.save({
    ...detail,
    channel: {
      ...detail.channel,
      enabled: connected,
      wechatPersonalBindingStatus: connected ? "bound" : "pending",
      wechatPersonalBotToken: result.botToken ?? detail.channel.wechatPersonalBotToken,
      wechatPersonalBaseUrl: result.baseUrl ?? detail.channel.wechatPersonalBaseUrl,
      wechatPersonalAccountId: result.accountId ?? detail.channel.wechatPersonalAccountId,
      wechatPersonalUserId: result.userId ?? detail.channel.wechatPersonalUserId,
      wechatPersonalQrCodeUrl: connected ? undefined : (result.qrCodeUrl ?? detail.channel.wechatPersonalQrCodeUrl),
      bindingState: connected ? "connected" : "draft",
    },
  })
  return { detail: next, status: result.status ?? "error", message: result.message }
}

export const confirmWeChatPersonalBinding = async (detail: ChannelDetail, verificationCode: string) => {
  const result = await waitForWeChatPersonalBinding(detail, verificationCode)
  return result.detail
}
export const clearChannelDebugLog = (detail: ChannelDetail) =>
  ChannelApi.save({ ...detail, runtime: { ...detail.runtime, debugLog: [] } })
export const createChannel = ChannelApi.create
export const getChannel = async (channelId: string) => {
  const detail = await ChannelApi.get(channelId)
  if (!detail) throw new Error(`Channel ${channelId} was not found.`)
  return detail
}
export const getChannelRuntimeStatus = ChannelApi.runtimeStatus
export const getChannelWebhookRuntimeUrl = (channel: { id: string }) => ChannelApi.getWebhookUrl(channel.id)
export const listChannels = ChannelApi.listAll
export const runChannelHealthCheck = (detail: ChannelDetail) =>
  ChannelApi.healthCheck(detail.channel.id).then(() => ChannelApi.get(detail.channel.id))
export const saveChannel = ChannelApi.save
export const sendChannelReply = (payload: { channelId: string; chatId: string; content: string }) =>
  ChannelApi.sendMessage(payload) as Promise<{ success: boolean; error?: string }>
export const sendMockChannelMessage = (detail: ChannelDetail, message: string) =>
  ChannelApi.debugSend({ channelId: detail.channel.id, content: message })
export const startChannelRuntime = ChannelApi.startRuntime
export const stopChannelRuntime = ChannelApi.stopRuntime
export const getChannelRuntimeCapabilities = async () => ({
  supportsWebhook: true,
  supportsQueuedMessages: true,
  supportsHealthCheck: true,
  supportsStreamStatus: true,
})

export type { ChannelDetail, ChannelSummary }
