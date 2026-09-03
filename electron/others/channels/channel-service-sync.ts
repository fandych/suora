import type { ChannelConfigRecord } from "@/data/domain/models"
import { CustomWebSocketClient } from "@electron/others/channels/custom-websocket-client"
import { DingTalkStreamClient } from "@electron/others/channels/dingtalk-stream"
import { fetchNewEmails, isValidWeChatPersonalToken } from "@electron/others/channels/channel-runtime-helpers"
import { appendDebugLog } from "@electron/others/channels/channel-runtime-persistence"
import type { RuntimeChannelMessage } from "@electron/others/channels/channel-runtime-types"
import { pollWeChatPersonalChannel, readWeChatPersonalSyncCursor, writeWeChatPersonalSyncCursor } from "@electron/others/channels/channel-wechat-personal"

type EmitMessage = (channel: ChannelConfigRecord, message: RuntimeChannelMessage, rawEvent: unknown) => Promise<void>

type SyncContext = {
  channels: Map<string, ChannelConfigRecord>
  streamClients: Map<string, DingTalkStreamClient>
  customSocketClients: Map<string, CustomWebSocketClient>
  weChatPersonalPollers: Map<string, AbortController>
  weChatPersonalContextTokens: Map<string, string>
  emailPollers: Map<string, ReturnType<typeof setInterval>>
  emailLastSeenUid: Map<string, number>
  sessionWebhooks: Map<string, { url: string; expiresAt: number }>
}

export async function syncStreamClients(context: SyncContext, emitMessage: EmitMessage) {
  const activeIds = new Set<string>()
  for (const [id, channel] of context.channels) {
    if (channel.platform === "dingtalk" && channel.connectionMode === "stream" && channel.enabled) {
      activeIds.add(id)
      if (!context.streamClients.has(id)) {
        const client = new DingTalkStreamClient(channel)
        client.onMessage(async (runtimeChannel, message, sessionWebhook) => {
          if (sessionWebhook && message.chatId) {
            context.sessionWebhooks.set(`${runtimeChannel.id}:${message.chatId}`, { url: sessionWebhook, expiresAt: Date.now() + 2 * 60 * 60 * 1000 })
          }
          await emitMessage(runtimeChannel, message, { sessionWebhook })
        })
        context.streamClients.set(id, client)
        void client.connect().catch((error) => appendDebugLog(id, "error", `DingTalk stream connect failed: ${error instanceof Error ? error.message : String(error)}`))
      } else {
        context.streamClients.get(id)?.updateChannel(channel)
      }
    }
  }

  for (const [id, client] of context.streamClients) {
    if (!activeIds.has(id)) {
      await client.disconnect()
      context.streamClients.delete(id)
    }
  }
}

export async function syncCustomSocketClients(context: SyncContext, emitMessage: EmitMessage) {
  const activeIds = new Set<string>()
  for (const [id, channel] of context.channels) {
    if (channel.platform === "custom" && channel.connectionMode === "stream" && channel.enabled && channel.customWebsocketUrl) {
      activeIds.add(id)
      if (!context.customSocketClients.has(id)) {
        const client = new CustomWebSocketClient(channel)
        client.onMessage(async (runtimeChannel, message, rawEvent) => {
          await emitMessage(runtimeChannel, message, rawEvent)
        })
        context.customSocketClients.set(id, client)
        try {
          client.connect()
        } catch (error) {
          appendDebugLog(id, "error", `Custom WebSocket connect failed: ${error instanceof Error ? error.message : String(error)}`)
        }
      } else {
        context.customSocketClients.get(id)?.updateChannel(channel)
      }
    }
  }

  for (const [id, client] of context.customSocketClients) {
    if (!activeIds.has(id)) {
      client.disconnect()
      context.customSocketClients.delete(id)
    }
  }
}

export async function syncWeChatPersonalPollers(context: SyncContext, emitMessage: EmitMessage) {
  const activeIds = new Set<string>()
  for (const [id, channel] of context.channels) {
    if (channel.platform === "wechat_personal" && channel.enabled && channel.wechatPersonalBotToken && isValidWeChatPersonalToken(channel.wechatPersonalBotToken)) {
      activeIds.add(id)
      if (!context.weChatPersonalPollers.has(id)) {
        const controller = new AbortController()
        context.weChatPersonalPollers.set(id, controller)
        void runWeChatPersonalPoller(context, emitMessage, channel, controller)
      }
    }
  }

  for (const [id, controller] of context.weChatPersonalPollers) {
    if (!activeIds.has(id)) {
      controller.abort()
      context.weChatPersonalPollers.delete(id)
    }
  }
}

export function syncEmailPollers(context: SyncContext, emitMessage: EmitMessage) {
  const activeIds = new Set<string>()
  for (const [id, channel] of context.channels) {
    if (channel.platform === "email" && channel.enabled && channel.emailImapHost && channel.emailImapUser) {
      activeIds.add(id)
      if (!context.emailPollers.has(id)) {
        void pollEmailChannel(context, emitMessage, channel)
        const timer = setInterval(() => {
          const current = context.channels.get(id)
          if (current) {
            void pollEmailChannel(context, emitMessage, current)
          }
        }, (channel.emailPollInterval || 60) * 1000)
        context.emailPollers.set(id, timer)
      }
    }
  }

  for (const [id, timer] of context.emailPollers) {
    if (!activeIds.has(id)) {
      clearInterval(timer)
      context.emailPollers.delete(id)
      context.emailLastSeenUid.delete(id)
    }
  }
}

export async function stopAllRuntimeClients(context: SyncContext) {
  for (const client of context.streamClients.values()) {
    await client.disconnect()
  }
  context.streamClients.clear()
  for (const client of context.customSocketClients.values()) {
    client.disconnect()
  }
  context.customSocketClients.clear()
  for (const poller of context.weChatPersonalPollers.values()) {
    poller.abort()
  }
  context.weChatPersonalPollers.clear()
  context.weChatPersonalContextTokens.clear()
  for (const timer of context.emailPollers.values()) {
    clearInterval(timer)
  }
  context.emailPollers.clear()
  context.emailLastSeenUid.clear()
  context.sessionWebhooks.clear()
}

async function runWeChatPersonalPoller(context: SyncContext, emitMessage: EmitMessage, initialChannel: ChannelConfigRecord, controller: AbortController) {
  let cursor = await readWeChatPersonalSyncCursor(initialChannel.id)
  let pollTimeoutMs = 35_000
  try {
    while (!controller.signal.aborted) {
      const channel = context.channels.get(initialChannel.id)
      if (!channel || !channel.enabled || !channel.wechatPersonalBotToken) return
      try {
        const result = await pollWeChatPersonalChannel(channel, cursor, context.weChatPersonalContextTokens, controller.signal)
        const previousCursor = cursor
        cursor = result.nextCursor
        pollTimeoutMs = result.timeoutMs
        await writeWeChatPersonalSyncCursor(channel.id, cursor)
        if ((result.response.ret && result.response.ret !== 0) || (result.response.errcode && result.response.errcode !== 0)) {
          throw new Error(result.response.errmsg || `ret=${result.response.ret ?? "n/a"}, errcode=${result.response.errcode ?? "n/a"}`)
        }
        if (cursor !== previousCursor) {
          await writeWeChatPersonalSyncCursor(channel.id, cursor)
        }
        for (const message of result.messages) {
          await emitMessage(channel, message, result.response)
        }
      } catch (error) {
        if (controller.signal.aborted) return
        appendDebugLog(initialChannel.id, "error", `Personal WeChat poll failed: ${error instanceof Error ? error.message : String(error)}`)
        await new Promise((resolve) => setTimeout(resolve, Math.min(pollTimeoutMs, 5000)))
      }
    }
  } finally {
    if (context.weChatPersonalPollers.get(initialChannel.id) === controller) {
      context.weChatPersonalPollers.delete(initialChannel.id)
    }
  }
}

async function pollEmailChannel(context: SyncContext, emitMessage: EmitMessage, channel: ChannelConfigRecord) {
  try {
    const emails = await fetchNewEmails(channel, context.emailLastSeenUid.get(channel.id) || 0)
    for (const email of emails) {
      if (email.uid > (context.emailLastSeenUid.get(channel.id) || 0)) {
        context.emailLastSeenUid.set(channel.id, email.uid)
      }
      await emitMessage(channel, {
        id: `email-${channel.id}-${email.uid}`,
        channelId: channel.id,
        platform: "email",
        senderId: email.from,
        senderName: email.fromName || email.from,
        content: email.body,
        timestamp: email.date ? new Date(email.date).getTime() : Date.now(),
        messageType: "text",
        chatId: email.from,
        chatType: "private",
      }, { emailMeta: email })
    }
  } catch (error) {
    appendDebugLog(channel.id, "error", `Email polling failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}
