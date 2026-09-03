import type { ModelMessage, UserModelMessage } from "ai"

import type { ChatMessageRecord } from "@/data/domain/models"
import type { ChatAttachment } from "@/services/ai-service"

const MAX_RECENT_MESSAGES = 8
const MAX_MEMORY_LINES = 10
const MAX_LINE_CHARS = 180
const MAX_TOOL_OUTPUT_CHARS = 1200

function truncate(value: string, maxChars: number) {
  return value.length <= maxChars ? value : `${value.slice(0, maxChars - 1)}...`
}

function summarizeMessage(message: ChatMessageRecord) {
  if (message.parts?.length) {
    const summary = message.parts.map((part) => {
      if (part.type === "text") {
        return truncate(part.content.replace(/\s+/g, " ").trim(), MAX_LINE_CHARS)
      }

      if (part.activity.error) {
        return `[tool ${part.activity.toolName} error: ${truncate(part.activity.error, 80)}]`
      }

      if (part.activity.output !== undefined) {
        return `[tool ${part.activity.toolName} success]`
      }

      return `[tool ${part.activity.toolName} running]`
    }).filter(Boolean).join(" ")

    return `${message.role.toUpperCase()}: ${truncate(summary, MAX_LINE_CHARS)}`
  }

  return `${message.role.toUpperCase()}: ${truncate(message.content.replace(/\s+/g, " ").trim(), MAX_LINE_CHARS)}`
}

function buildSessionMemory(history: ChatMessageRecord[]) {
  if (history.length <= MAX_RECENT_MESSAGES) {
    return null
  }

  const olderMessages = history.slice(0, -MAX_RECENT_MESSAGES)
  const memoryLines = olderMessages.slice(-MAX_MEMORY_LINES).map(summarizeMessage).filter(Boolean)
  if (memoryLines.length === 0) {
    return null
  }

  return {
    role: "system",
    content: `Session memory from earlier turns:\n${memoryLines.map((line) => `- ${line}`).join("\n")}`,
  } satisfies ModelMessage
}

function toAssistantText(message: ChatMessageRecord) {
  if (!message.parts?.length) {
    return message.content
  }

  return message.parts.map((part) => {
    if (part.type === "text") {
      return part.content
    }

    if (part.activity.error) {
      return `[tool ${part.activity.toolName} error]\n${truncate(part.activity.error, MAX_TOOL_OUTPUT_CHARS)}`
    }

    if (part.activity.output !== undefined) {
      return `[tool ${part.activity.toolName} result]\n${truncate(part.activity.output, MAX_TOOL_OUTPUT_CHARS)}`
    }

    return `[tool ${part.activity.toolName} called]\n${JSON.stringify(part.activity.input ?? {}, null, 2)}`
  }).filter(Boolean).join("\n\n")
}

export function buildChatModelMessages(history: ChatMessageRecord[], attachments: ChatAttachment[] = []): ModelMessage[] {
  if (history.length === 0 && attachments.length === 0) {
    return []
  }

  const sessionMemory = buildSessionMemory(history)
  const recentMessages = history.slice(-MAX_RECENT_MESSAGES)
  const modelMessages = recentMessages.map((message, index) => {
    if (message.role === "user" && index === recentMessages.length - 1 && attachments.length > 0) {
      return {
        role: "user",
        content: [
          { type: "text", text: message.content },
          ...attachments.map((attachment) => ({
            type: "file" as const,
            mediaType: attachment.mediaType || (attachment.kind === "image" ? "image/png" : "application/octet-stream"),
            filename: attachment.name,
            data: attachment.data,
          })),
        ],
      } satisfies UserModelMessage
    }

    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: toAssistantText(message),
      } satisfies ModelMessage
    }

    return { role: message.role, content: message.content } satisfies ModelMessage
  })

  return sessionMemory ? [sessionMemory, ...modelMessages] : modelMessages
}