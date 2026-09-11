import { channelApplicationService } from "@/application/channels/channel-application-service"

export const bindChannel = channelApplicationService.bind
export const clearChannelDebugLog = channelApplicationService.clearDebugLog
export const confirmWeChatPersonalBinding = channelApplicationService.confirmWeChatPersonalBinding
export const createChannel = channelApplicationService.create
export const getChannel = channelApplicationService.get
export const getChannelRuntimeStatus = channelApplicationService.getRuntimeStatus
export const getChannelWebhookRuntimeUrl = channelApplicationService.getWebhookRuntimeUrl
export const listChannels = channelApplicationService.list
export const restoreChannelRuntime = channelApplicationService.restoreRuntime
export const runChannelHealthCheck = channelApplicationService.runHealthCheck
export const saveChannel = channelApplicationService.save
export const sendChannelReply = channelApplicationService.sendChannelReply
export const sendMockChannelMessage = channelApplicationService.sendMockMessage
export const startChannelRuntime = channelApplicationService.startRuntime
export const stopChannelRuntime = channelApplicationService.stopRuntime
export const unbindChannel = channelApplicationService.unbind
export const waitForWeChatPersonalBinding = channelApplicationService.waitForWeChatPersonalBinding

export async function getChannelRuntimeCapabilities() {
  return {
    supportsWebhook: true,
    supportsQueuedMessages: true,
    supportsHealthCheck: true,
    supportsStreamStatus: true,
  }
}
