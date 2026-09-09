import type { ChatDetail, ChatSummary } from "@/data/domain/models"
import { normalizeChatMessageParts, type ChatMessagePart } from "@/data/domain/chat-message-parts"
import { getSuoraBridge, parseJson } from "@/lib/ipc-utils"

type RawChatMessageRow = { id: string; role: "user" | "assistant" | "system"; content: string; partsJson?: string; parts?: ChatMessagePart[]; createdAt: number }
type RawChatSummaryRow = { id: string; title: string; chatbotId: string; summary: string; updatedAt: number; sourceType?: "manual" | "channel"; sourceRef?: string | null }
type ChatPayload = { chat: RawChatSummaryRow | null; messages: RawChatMessageRow[] }

function parseMessage(row: RawChatMessageRow) {
  return { id: row.id, role: row.role, content: row.content, parts: normalizeChatMessageParts(row.parts ?? parseJson(row.partsJson, [])), createdAt: row.createdAt }
}

function parseSummary(row: RawChatSummaryRow): ChatSummary {
  return { id: row.id, title: row.title, chatbotId: row.chatbotId, summary: row.summary, updatedAt: row.updatedAt, sourceType: row.sourceType === "channel" ? "channel" : "manual", sourceRef: typeof row.sourceRef === "string" ? row.sourceRef : null }
}

function parseDetail(payload: ChatPayload | null): ChatDetail | null {
  if (!payload?.chat) return null
  return { chat: parseSummary(payload.chat), messages: payload.messages.map(parseMessage) }
}

export const chatIpc = {
  list: async () => (await getSuoraBridge().chats.list() as RawChatSummaryRow[]).map(parseSummary),
  get: async (chatId: string) => parseDetail(await getSuoraBridge().chats.get(chatId) as ChatPayload),
  create: async () => parseDetail(await getSuoraBridge().chats.create() as ChatPayload) as ChatDetail,
  ensure: async (payload: { chatId: string; title: string; chatbotId: string; summary?: string; sourceType?: "manual" | "channel"; sourceRef?: string | null }) => parseDetail(await getSuoraBridge().chats.ensure(payload) as ChatPayload),
  delete: async (chatId: string) => getSuoraBridge().chats.delete(chatId) as Promise<boolean>,
  appendUser: async (chatId: string, content: string, parts?: ChatMessagePart[]) => parseDetail(await getSuoraBridge().chats.appendUser({ chatId, content, parts }) as ChatPayload | null),
  appendAssistant: async (chatId: string, content: string, parts?: ChatMessagePart[]) => parseDetail(await getSuoraBridge().chats.appendAssistant({ chatId, content, parts }) as ChatPayload | null),
  updateMessageParts: async (chatId: string, messageId: string, parts: ChatMessagePart[]) => parseDetail(await getSuoraBridge().chats.updateMessageParts({ chatId, messageId, parts }) as ChatPayload | null),
  getSettings: async () => getSuoraBridge().chats.getSettings(),
  saveSettings: async (payload: unknown) => getSuoraBridge().chats.saveSettings(payload),
}
