export type ChatToolActivity = {
  id: string
  toolName: string
  input?: Record<string, unknown>
  output?: string
  error?: string
  stopped?: boolean
}

export type ChatAttachmentRecord = {
  id: string
  sourceKey: string
  name: string
  mediaType: string
  data: string
  kind: "image" | "file"
  sizeBytes?: number
}

export type ChatMessagePart =
  | { id: string; type: "text"; content: string; isPending?: boolean }
  | { id: string; type: "tool"; activity: ChatToolActivity }
  | { id: string; type: "attachment"; attachment: ChatAttachmentRecord }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeToolActivity(value: unknown): ChatToolActivity | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.toolName !== "string") {
    return null
  }

  return {
    id: value.id,
    toolName: value.toolName,
    input: isRecord(value.input) ? value.input : undefined,
    output: typeof value.output === "string" ? value.output : undefined,
    error: typeof value.error === "string" ? value.error : undefined,
    stopped: typeof value.stopped === "boolean" ? value.stopped : undefined,
  }
}

function normalizeAttachmentRecord(value: unknown): ChatAttachmentRecord | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.sourceKey !== "string" || typeof value.name !== "string" || typeof value.mediaType !== "string" || typeof value.data !== "string") {
    return null
  }

  if (value.kind !== "image" && value.kind !== "file") {
    return null
  }

  return {
    id: value.id,
    sourceKey: value.sourceKey,
    name: value.name,
    mediaType: value.mediaType,
    data: value.data,
    kind: value.kind,
    sizeBytes: typeof value.sizeBytes === "number" && Number.isFinite(value.sizeBytes) ? value.sizeBytes : undefined,
  }
}

export function normalizeChatMessageParts(value: unknown): ChatMessagePart[] {
  if (!Array.isArray(value)) {
    return []
  }

  const normalizedParts: ChatMessagePart[] = []

  for (const part of value) {
    if (!isRecord(part) || typeof part.id !== "string" || typeof part.type !== "string") {
      continue
    }

    if (part.type === "text" && typeof part.content === "string") {
      normalizedParts.push({ id: part.id, type: "text", content: part.content, isPending: typeof part.isPending === "boolean" ? part.isPending : undefined } satisfies ChatMessagePart)
      continue
    }

    if (part.type === "tool") {
      const activity = normalizeToolActivity(part.activity)
      if (activity) {
        normalizedParts.push({ id: part.id, type: "tool", activity } satisfies ChatMessagePart)
      }
      continue
    }

    if (part.type === "attachment") {
      const attachment = normalizeAttachmentRecord(part.attachment)
      if (attachment) {
        normalizedParts.push({ id: part.id, type: "attachment", attachment } satisfies ChatMessagePart)
      }
    }

  }

  return normalizedParts
}

export function getAttachmentParts(parts: ChatMessagePart[] | undefined) {
  return (parts ?? []).filter((part): part is Extract<ChatMessagePart, { type: "attachment" }> => part.type === "attachment")
}

export function getTextParts(parts: ChatMessagePart[] | undefined) {
  return (parts ?? []).filter((part): part is Extract<ChatMessagePart, { type: "text" }> => part.type === "text")
}

export function buildAttachmentSummary(attachment: ChatAttachmentRecord) {
  return `[Attachment] ${attachment.name}`
}