import type {
  AssistantModelMessage,
  ImagePart,
  ModelMessage,
  TextPart,
  ToolCallPart,
  ToolModelMessage,
  ToolResultPart,
  UserModelMessage,
} from 'ai'
import type { AttachmentManifest, Message, MessageAttachment } from '@/types'
import { formatToolEnvelopeForModel } from '@/services/runtimeOutput'

export const MAX_TEXT_ATTACHMENT_CHARS = 24_000
export const MAX_IMAGE_ATTACHMENT_BYTES = 5 * 1024 * 1024
const DEFAULT_MODEL_HISTORY_TOKEN_BUDGET = 24_000
const RESERVED_RECENT_MESSAGES = 8
const COMPACT_MESSAGE_TOKEN_BUDGET = 1_200
const MAX_CONTEXT_MESSAGE_TOKENS = 6_000
const CONTEXT_TRUNCATION_NOTICE_TOKENS = 80
const CONTEXT_SUMMARY_MESSAGE_ID = 'context-summary'

export function estimateTokens(value: string): number {
  return Math.ceil(value.length / 4)
}

function clampTextAttachment(name: string, data: string): string {
  if (data.length <= MAX_TEXT_ATTACHMENT_CHARS) return `[File content: ${name}]\n${data}`
  return `[File content: ${name}]\n${data.slice(0, MAX_TEXT_ATTACHMENT_CHARS)}\n\n[Attachment truncated: ${data.length - MAX_TEXT_ATTACHMENT_CHARS} characters omitted]`
}

function attachmentManifest(attachments: MessageAttachment[]): string {
  if (attachments.length === 0) return ''
  const rows = attachments.map((attachment) => {
    const manifest = attachment.manifest ?? buildAttachmentManifest(attachment)
    const duration = attachment.duration ? `, duration=${attachment.duration}s` : ''
    const summary = attachment.summary ? `, summary=${attachment.summary.slice(0, 240)}` : ''
    return `- ${attachment.name}: type=${attachment.type}, mime=${attachment.mimeType}, size=${attachment.size}, risk=${manifest.privacyRisk}${duration}${summary}, fingerprint=${attachment.name}:${attachment.size}:${attachment.mimeType}`
  })
  return `[Attachment manifest]\n${rows.join('\n')}`
}

export function buildAttachmentManifest(attachment: MessageAttachment): AttachmentManifest {
  const parts = attachment.name.split('.')
  const extension = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : undefined
  const kind: AttachmentManifest['kind'] = attachment.type === 'audio'
    ? 'audio'
    : attachment.type === 'image'
      ? 'image'
      : /pdf|officedocument|msword|presentation|spreadsheet/.test(attachment.mimeType)
        ? 'document'
        : attachment.type === 'file'
          ? 'text'
          : 'unknown'
  const privacyRisk: AttachmentManifest['privacyRisk'] = /key|secret|token|credential|password|env/i.test(`${attachment.name}\n${attachment.data}`)
    ? 'high'
    : attachment.size > MAX_TEXT_ATTACHMENT_CHARS
      ? 'medium'
      : 'low'
  return {
    kind,
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    extension,
    privacyRisk,
    contentPreview: attachment.type === 'file' ? attachment.data.slice(0, 240) : undefined,
    chunks: attachment.type === 'file' ? Math.max(1, Math.ceil(attachment.data.length / MAX_TEXT_ATTACHMENT_CHARS)) : undefined,
  }
}

function messageTokenCost(message: Message): number {
  let text = message.content || ''
  for (const attachment of message.attachments ?? []) {
    text += `\n${attachment.name} ${attachment.mimeType} ${attachment.size}`
    if (attachment.type === 'file') text += `\n${attachment.data}`
  }
  for (const call of message.toolCalls ?? []) {
    text += `\n${call.outputEnvelope?.summary ?? call.output ?? ''}`
  }
  return estimateTokens(text)
}

function truncateTextForContext(label: string, value: string, maxChars: number): string {
  if (value.length <= maxChars) return value
  const omitted = value.length - maxChars
  return `${value.slice(0, maxChars)}\n\n[${label} truncated for context: ${omitted.toLocaleString()} characters omitted]`
}

function compactMessageForContext(message: Message, maxTokens: number): Message {
  const safeMaxTokens = Math.max(maxTokens, CONTEXT_TRUNCATION_NOTICE_TOKENS)
  let charBudget = Math.max(safeMaxTokens * 4, 320)
  let compacted = compactMessageWithCharBudget(message, charBudget)

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const cost = messageTokenCost(compacted)
    if (cost <= safeMaxTokens) return compacted
    const shrinkRatio = Math.max(0.35, safeMaxTokens / Math.max(cost, 1))
    const nextBudget = Math.max(160, Math.floor(charBudget * shrinkRatio * 0.92))
    if (nextBudget >= charBudget) break
    charBudget = nextBudget
    compacted = compactMessageWithCharBudget(message, charBudget)
  }

  return compacted
}

function compactMessageWithCharBudget(message: Message, charBudget: number): Message {
  const nextMessage: Message = {
    ...message,
    content: '',
    contentParts: undefined,
  }
  let remainingChars = Math.max(0, charBudget)

  const assignChunk = (value: string, label: string, preferredMax: number): string => {
    if (!value || remainingChars <= 0) return ''
    const allocated = Math.max(80, Math.min(remainingChars, preferredMax))
    const truncated = truncateTextForContext(label, value, allocated)
    remainingChars = Math.max(0, remainingChars - truncated.length)
    return truncated
  }

  const contentShare = message.content
    ? (message.attachments?.length || message.toolCalls?.length ? Math.floor(charBudget * 0.45) : charBudget)
    : 0
  nextMessage.content = assignChunk(message.content ?? '', message.role === 'user' ? 'User message' : 'Assistant message', contentShare)

  if (message.attachments?.length) {
    const attachmentBudget = Math.max(240, Math.floor(charBudget * 0.35))
    const perAttachmentBudget = Math.max(120, Math.floor(attachmentBudget / message.attachments.length))
    nextMessage.attachments = message.attachments.map((attachment) => {
      if (attachment.type !== 'file') return attachment
      return {
        ...attachment,
        data: assignChunk(attachment.data, `Attachment ${attachment.name}`, perAttachmentBudget),
      }
    })
  }

  if (message.toolCalls?.length) {
    const toolBudget = Math.max(200, Math.floor(charBudget * 0.3))
    const perToolBudget = Math.max(120, Math.floor(toolBudget / message.toolCalls.length))
    nextMessage.toolCalls = message.toolCalls.map((toolCall) => ({
      ...toolCall,
      output: toolCall.output
        ? assignChunk(toolCall.output, `Tool result ${toolCall.toolName}`, perToolBudget)
        : toolCall.output,
    }))
  }

  return nextMessage
}

function enforceContextBudget(messages: Message[], tokenBudget: number): Message[] {
  const adjusted = [...messages]
  let total = adjusted.reduce((sum, message) => sum + messageTokenCost(message), 0)

  while (adjusted.length > 1 && total > tokenBudget) {
    const candidateIndex = adjusted.findIndex((message) => !message.pinned && message.id !== CONTEXT_SUMMARY_MESSAGE_ID)
    if (candidateIndex < 0) break

    const candidate = adjusted[candidateIndex]
    const compactBudget = Math.max(Math.min(COMPACT_MESSAGE_TOKEN_BUDGET, tokenBudget), CONTEXT_TRUNCATION_NOTICE_TOKENS)
    const compacted = compactMessageForContext(candidate, compactBudget)
    const currentCost = messageTokenCost(candidate)
    const compactedCost = messageTokenCost(compacted)

    if (compactedCost < currentCost) {
      adjusted[candidateIndex] = compacted
      total = total - currentCost + compactedCost
      continue
    }

    adjusted.splice(candidateIndex, 1)
    total -= currentCost
  }

  return adjusted
}

export function buildContextSummary(messages: Message[], tokenBudget = DEFAULT_MODEL_HISTORY_TOKEN_BUDGET): string | undefined {
  const total = messages.reduce((sum, message) => sum + messageTokenCost(message), 0)
  if (total <= tokenBudget) return undefined
  const pinned = messages.filter((message) => message.pinned).length
  const tools = messages.reduce((sum, message) => sum + (message.toolCalls?.length ?? 0), 0)
  return `Earlier conversation was pruned and summarized to fit the model context budget. Original approximate history: ${total.toLocaleString()} tokens; budget: ${tokenBudget.toLocaleString()} tokens. Preserved pinned messages: ${pinned}. Tool results summarized: ${tools}.`
}

export function selectMessagesForModel(messages: Message[], tokenBudget = DEFAULT_MODEL_HISTORY_TOKEN_BUDGET): Message[] {
  const selected: Message[] = []
  const pinnedMessages = messages
    .filter((message) => message.pinned)
    .map((message) => compactMessageForContext(message, MAX_CONTEXT_MESSAGE_TOKENS))
  let remaining = tokenBudget

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.pinned) continue
    const maxTokensForMessage = isFinite(remaining)
      ? Math.max(Math.min(remaining, MAX_CONTEXT_MESSAGE_TOKENS), CONTEXT_TRUNCATION_NOTICE_TOKENS)
      : MAX_CONTEXT_MESSAGE_TOKENS
    const compactedMessage = compactMessageForContext(message, maxTokensForMessage)
    const cost = messageTokenCost(compactedMessage)
    const isRecent = messages.length - index <= RESERVED_RECENT_MESSAGES
    if (!isRecent && selected.length > 0 && remaining - cost < 0) break
    selected.unshift(compactedMessage)
    remaining -= cost
  }

  const summary = buildContextSummary(messages, tokenBudget)
  for (const pinned of pinnedMessages) {
    if (!selected.some((message) => message.id === pinned.id)) selected.unshift(pinned)
  }
  if (summary && selected.length > 0) {
    selected.unshift({
      id: CONTEXT_SUMMARY_MESSAGE_ID,
      role: 'assistant',
      content: summary,
      timestamp: Date.now(),
    })
  }

  return enforceContextBudget(selected, tokenBudget)
}

export function toModelMessages(messages: Message[], tokenBudget = DEFAULT_MODEL_HISTORY_TOKEN_BUDGET): ModelMessage[] {
  const result: ModelMessage[] = []

  for (const message of selectMessagesForModel(messages, tokenBudget)) {
    if (message.role === 'user') {
      if (message.attachments?.length) {
        const parts: Array<TextPart | ImagePart> = []
        const manifest = attachmentManifest(message.attachments)
        const textPrefix = [message.content, manifest].filter(Boolean).join('\n\n')
        if (textPrefix) parts.push({ type: 'text', text: textPrefix })
        for (const attachment of message.attachments) {
          if (attachment.type === 'image') {
            if (attachment.size > MAX_IMAGE_ATTACHMENT_BYTES) {
              parts.push({ type: 'text', text: `[Image attachment skipped: ${attachment.name} exceeds 5MB]` })
              continue
            }
            parts.push({ type: 'image', image: attachment.data, mediaType: attachment.mimeType })
          } else if (attachment.type === 'file') {
            parts.push({ type: 'text', text: clampTextAttachment(attachment.name, attachment.data) })
          } else if (attachment.type === 'audio') {
            const duration = attachment.duration ? ` (${attachment.duration}s)` : ''
            parts.push({ type: 'text', text: `[Audio attachment: ${attachment.name}${duration}]` })
          }
        }
        result.push({ role: 'user', content: parts } satisfies UserModelMessage)
      } else {
        result.push({ role: 'user', content: message.content } satisfies UserModelMessage)
      }
    } else if (message.role === 'assistant') {
      if (message.isError) continue

      const completedToolCalls = (message.toolCalls ?? []).filter((toolCall) => toolCall.status === 'completed')
      if (completedToolCalls.length > 0) {
        const parts: Array<TextPart | ToolCallPart> = []
        if (message.content) parts.push({ type: 'text', text: message.content })
        for (const toolCall of completedToolCalls) {
          parts.push({ type: 'tool-call', toolCallId: toolCall.id, toolName: toolCall.toolName, input: toolCall.input } satisfies ToolCallPart)
        }
        result.push({ role: 'assistant', content: parts } satisfies AssistantModelMessage)

        const toolResults: ToolResultPart[] = completedToolCalls.map((toolCall) => ({
          type: 'tool-result',
          toolCallId: toolCall.id,
          toolName: toolCall.toolName,
          output: { type: 'text', value: toolCall.outputEnvelope ? formatToolEnvelopeForModel(toolCall.outputEnvelope) : (toolCall.output ?? '') },
        } satisfies ToolResultPart))
        result.push({ role: 'tool', content: toolResults } satisfies ToolModelMessage)
      } else {
        result.push({ role: 'assistant', content: message.content } satisfies AssistantModelMessage)
      }
    }
  }

  return result
}
