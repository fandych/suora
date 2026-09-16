import type { ChatAttachmentRecord, ChatMessagePart } from "@/types/chat"

export type { ChatAttachmentRecord, ChatMessagePart, ChatToolActivity } from "@/types/chat"

export const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_CHAT_ATTACHMENTS = 5
export const MAX_CHAT_ATTACHMENT_TOTAL_BYTES = 25 * 1024 * 1024

export const getAttachmentParts = (parts?: ChatMessagePart[]) =>
  (parts ?? []).filter((part): part is Extract<ChatMessagePart, { type: "attachment" }> => part.type === "attachment")

export const getTextParts = (parts?: ChatMessagePart[]) =>
  (parts ?? []).filter((part): part is Extract<ChatMessagePart, { type: "text" }> => part.type === "text")

export const buildAttachmentSummary = (attachment: ChatAttachmentRecord) => `[Attachment] ${attachment.name}`
