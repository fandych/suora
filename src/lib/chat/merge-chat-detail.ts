import type { ChatDetail, ChatMessageRecord } from "@/types/chat"

function compareMessages(left: ChatMessageRecord, right: ChatMessageRecord) {
  if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt
  return left.id.localeCompare(right.id)
}

export function mergeChatDetail(current: ChatDetail | null, next: ChatDetail): ChatDetail {
  if (!current) return next

  const mergedById = new Map(current.messages.map((message) => [message.id, message]))
  for (const message of next.messages) {
    mergedById.set(message.id, message)
  }

  return {
    chat: next.chat,
    messages: [...mergedById.values()].sort(compareMessages),
    nextCursor: current.nextCursor ?? next.nextCursor ?? null,
  }
}