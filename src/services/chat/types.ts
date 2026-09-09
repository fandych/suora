import type { ChatAttachmentRecord } from "@/data/domain/chat-message-parts"
import type { ChatErrorKind } from "@/data/domain/chat/chat-error-state"

export type ChatAgentEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: Record<string, unknown> }
  | { type: "tool-result"; toolCallId: string; toolName: string; output: string }
  | { type: "error"; error: string; errorKind: ChatErrorKind }

export type ChatAttachment = ChatAttachmentRecord
