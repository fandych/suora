import type { ChannelConfigRecord } from "@/data/domain/models"
import { httpRequest } from "@electron/others/channels/channel-runtime-http"

export async function sendTelegramMessage(channel: ChannelConfigRecord, chatId: string, content: string) {
  if (!channel.telegramBotToken) return { success: false, error: "Missing Telegram bot token" }
  try {
    const response = await httpRequest(`https://api.telegram.org/bot${channel.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ chat_id: chatId, text: content }),
    })
    const data = response.data as { ok?: boolean; description?: string }
    return data.ok ? { success: true } : { success: false, error: data.description || "Send failed" }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function sendCustomMessage(channel: ChannelConfigRecord, chatId: string, content: string) {
  const endpoint = channel.connectionMode === "stream" ? channel.customWebsocketUrl : channel.customWebhookUrl
  if (!endpoint) return { success: false, error: channel.connectionMode === "stream" ? "Missing custom WebSocket URL" : "Missing custom webhook URL" }
  if (channel.connectionMode === "stream") return sendCustomWebSocketMessage(endpoint, channel.customWebsocketProtocol, channel.customPayloadTemplate, chatId, content)

  try {
    const template = channel.customPayloadTemplate || '{"chat_id":"{{chatId}}","text":"{{content}}"}'
    const body = applyMessageTemplate(template, chatId, content)
    const headers: Record<string, string> = { "Content-Type": "application/json; charset=utf-8" }
    if (channel.customAuthHeader && channel.customAuthValue) headers[channel.customAuthHeader] = channel.customAuthValue
    const response = await httpRequest(endpoint, { method: "POST", headers, body })
    if (response.status >= 400) {
      const data = response.data as { message?: string; error?: string }
      return { success: false, error: data.message || data.error || `HTTP ${response.status}` }
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function sendCustomWebSocketMessage(endpoint: string, protocol: string | undefined, template: string | undefined, chatId: string, content: string) {
  try {
    const socket = new WebSocket(endpoint, protocol ? [protocol] : undefined)
    const payload = applyMessageTemplate(template?.trim() || '{"chatId":"{{chatId}}","content":"{{content}}"}', chatId, content)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { socket.close(); reject(new Error("Custom WebSocket send timeout")) }, 15_000)
      socket.addEventListener("open", () => { socket.send(payload); clearTimeout(timeout); socket.close(); resolve() }, { once: true })
      socket.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("Custom WebSocket send failed")) }, { once: true })
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function applyMessageTemplate(template: string, chatId: string, content: string) {
  return template
    .replace(/\{\{content\}\}/g, () => JSON.stringify(content).slice(1, -1))
    .replace(/\{\{chatId\}\}/g, () => JSON.stringify(chatId).slice(1, -1))
}
