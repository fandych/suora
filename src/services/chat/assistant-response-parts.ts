import type { ChatMessagePart } from "@/data/domain/chat-message-parts"
import { getChatErrorToolName } from "@/data/domain/chat/chat-error-state"
import type { ChatAgentEvent } from "@/services/chat/types"
import type { AssistantResponsePart } from "@/services/chat/response-parts"
export type { AssistantResponsePart } from "@/services/chat/response-parts"
import type { ChatToolActivity } from "@/data/domain/chat-message-parts"

export function toAssistantResponseParts(parts: ChatMessagePart[] | undefined): AssistantResponsePart[] {
  const normalizedParts: AssistantResponsePart[] = []

  for (const part of parts ?? []) {
    if (part.type === "text") {
      normalizedParts.push({ id: part.id, type: "text", content: part.content, isPending: part.isPending } satisfies AssistantResponsePart)
      continue
    }

    if (part.type === "tool") {
      normalizedParts.push({ id: part.id, type: "tool", activity: part.activity } satisfies AssistantResponsePart)
    }

  }

  return normalizedParts
}

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

  return [...parts, { id: `tool-error-${errorIndex}`, type: "tool", activity: { id: `tool-error-${errorIndex}`, toolName: getChatErrorToolName(event.errorKind), error: event.error } }]
}

export function finalizeAssistantResponseParts(parts: AssistantResponsePart[]): AssistantResponsePart[] {
  return parts.map((part) => {
    if (part.type === "text") {
      return { ...part, isPending: false }
    }

    if (part.activity.output === undefined && !part.activity.error) {
      return {
        ...part,
        activity: {
          ...part.activity,
          stopped: true,
        },
      }
    }

    return part
  })
}

export function updateAssistantToolActivity(parts: AssistantResponsePart[], activityId: string, updates: Partial<ChatToolActivity>): AssistantResponsePart[] {
  return parts.map((part) => part.type === "tool" && part.activity.id === activityId
    ? { ...part, activity: { ...part.activity, ...updates } }
    : part)
}