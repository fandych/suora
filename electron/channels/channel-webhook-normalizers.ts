export type UnknownRecord = Record<string, unknown>

export function readNested(record: UnknownRecord, path: string[]) {
  let current: unknown = record
  for (const segment of path) {
    if (!current || typeof current !== "object") return undefined
    current = (current as UnknownRecord)[segment]
  }
  return current
}

export function resolveTimestamp(input: unknown) {
  if (typeof input === "number" && Number.isFinite(input)) return input
  if (typeof input === "string") {
    const date = new Date(input).getTime()
    return Number.isNaN(date) ? Date.now() : date
  }
  return Date.now()
}

export function normalizeChatType(value: unknown): "private" | "group" {
  return String(value || "private") === "group" ? "group" : "private"
}

export function readGenericMessageFields(body: UnknownRecord) {
  const senderId = String(body.senderId || body.sender_id || body.user_id || readNested(body, ["from", "id"]) || "unknown")
  return {
    senderId,
    senderName: String(body.senderName || body.sender_name || body.user_name || readNested(body, ["from", "name"]) || senderId),
    content: String(body.content || body.text || body.message || body.msg || ""),
    chatId: String(body.chatId || body.chat_id || body.conversation_id || body.channel_id || senderId),
    chatType: normalizeChatType(body.chatType || body.chat_type),
  }
}
