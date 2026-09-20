import crypto from "node:crypto"
import { and, desc, eq, exists, lt, or, sql } from "drizzle-orm"
import { getDrizzleDatabase } from "@/drizzle/db"
import { appMeta, chatMessages, chats } from "@/drizzle/schema"
import {
  CHAT_SETTINGS_STORE_VERSION,
  type ChatSettingsSavePayload,
  type ChatSettingsStorePayload,
  parseStoredChatMessageParts,
  parseStoredChatSettingsStore,
  parseChatSettingsSavePayload,
  serializeChatMessageParts,
  serializeChatSettingsStore,
} from "@/electron/app/chats/chat-schemas"
import type { ChatMessagePart } from "@/types/chat"
import { setProxySettings } from "@/electron/infrastructure/proxy-service"
import { recordRecentlyDeletedResource } from "@/electron/app/system/system-repository"
import type { ChatDetail, ChatMessageCursor, ChatSummary } from "@/types/chat"

const DEFAULT_CHAT_MESSAGE_LIMIT = 200
const MAX_CHAT_MESSAGE_LIMIT = 500

type ChatReadOptions = {
  limit?: number
  beforeCursor?: ChatMessageCursor
}

function normalizeChatReadOptions(options?: ChatReadOptions) {
  const limit =
    typeof options?.limit === "number" && Number.isFinite(options.limit)
      ? Math.max(1, Math.min(Math.trunc(options.limit), MAX_CHAT_MESSAGE_LIMIT))
      : DEFAULT_CHAT_MESSAGE_LIMIT
  const beforeCursor =
    options?.beforeCursor &&
    typeof options.beforeCursor.createdAt === "number" &&
    Number.isFinite(options.beforeCursor.createdAt) &&
    options.beforeCursor.createdAt > 0 &&
    typeof options.beforeCursor.id === "string" &&
    options.beforeCursor.id
      ? { createdAt: Math.trunc(options.beforeCursor.createdAt), id: options.beforeCursor.id }
      : undefined
  return { limit, beforeCursor }
}

async function readChat(chatId: string, options?: ChatReadOptions) {
  const database = getDrizzleDatabase()
  const { limit, beforeCursor } = normalizeChatReadOptions(options)
  const [chat] = await database.select().from(chats).where(eq(chats.id, chatId)).limit(1)
  const rows = await database
    .select()
    .from(chatMessages)
    .where(
      beforeCursor
        ? and(
            eq(chatMessages.chatId, chatId),
            or(
              lt(chatMessages.createdAt, beforeCursor.createdAt),
              and(eq(chatMessages.createdAt, beforeCursor.createdAt), lt(chatMessages.id, beforeCursor.id)),
            ),
          )
        : eq(chatMessages.chatId, chatId),
    )
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(limit + 1)
  const hasMore = rows.length > limit
  const pageRows = (hasMore ? rows.slice(0, limit) : rows).reverse()
  return {
    chat: chat ?? null,
    messages: pageRows.map((row) => ({ ...row, parts: parseStoredChatMessageParts(row.partsJson) })),
    nextCursor:
      hasMore && pageRows[0] ? { createdAt: pageRows[0].createdAt, id: pageRows[0].id } : null,
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

export async function getChat(chatId: string, options?: ChatReadOptions) {
  return readChat(chatId, options)
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
  const snapshot = await readChat(chatId, { limit: MAX_CHAT_MESSAGE_LIMIT })
  if (snapshot.chat) {
    await recordRecentlyDeletedResource({
      resourceId: snapshot.chat.id,
      kind: "chat",
      title: snapshot.chat.title,
      deletedAt: Date.now(),
      snapshot,
    })
  }
  await database.delete(chatMessages).where(eq(chatMessages.chatId, chatId))
  const existing = await database.select({ id: chats.id }).from(chats).where(eq(chats.id, chatId)).limit(1)
  await database.delete(chats).where(eq(chats.id, chatId))
  return existing.length > 0
}

export async function restoreChatSnapshot(snapshot: ChatDetail & { nextCursor?: ChatMessageCursor | null }) {
  const database = getDrizzleDatabase()
  const chat = snapshot.chat as ChatSummary
  const [existing] = await database.select({ id: chats.id }).from(chats).where(eq(chats.id, chat.id)).limit(1)
  if (existing) throw new Error(`Chat '${chat.title}' already exists.`)
  await database.insert(chats).values({
    id: chat.id,
    title: chat.title,
    chatbotId: chat.chatbotId,
    summary: chat.summary,
    sourceType: chat.sourceType ?? "manual",
    sourceRef: chat.sourceRef ?? null,
    updatedAt: chat.updatedAt,
  })
  if (snapshot.messages.length > 0) {
    await database.insert(chatMessages).values(
      snapshot.messages.map((message) => ({
        id: message.id,
        chatId: chat.id,
        role: message.role,
        content: message.content,
        partsJson: serializeChatMessageParts(message.parts ?? []),
        createdAt: message.createdAt,
      })),
    )
  }
  return getChat(chat.id)
}

export async function appendChatMessage(
  payload: { chatId: string; content: string; parts?: ChatMessagePart[] },
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
  parts: ChatMessagePart[]
}) {
  const database = getDrizzleDatabase()
  const [existing] = await database
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .where(and(eq(chatMessages.id, payload.messageId), eq(chatMessages.chatId, payload.chatId)))
    .limit(1)
  if (!existing) throw new Error("Message update failed.")
  await database
    .update(chatMessages)
    .set({ partsJson: serializeChatMessageParts(payload.parts) })
    .where(and(eq(chatMessages.id, payload.messageId), eq(chatMessages.chatId, payload.chatId)))
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

export async function saveChatSettings(value: ChatSettingsSavePayload) {
  const parsed = parseChatSettingsSavePayload(value)
  const store: ChatSettingsStorePayload =
    "version" in parsed
      ? parsed.store
      : "model" in parsed
        ? {
            defaultRuntime: parsed,
            defaultSelectedAgentId: "agent-general-assistant",
            drafts: {},
            chats: {},
          }
        : parsed
  const database = getDrizzleDatabase()
  await database
    .insert(appMeta)
    .values({ key: "chat_runtime_settings", value: serializeChatSettingsStore(store) })
    .onConflictDoUpdate({ target: appMeta.key, set: { value: sql`excluded.value` } })
  if ("proxy" in parsed ? parsed.proxy : store.defaultRuntime?.proxy)
    setProxySettings(("proxy" in parsed ? parsed.proxy : store.defaultRuntime?.proxy)!)
  return "version" in parsed ? parsed : { version: CHAT_SETTINGS_STORE_VERSION, store }
}
