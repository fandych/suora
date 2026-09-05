import type { ChannelConfigRecord } from "@/data/domain/models"
import {
  getDingTalkAccessToken,
  getFeishuAccessToken,
  getTeamsAccessToken,
  getWeChatAccessToken,
  getWeChatMiniProgramAccessToken,
  getWeChatOfficialAccessToken,
  httpRequest,
  sendCustomMessage,
  sendEmailMessage,
  sendTelegramMessage,
  sendWeChatPersonalNativeMessage,
  type TokenCacheEntry,
} from "@electron/others/channels/channel-runtime-helpers"

export async function sendMessageForChannel(
  channel: ChannelConfigRecord,
  chatId: string,
  content: string,
  tokenCache: Map<string, TokenCacheEntry>,
  contextToken?: string,
) {
  switch (channel.platform) {
    case "feishu":
      return sendFeishu(channel, chatId, content, tokenCache)
    case "dingtalk":
      if (channel.connectionMode === "webhook" && channel.dingtalkWebhookUrl) {
        return sendDingTalkWebhook(channel, content)
      }
      return sendDingTalk(channel, chatId, content, tokenCache)
    case "wechat":
      return sendWeChatWork(channel, chatId, content, tokenCache)
    case "wechat_official":
      return sendWeChatOfficial(channel, chatId, content, tokenCache)
    case "wechat_miniprogram":
      return sendWeChatMiniProgram(channel, chatId, content, tokenCache)
    case "wechat_personal":
      if (channel.wechatPersonalBotToken) {
        return sendWeChatPersonalNativeMessage(channel, chatId, content, contextToken)
      }
      return sendCustomMessage({
        ...channel,
        customWebhookUrl: channel.wechatPersonalWebhookUrl,
        customAuthHeader: channel.wechatPersonalAuthToken ? "Authorization" : undefined,
        customAuthValue: channel.wechatPersonalAuthToken ? `Bearer ${channel.wechatPersonalAuthToken}` : undefined,
        customPayloadTemplate: channel.customPayloadTemplate || '{\n  "chat_id": "{{chatId}}",\n  "text": "{{content}}",\n  "platform": "wechat_personal"\n}',
      }, chatId, content)
    case "telegram":
      return sendTelegramMessage(channel, chatId, content)
    case "teams":
      return sendTeams(channel, chatId, content, tokenCache)
    case "email":
      return sendEmailMessage(channel, chatId, "Re: Message", content)
    case "custom":
      return sendCustomMessage(channel, chatId, content)
    case "web":
    default:
      return { success: false, error: `Unsupported platform: ${channel.platform}` }
  }
}

async function sendFeishu(channel: ChannelConfigRecord, chatId: string, content: string, tokenCache: Map<string, TokenCacheEntry>) {
  const appId = channel.feishuAppId || channel.appId
  const appSecret = channel.feishuAppSecret || channel.appSecret
  if (!appId || !appSecret) return { success: false, error: "Missing appId or appSecret" }
  try {
    const token = await getFeishuAccessToken(appId, appSecret, tokenCache)
    const response = await httpRequest("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ receive_id: chatId, msg_type: "text", content: JSON.stringify({ text: content }) }),
    })
    const data = response.data as { code?: number; msg?: string }
    return data.code === 0 ? { success: true } : { success: false, error: data.msg || "Send failed" }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function sendDingTalk(channel: ChannelConfigRecord, chatId: string, content: string, tokenCache: Map<string, TokenCacheEntry>) {
  const appKey = channel.dingtalkClientId || channel.appId
  const appSecret = channel.dingtalkClientSecret || channel.appSecret
  const agentId = channel.dingtalkRobotCode
  if (!appKey || !appSecret || !agentId) {
    return { success: false, error: "Missing DingTalk client ID, client secret, or agent ID" }
  }
  try {
    const token = await getDingTalkAccessToken(appKey, appSecret, tokenCache)
    const response = await httpRequest(`https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ agent_id: agentId, to_all_user: false, userid_list: chatId, msg: { msgtype: "text", text: { content } } }),
    })
    const data = response.data as { errcode?: number; errmsg?: string }
    return data.errcode === 0 ? { success: true } : { success: false, error: data.errmsg || "Send failed" }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function sendDingTalkWebhook(channel: ChannelConfigRecord, content: string) {
  try {
    const response = await httpRequest(channel.dingtalkWebhookUrl || "", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ msgtype: "text", text: { content } }),
    })
    const data = response.data as { errcode?: number; errmsg?: string }
    return data.errcode == null || data.errcode === 0 ? { success: true } : { success: false, error: data.errmsg || "Send failed" }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function sendWeChatWork(channel: ChannelConfigRecord, chatId: string, content: string, tokenCache: Map<string, TokenCacheEntry>) {
  const corpId = channel.wechatCorpId || channel.appId
  const corpSecret = channel.appSecret
  const agentId = channel.wechatAgentId
  if (!corpId || !corpSecret || !agentId) return { success: false, error: "Missing WeChat credentials" }
  try {
    const token = await getWeChatAccessToken(corpId, corpSecret, tokenCache)
    const response = await httpRequest(`https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ touser: chatId, msgtype: "text", agentid: agentId, text: { content } }),
    })
    const data = response.data as { errcode?: number; errmsg?: string }
    return data.errcode === 0 ? { success: true } : { success: false, error: data.errmsg || "Send failed" }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function sendWeChatOfficial(channel: ChannelConfigRecord, chatId: string, content: string, tokenCache: Map<string, TokenCacheEntry>) {
  const appId = channel.wechatOfficialAppId || channel.appId
  const appSecret = channel.wechatOfficialAppSecret || channel.appSecret
  if (!appId || !appSecret) {
    return { success: false, error: "Missing WeChat Official Account app ID or app secret" }
  }

  try {
    const token = await getWeChatOfficialAccessToken(appId, appSecret, tokenCache)
    const response = await httpRequest(`https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        touser: chatId,
        msgtype: "text",
        text: { content },
      }),
    })
    const data = response.data as { errcode?: number; errmsg?: string }
    return data.errcode === 0 ? { success: true } : { success: false, error: data.errmsg || "Send failed" }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function sendWeChatMiniProgram(channel: ChannelConfigRecord, chatId: string, content: string, tokenCache: Map<string, TokenCacheEntry>) {
  const appId = channel.wechatMiniProgramAppId || channel.appId
  const appSecret = channel.wechatMiniProgramAppSecret || channel.appSecret
  if (!appId || !appSecret) {
    return { success: false, error: "Missing WeChat Mini Program app ID or app secret" }
  }

  try {
    const token = await getWeChatMiniProgramAccessToken(appId, appSecret, tokenCache)
    const response = await httpRequest(`https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        touser: chatId,
        msgtype: "text",
        text: { content },
      }),
    })
    const data = response.data as { errcode?: number; errmsg?: string }
    return data.errcode === 0 ? { success: true } : { success: false, error: data.errmsg || "Send failed" }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function sendTeams(channel: ChannelConfigRecord, chatId: string, content: string, tokenCache: Map<string, TokenCacheEntry>) {
  if (!channel.teamsAppId || !channel.teamsAppPassword) return { success: false, error: "Missing Teams app ID or password" }
  try {
    const token = await getTeamsAccessToken(channel.teamsAppId, channel.teamsAppPassword, tokenCache)
    const [serviceUrl, conversationId = chatId] = chatId.split("|")
    const baseUrl = serviceUrl.endsWith("/") ? serviceUrl : `${serviceUrl}/`
    const response = await httpRequest(`${baseUrl}v3/conversations/${encodeURIComponent(conversationId)}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: "message", text: content }),
    })
    if (response.status >= 400) {
      const data = response.data as { message?: string; error?: { message?: string } }
      return { success: false, error: data.error?.message || data.message || `HTTP ${response.status}` }
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
