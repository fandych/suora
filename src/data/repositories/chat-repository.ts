import type { ChatDetail, ChatSummary } from "@/data/domain/models"

import { ensureSeeded } from "@/data/repositories/seed-repository"
import { suoraIpc } from "@/lib/ipc"

export async function listChats() {
  await ensureSeeded()
  return suoraIpc.chats.list() as Promise<ChatSummary[]>
}

export async function getChatDetail(chatId: string) {
  await ensureSeeded()
  const detail = await suoraIpc.chats.get(chatId) as ChatDetail | null
  if (!detail) {
    throw new Error(`Chat ${chatId} was not found.`)
  }
  return detail
}

export async function createChat() {
  await ensureSeeded()
  return suoraIpc.chats.create() as Promise<ChatDetail>
}

export async function appendUserChatMessage(chatId: string, content: string) {
  await ensureSeeded()
  const detail = await suoraIpc.chats.appendUser(chatId, content) as ChatDetail | null
  if (!detail) {
    throw new Error(`Chat ${chatId} was not found.`)
  }
  return detail
}

export async function appendAssistantChatMessage(chatId: string, content: string) {
  await ensureSeeded()
  const detail = await suoraIpc.chats.appendAssistant(chatId, content) as ChatDetail | null
  if (!detail) {
    throw new Error(`Chat ${chatId} was not found.`)
  }
  return detail
}

export async function sendChatMessage(chatId: string, content: string) {
  return appendUserChatMessage(chatId, content)
}