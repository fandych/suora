import type { TokenCacheEntry } from "@electron/others/channels/channel-runtime-helpers"
import { httpRequest } from "@electron/others/channels/channel-runtime-http"

export const STATIC_TOKEN_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000

export async function getFeishuAccessToken(appId: string, appSecret: string, tokenCache: Map<string, TokenCacheEntry>) {
  const cacheKey = `feishu:${appId}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 300_000) return cached.token

  const response = await httpRequest("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  })
  const data = response.data as { tenant_access_token?: string; expire?: number; code?: number; msg?: string }
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Feishu token error: ${data.msg || "unknown"}`)
  }
  tokenCache.set(cacheKey, { token: data.tenant_access_token, expiresAt: Date.now() + (data.expire || 7200) * 1000 })
  return data.tenant_access_token
}

export async function getDingTalkAccessToken(appKey: string, appSecret: string, tokenCache: Map<string, TokenCacheEntry>) {
  const cacheKey = `dingtalk:${appKey}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 300_000) return cached.token

  const response = await httpRequest("https://api.dingtalk.com/v1.0/oauth2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ appKey, appSecret }),
  })
  const data = response.data as { accessToken?: string; expireIn?: number; code?: string; message?: string }
  if (!data.accessToken) {
    throw new Error(`DingTalk token error: ${data.message || data.code || "unknown"}`)
  }
  tokenCache.set(cacheKey, { token: data.accessToken, expiresAt: Date.now() + (data.expireIn || 7200) * 1000 })
  return data.accessToken
}

export async function getWeChatAccessToken(corpId: string, corpSecret: string, tokenCache: Map<string, TokenCacheEntry>) {
  const cacheKey = `wechat:${corpId}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 300_000) return cached.token

  const response = await httpRequest(`https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(corpId)}&corpsecret=${encodeURIComponent(corpSecret)}`, {
    method: "GET",
  })
  const data = response.data as { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string }
  if (data.errcode !== 0 || !data.access_token) {
    throw new Error(`WeChat token error: ${data.errmsg || "unknown"}`)
  }
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 7200) * 1000 })
  return data.access_token
}

export async function getWeChatOfficialAccessToken(appId: string, appSecret: string, tokenCache: Map<string, TokenCacheEntry>) {
  const cacheKey = `wechat-official:${appId}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 300_000) return cached.token

  const response = await httpRequest(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`, {
    method: "GET",
  })
  const data = response.data as { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string }
  if ((data.errcode != null && data.errcode !== 0) || !data.access_token) {
    throw new Error(`WeChat Official token error: ${data.errmsg || "unknown"}`)
  }
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 7200) * 1000 })
  return data.access_token
}

export async function getWeChatMiniProgramAccessToken(appId: string, appSecret: string, tokenCache: Map<string, TokenCacheEntry>) {
  const cacheKey = `wechat-miniprogram:${appId}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 300_000) return cached.token

  const response = await httpRequest(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`, {
    method: "GET",
  })
  const data = response.data as { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string }
  if ((data.errcode != null && data.errcode !== 0) || !data.access_token) {
    throw new Error(`WeChat Mini Program token error: ${data.errmsg || "unknown"}`)
  }
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 7200) * 1000 })
  return data.access_token
}

export async function getTeamsAccessToken(appId: string, appPassword: string, tokenCache: Map<string, TokenCacheEntry>) {
  const cacheKey = `teams:${appId}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 300_000) return cached.token

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: appId,
    client_secret: appPassword,
    scope: "https://api.botframework.com/.default",
  }).toString()

  const response = await httpRequest("https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const data = response.data as { access_token?: string; expires_in?: number; error?: string; error_description?: string }
  if (!data.access_token) {
    throw new Error(`Teams token error: ${data.error_description || data.error || "unknown"}`)
  }
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 })
  return data.access_token
}
