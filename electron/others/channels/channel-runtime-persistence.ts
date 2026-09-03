import crypto from "node:crypto"

import type { ChannelConfigRecord } from "@/data/domain/models"
import type { ChannelHealthStatus, RuntimeChannelMessage } from "@electron/others/channels/channel-runtime-types"
import { getChannelDetail, saveChannelDetail, updateChannelDetail } from "@electron/others/channels/channel-store"

export function appendDebugLog(channelId: string, tone: "info" | "success" | "error", text: string) {
  return updateChannelDetail(channelId, (detail) => ({
    ...detail,
    runtime: {
      ...detail.runtime,
      debugLog: [
        {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          tone,
          text,
        },
        ...detail.runtime.debugLog,
      ].slice(0, 100),
    },
  }))
}

export function recordHealthCheck(channelId: string, health: ChannelHealthStatus) {
  return updateChannelDetail(channelId, (detail) => ({
    ...detail,
    channel: {
      ...detail.channel,
      status: detail.channel.enabled ? (health.isHealthy ? "active" : "error") : "inactive",
    },
    runtime: {
      ...detail.runtime,
      health: {
        isHealthy: health.isHealthy,
        latencyMs: health.latencyMs,
        lastCheckAt: Date.now(),
        errorCount: health.isHealthy ? detail.runtime.health.errorCount : detail.runtime.health.errorCount + 1,
        lastError: health.error,
      },
      debugLog: [
        {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          tone: health.isHealthy ? "success" : "error",
          text: health.isHealthy ? "Health check passed." : health.error || "Health check failed.",
        },
        ...detail.runtime.debugLog,
      ].slice(0, 100),
    },
  }))
}

export function recordIncomingMessage(channel: ChannelConfigRecord, message: RuntimeChannelMessage) {
  return updateChannelDetail(channel.id, (detail) => {
    const nextUsers = upsertRuntimeUser(detail.runtime.users, channel.id, message, undefined)
    return {
      ...detail,
      channel: {
        ...detail.channel,
        lastMessageAt: message.timestamp,
        messageCount: detail.runtime.messages.length + 1,
      },
      runtime: {
        ...detail.runtime,
        messages: [
          ...detail.runtime.messages,
          {
            id: message.id,
            direction: "incoming",
            senderId: message.senderId,
            senderName: message.senderName,
            content: message.content,
            status: "received",
            createdAt: message.timestamp,
          },
        ].slice(-500),
        users: nextUsers,
        debugLog: [
          {
            id: crypto.randomUUID(),
            timestamp: message.timestamp,
            tone: "info",
            text: `Inbound ${channel.platform} message received from ${message.senderName || message.senderId}.`,
          },
          ...detail.runtime.debugLog,
        ].slice(0, 100),
      },
    }
  })
}

export function recordOutgoingMessage(channelId: string, message: { chatId?: string; senderId: string; senderName: string; content: string; status: "sent" | "failed"; error?: string }) {
  return updateChannelDetail(channelId, (detail) => {
    const timestamp = Date.now()
    const nextUsers = message.chatId
      ? upsertRuntimeUser(detail.runtime.users, channelId, {
          id: `reply-${timestamp}`,
          channelId,
          platform: detail.channel.platform,
          senderId: message.senderId,
          senderName: message.senderName,
          content: message.content,
          timestamp,
          messageType: "text",
          chatId: message.chatId,
          chatType: "private",
        }, "assistant")
      : detail.runtime.users

    return {
      ...detail,
      channel: {
        ...detail.channel,
        lastMessageAt: timestamp,
        messageCount: detail.runtime.messages.length + 1,
      },
      runtime: {
        ...detail.runtime,
        messages: [
          ...detail.runtime.messages,
          {
            id: crypto.randomUUID(),
            direction: "outgoing",
            senderId: message.senderId,
            senderName: message.senderName,
            content: message.content,
            status: message.status,
            createdAt: timestamp,
          },
        ].slice(-500),
        users: nextUsers,
        debugLog: [
          {
            id: crypto.randomUUID(),
            timestamp,
            tone: message.status === "sent" ? "success" : "error",
            text: message.status === "sent"
              ? `Reply sent via ${detail.channel.platform}.`
              : `Reply failed via ${detail.channel.platform}: ${message.error || "unknown error"}.`,
          },
          ...detail.runtime.debugLog,
        ].slice(0, 100),
      },
    }
  })
}

export function getRuntimeChannel(channelId: string) {
  return getChannelDetail(channelId)
}

export function replaceRuntimeChannelConfig(channel: ChannelConfigRecord) {
  const current = getChannelDetail(channel.id)
  if (!current) return null
  return saveChannelDetail({
    ...current,
    channel,
  })
}

function upsertRuntimeUser(
  users: ReturnType<NonNullable<ReturnType<typeof getChannelDetail>>["runtime"]["users"]>,
  channelId: string,
  message: RuntimeChannelMessage,
  roleOverride?: "assistant",
) {
  const userId = message.senderId || message.chatId || "unknown"
  const existing = users.find((user) => user.senderId === userId)
  const role = roleOverride === "assistant" ? "assistant" : "user"
  const entry = { role, content: message.content, timestamp: message.timestamp } as const

  if (!existing) {
    return [
      ...users,
      {
        id: crypto.randomUUID(),
        channelId,
        senderId: userId,
        senderName: message.senderName || userId,
        firstSeenAt: message.timestamp,
        lastActiveAt: message.timestamp,
        messageCount: 1,
        conversationHistory: [entry],
      },
    ]
  }

  return users.map((user) => user.senderId === userId
    ? {
        ...user,
        senderName: message.senderName || user.senderName,
        lastActiveAt: message.timestamp,
        messageCount: roleOverride === "assistant" ? user.messageCount : user.messageCount + 1,
        conversationHistory: [...user.conversationHistory, entry].slice(-40),
      }
    : user)
}
