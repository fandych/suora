import type { ChatAgentEvent } from "@/services/ai-service"
import type { AssistantResponsePart } from "@/views/chats/components/chat-assistant-response-group"
import type { ChatToolActivity } from "@/views/chats/components/chat-tool-event-item"

export function applyEventToAssistantResponseParts(parts: AssistantResponsePart[], event: ChatAgentEvent, errorIndex: number): AssistantResponsePart[] {
  if (event.type === "text-delta") {
    const nextParts = [...parts]
    const lastPart = nextParts[nextParts.length - 1]
    if (lastPart?.type === "text") {
      nextParts[nextParts.length - 1] = { ...lastPart, content: `${lastPart.content}${event.text}`, isPending: true }
      return nextParts
    }

    return [...nextParts, { id: `assistant-text-${nextParts.length + 1}`, type: "text", content: event.text, isPending: true }]
  }

  if (event.type === "tool-call") {
    return [...parts, { id: event.toolCallId, type: "tool", activity: { id: event.toolCallId, toolName: event.toolName, input: event.input } }]
  }

  if (event.type === "tool-result") {
    const hasMatch = parts.some((part) => part.type === "tool" && part.activity.id === event.toolCallId)
    if (!hasMatch) {
      return [...parts, { id: event.toolCallId, type: "tool", activity: { id: event.toolCallId, toolName: event.toolName, output: event.output } }]
    }

    return parts.map((part) => part.type === "tool" && part.activity.id === event.toolCallId
      ? { ...part, activity: { ...part.activity, output: event.output, error: undefined } }
      : part)
  }

  return [...parts, { id: `tool-error-${errorIndex}`, type: "tool", activity: { id: `tool-error-${errorIndex}`, toolName: "Tool execution", error: event.error } }]
}

export function finalizeAssistantResponseParts(parts: AssistantResponsePart[]): AssistantResponsePart[] {
  return parts.map((part) => part.type === "text" ? { ...part, isPending: false } : part)
}

export function updateAssistantToolActivity(parts: AssistantResponsePart[], activityId: string, updates: Partial<ChatToolActivity>): AssistantResponsePart[] {
  return parts.map((part) => part.type === "tool" && part.activity.id === activityId
    ? { ...part, activity: { ...part.activity, ...updates } }
    : part)
}