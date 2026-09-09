import type { ChatMessagePart } from "@/data/domain/chat-message-parts"

export type ChatSummary = {
  id: string
  title: string
  chatbotId: string
  summary: string
  updatedAt: number
  sourceType?: "manual" | "channel"
  sourceRef?: string | null
}

export type ChatMessageRecord = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  createdAt: number
  parts?: ChatMessagePart[]
  status?: "streaming" | "completed" | "failed" | "stopped"
  error?: string
}

export type ChatDetail = {
  chat: ChatSummary
  messages: ChatMessageRecord[]
}
