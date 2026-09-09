import type { ChatMessagePart } from "@/data/domain/chat-message-parts"
import type { AssistantResponsePart } from "@/services/chat/response-parts"

export function hasVisibleAssistantContent(finalText: string, parts: AssistantResponsePart[]) {
  return finalText.trim().length > 0 || parts.some((part) => part.type === "text" ? part.content.trim().length > 0 : part.activity.output !== undefined || Boolean(part.activity.error) || Boolean(part.activity.input))
}

export function createPersistedAssistantPayload(finalText: string, parts: AssistantResponsePart[], completedWithAbort: boolean) {
  const hasVisibleContent = hasVisibleAssistantContent(finalText, parts)
  const persistedText = hasVisibleContent ? finalText.trim() : completedWithAbort ? "" : "No visible response was returned."
  const persistedParts = hasVisibleContent || completedWithAbort ? parts : [{ id: "assistant-empty", type: "text", content: persistedText } satisfies ChatMessagePart]
  return { persistedText, persistedParts }
}
