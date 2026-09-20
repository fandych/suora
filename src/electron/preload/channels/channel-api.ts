import { ipcRenderer } from "electron"

import {
  redactChannelCredentials,
  redactChannelDetail,
} from "@/electron/app/channels/repositories/channel-credential-serialization"

export const channelApi = {
  listAll: async () => {
    const result = await ipcRenderer.invoke("channels:list")
    return Array.isArray(result)
      ? result.map((item) => redactChannelCredentials(item as Record<string, unknown>))
      : result
  },
  get: async (channelId: string) => {
    const result = await ipcRenderer.invoke("channels:get", channelId)
    return result && typeof result === "object" ? redactChannelDetail(result as Record<string, unknown>) : result
  },
  create: async (defaults?: unknown) => {
    const result = await ipcRenderer.invoke("channels:create", defaults)
    return result && typeof result === "object" ? redactChannelDetail(result as Record<string, unknown>) : result
  },
  save: async (payload: unknown) => {
    const result = await ipcRenderer.invoke("channels:save", payload)
    return result && typeof result === "object" ? redactChannelDetail(result as Record<string, unknown>) : result
  },
  delete: (channelId: string) => ipcRenderer.invoke("channels:delete", channelId),
  startRuntime: () => ipcRenderer.invoke("channel:start"),
  syncRuntime: () => ipcRenderer.invoke("channel:syncRuntime"),
  stopRuntime: () => ipcRenderer.invoke("channel:stop"),
  getRuntimeStatus: () => ipcRenderer.invoke("channel:status"),
  registerRuntime: () => ipcRenderer.invoke("channel:register"),
  getWebhookUrl: (channel: unknown) => ipcRenderer.invoke("channel:getWebhookUrl", channel),
  sendMessage: (payload: unknown) => ipcRenderer.invoke("channel:sendMessage", payload),
  sendMessageQueued: (payload: unknown) => ipcRenderer.invoke("channel:sendMessageQueued", payload),
  getAccessToken: (channelId: string) => ipcRenderer.invoke("channel:getAccessToken", channelId),
  healthCheck: (channelId: string) => ipcRenderer.invoke("channel:healthCheck", channelId),
  getStreamStatus: (channelId: string) => ipcRenderer.invoke("channel:streamStatus", channelId),
  debugSend: (payload: unknown) => ipcRenderer.invoke("channel:debugSend", payload),
  startWeChatPersonalLogin: (channelId?: string, force?: boolean) =>
    ipcRenderer.invoke("channel:wechatPersonalLoginStart", channelId, force),
  waitForWeChatPersonalLogin: (
    channelId: string | undefined,
    sessionKey: string,
    verifyCode?: string,
    timeoutMs?: number,
  ) => ipcRenderer.invoke("channel:wechatPersonalLoginWait", channelId, sessionKey, verifyCode, timeoutMs),
  getWeChatPersonalQrPreview: (url: string, waitMs?: number) =>
    ipcRenderer.invoke("channel:wechatPersonalQrPreview", url, waitMs),
}
