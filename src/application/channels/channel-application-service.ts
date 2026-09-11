import type { ChannelDetail } from "@/data/domain/channel-models"
import {
  clearChannelDebugLog,
  createChannel,
  getChannel,
  getChannelWebhookRuntimeUrl,
  listChannels,
  persistChannelDetail,
  runChannelHealthCheck,
  saveChannel as persistChannel,
} from "@/data/repositories/channel-repository"
import { appendChannelDebug } from "@/data/domain/channel-diagnostics"
import { bindChannel as bindChannelService, unbindChannel as unbindChannelService, waitForWeChatPersonalBinding as waitForWeChatPersonalBindingService } from "@/services/channels/channel-binding-service"
import { getChannelRuntimeStatus, restoreChannelRuntime, startChannelRuntime, stopChannelRuntime, syncChannelRuntimeRegistration } from "@/services/channels/channel-runtime-service"
import { sendChannelReply as sendChannelReplyService, sendMockChannelMessage as sendMockChannelMessageService } from "@/services/channels/channel-messaging-service"
import { projectIpc } from "@/lib/ipc"

async function confirmWeChatPersonalBindingCommand(detail: ChannelDetail, verificationCode: string) {
  const code = verificationCode.trim()
  if (detail.channel.platform !== "wechat_personal") return detail
  if (code.length < 4) {
    return persistChannelDetail({
      channel: { ...detail.channel, wechatPersonalBindingStatus: "error", wechatPersonalQrStatus: undefined, bindingState: "error" },
      runtime: { ...detail.runtime, debugLog: appendChannelDebug(detail, "error", "Verification code must contain at least 4 characters.", Date.now()) },
    })
  }
  const result = await waitForWeChatPersonalBindingService(detail, persistChannelDetail, () => syncChannelRuntimeRegistration(listChannels), code)
  return result.detail
}

export const channelApplicationService = {
  bind: (detail: ChannelDetail) => bindChannelService(detail, persistChannelDetail, () => syncChannelRuntimeRegistration(listChannels)),
  clearDebugLog: clearChannelDebugLog,
  confirmWeChatPersonalBinding: confirmWeChatPersonalBindingCommand,
  create: createChannel,
  get: getChannel,
  getRuntimeStatus: getChannelRuntimeStatus,
  getWebhookRuntimeUrl: getChannelWebhookRuntimeUrl,
  list: listChannels,
  persist: persistChannelDetail,
  restoreRuntime: () => restoreChannelRuntime(listChannels),
  runHealthCheck: runChannelHealthCheck,
  save: async (detail: ChannelDetail) => {
    const saved = await persistChannel(detail)
    await syncChannelRuntimeRegistration(listChannels).catch(() => undefined)
    return saved
  },
  sendChannelReply: sendChannelReplyService,
  sendMockMessage: (detail: ChannelDetail, message: string) => sendMockChannelMessageService(detail, message, () => syncChannelRuntimeRegistration(listChannels), getChannel),
  startRuntime: startChannelRuntime,
  stopRuntime: stopChannelRuntime,
  unbind: (detail: ChannelDetail) => unbindChannelService(detail, persistChannelDetail, () => syncChannelRuntimeRegistration(listChannels)),
  waitForWeChatPersonalBinding: (detail: ChannelDetail, verificationCode?: string, timeoutMs = 35_000) => waitForWeChatPersonalBindingService(detail, persistChannelDetail, () => syncChannelRuntimeRegistration(listChannels), verificationCode, timeoutMs),
}

export const bindChannel = channelApplicationService.bind
export const confirmWeChatPersonalBinding = channelApplicationService.confirmWeChatPersonalBinding
export const saveChannel = channelApplicationService.save
export const unbindChannel = channelApplicationService.unbind
export const waitForWeChatPersonalBinding = channelApplicationService.waitForWeChatPersonalBinding
export const sendChannelReply = channelApplicationService.sendChannelReply
export { createChannel, getChannel, getChannelWebhookRuntimeUrl, listChannels, projectIpc }