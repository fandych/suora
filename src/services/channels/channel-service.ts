import {
  bindChannel,
  clearChannelDebugLog,
  confirmWeChatPersonalBinding,
  createChannel,
  getChannel,
  getChannelRuntimeStatus,
  getChannelWebhookRuntimeUrl,
  listChannels,
  restoreChannelRuntime,
  runChannelHealthCheck,
  saveChannel,
  sendChannelReply,
  sendMockChannelMessage,
  startChannelRuntime,
  stopChannelRuntime,
  unbindChannel,
  waitForWeChatPersonalBinding,
} from "@/data/repositories/channel-repository"

export {
  bindChannel,
  clearChannelDebugLog,
  confirmWeChatPersonalBinding,
  createChannel,
  getChannel,
  getChannelRuntimeStatus,
  getChannelWebhookRuntimeUrl,
  listChannels,
  restoreChannelRuntime,
  runChannelHealthCheck,
  saveChannel,
  sendChannelReply,
  sendMockChannelMessage,
  startChannelRuntime,
  stopChannelRuntime,
  unbindChannel,
  waitForWeChatPersonalBinding,
}

export async function getChannelRuntimeCapabilities() {
  return {
    supportsWebhook: true,
    supportsQueuedMessages: true,
    supportsHealthCheck: true,
    supportsStreamStatus: true,
  }
}
