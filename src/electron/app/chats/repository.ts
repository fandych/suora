import crypto from "node:crypto"
import { and, desc, eq, exists, sql } from "drizzle-orm"
import { getDrizzleDatabase } from "@/drizzle/db"
import { appMeta, chatMessages, chats } from "@/drizzle/schema"
import {
  parseStoredChatMessageParts,
  parseStoredChatSettingsStore,
  parseChatSettingsSavePayload,
  serializeChatMessageParts,
  serializeChatSettingsStore,
} from "@/electron/app/chats/chat-schemas"
import type { ChatRuntimeSettingsPayload } from "@/types/electron"
import { setProxySettings } from "@/electron/infrastructure/proxy-service"

async function readChat(chatId: string) {
  const database = getDrizzleDatabase()
  const [chat] = await database.select().from(chats).where(eq(chats.id, chatId)).limit(1)
  const rows = await database
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chatId))
    .orderBy(chatMessages.createdAt)
  return {
    chat: chat ?? null,
    messages: rows.map((row) => ({ ...row, parts: parseStoredChatMessageParts(row.partsJson) })),
  }
}

export async function listChats() {
  const database = getDrizzleDatabase()
  return database
    .select()
    .from(chats)
    .where(exists(database.select({ id: chatMessages.id }).from(chatMessages).where(eq(chatMessages.chatId, chats.id))))
    .orderBy(desc(chats.updatedAt))
}

export async function getChat(chatId: string) {
  return readChat(chatId)
}

export async function createChat() {
  const database = getDrizzleDatabase()
  const id = crypto.randomUUID()
  const now = Date.now()
  await database
    .insert(chats)
    .values({
      id,
      title: "New chat",
      chatbotId: "assistant-main",
      summary: "",
      sourceType: "manual",
      sourceRef: null,
      updatedAt: now,
    })
  return readChat(id)
}

export async function ensureChat(payload: {
  chatId: string
  title: string
  chatbotId: string
  summary?: string
  sourceType?: string
  sourceRef?: string | null
}) {
  const database = getDrizzleDatabase()
  const [existing] = await database.select().from(chats).where(eq(chats.id, payload.chatId)).limit(1)
  const values = {
    title: payload.title,
    chatbotId: payload.chatbotId,
    summary: payload.summary ?? existing?.summary ?? "",
    sourceType: payload.sourceType ?? existing?.sourceType ?? "manual",
    sourceRef: payload.sourceRef ?? existing?.sourceRef ?? null,
    updatedAt: Date.now(),
  }
  if (existing) await database.update(chats).set(values).where(eq(chats.id, payload.chatId))
  else await database.insert(chats).values({ id: payload.chatId, ...values })
  return readChat(payload.chatId)
}

export async function deleteChat(chatId: string) {
  const database = getDrizzleDatabase()
  await database.delete(chatMessages).where(eq(chatMessages.chatId, chatId))
  const existing = await database.select({ id: chats.id }).from(chats).where(eq(chats.id, chatId)).limit(1)
  await database.delete(chats).where(eq(chats.id, chatId))
  return existing.length > 0
}

export async function appendChatMessage(
  payload: { chatId: string; content: string; parts?: unknown[] },
  role: "user" | "assistant",
) {
  const database = getDrizzleDatabase()
  const [chat] = await database.select().from(chats).where(eq(chats.id, payload.chatId)).limit(1)
  if (!chat) return null
  const content = payload.content.trim()
  const now = Date.now()
  await database
    .insert(chatMessages)
    .values({
      id: crypto.randomUUID(),
      chatId: payload.chatId,
      role,
      content,
      partsJson: serializeChatMessageParts(payload.parts ?? []),
      createdAt: now,
    })
  await database
    .update(chats)
    .set({
      title: role === "user" && chat.title === "New chat" ? content.slice(0, 18) || "Untitled chat" : chat.title,
      summary: role === "user" ? content : chat.summary,
      updatedAt: now,
    })
    .where(eq(chats.id, payload.chatId))
  return getChat(payload.chatId)
}

export async function updateChatMessageParts(payload: {
  chatId: string
  messageId: string
  parts: unknown[]
}) {
  const database = getDrizzleDatabase()
  const result = await database
    .update(chatMessages)
    .set({ partsJson: serializeChatMessageParts(payload.parts) })
    .where(and(eq(chatMessages.id, payload.messageId), eq(chatMessages.chatId, payload.chatId)))
  if (!result) throw new Error("Message update failed.")
  return getChat(payload.chatId)
}

export async function getChatSettings() {
  const database = getDrizzleDatabase()
  const [row] = await database
    .select({ value: appMeta.value })
    .from(appMeta)
    .where(eq(appMeta.key, "chat_runtime_settings"))
    .limit(1)
  const parsed = parseStoredChatSettingsStore(row?.value ?? null)
  if (parsed?.store.defaultRuntime?.proxy) setProxySettings(parsed.store.defaultRuntime.proxy)
  return parsed ? serializeChatSettingsStore(parsed.store) : (row?.value ?? null)
}

export async function saveChatSettings(
  value:
    | ChatRuntimeSettingsPayload
    | {
        defaultRuntime?: ChatRuntimeSettingsPayload
        chats?: Record<string, { runtime?: ChatRuntimeSettingsPayload; selectedAgentId?: string }>
      },
) {
  const parsed = parseChatSettingsSavePayload(value)
  const store = "version" in parsed ? parsed.store : parsed
  const database = getDrizzleDatabase()
  await database
    .insert(appMeta)
    .values({ key: "chat_runtime_settings", value: serializeChatSettingsStore(store) })
    .onConflictDoUpdate({ target: appMeta.key, set: { value: sql`excluded.value` } })
  if ("proxy" in parsed ? parsed.proxy : store.defaultRuntime?.proxy)
    setProxySettings(("proxy" in parsed ? parsed.proxy : store.defaultRuntime?.proxy)!)
  return "version" in parsed ? parsed : { version: 1, store }
}
