import type { ChatDetail, ChatSummary } from "@/data/domain/models"
import type { ChatMessagePart } from "@/data/domain/chat-message-parts"

import { ensureSeeded } from "@/data/repositories/seed-repository"
import { hasProjectBridge, projectIpc } from "@/lib/ipc"

export async function listChats() {
  if (!hasProjectBridge()) {
    return [] as ChatSummary[]
  }

  await ensureSeeded()
  return (await projectIpc.chats.list() as ChatSummary[]).filter((chat) => !chat.id.startsWith("chat-channel-"))
}

export async function getChatDetail(chatId: string) {
  await ensureSeeded()
  const detail = await projectIpc.chats.get(chatId) as ChatDetail | null
  if (!detail) {
    throw new Error(`Chat ${chatId} was not found.`)
  }
  return detail
}

export async function createChat() {
  await ensureSeeded()
  return projectIpc.chats.create() as Promise<ChatDetail>
}

export async function ensureChatDetail(payload: { chatId: string; title: string; chatbotId: string; summary?: string; sourceType?: "manual" | "channel"; sourceRef?: string | null }) {
  await ensureSeeded()
  const detail = await projectIpc.chats.ensure(payload) as ChatDetail | null
  if (!detail) {
    throw new Error(`Chat ${payload.chatId} could not be ensured.`)
  }
  return detail
}

export async function deleteChat(chatId: string) {
  await ensureSeeded()
  return projectIpc.chats.delete(chatId) as Promise<boolean>
}

export async function appendUserChatMessage(chatId: string, content: string, parts?: ChatMessagePart[]) {
  await ensureSeeded()
  const detail = await projectIpc.chats.appendUser(chatId, content, parts) as ChatDetail | null
  if (!detail) {
    throw new Error(`Chat ${chatId} was not found.`)
  }
  return detail
}

export async function appendAssistantChatMessage(chatId: string, content: string, parts?: ChatMessagePart[]) {
  await ensureSeeded()
  const detail = await projectIpc.chats.appendAssistant(chatId, content, parts) as ChatDetail | null
  if (!detail) {
    throw new Error(`Chat ${chatId} was not found.`)
  }
  return detail
}

export async function updateChatMessageParts(chatId: string, messageId: string, parts: ChatMessagePart[]) {
  await ensureSeeded()
  const detail = await projectIpc.chats.updateMessageParts(chatId, messageId, parts) as ChatDetail | null
  if (!detail) {
    throw new Error(`Chat ${chatId} was not found.`)
  }
  return detail
}

export async function sendChatMessage(chatId: string, content: string) {
  return appendUserChatMessage(chatId, content)
}