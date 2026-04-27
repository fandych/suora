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
import type { Message, MessageAttachment } from '@/types'
import { formatToolEnvelopeForModel } from '@/services/runtimeOutput'

export const MAX_TEXT_ATTACHMENT_CHARS = 24_000
export const MAX_IMAGE_ATTACHMENT_BYTES = 5 * 1024 * 1024
const DEFAULT_MODEL_HISTORY_TOKEN_BUDGET = 24_000
const RESERVED_RECENT_MESSAGES = 8

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
    const duration = attachment.duration ? `, duration=${attachment.duration}s` : ''
    return `- ${attachment.name}: type=${attachment.type}, mime=${attachment.mimeType}, size=${attachment.size}${duration}, fingerprint=${attachment.name}:${attachment.size}:${attachment.mimeType}`
  })
  return `[Attachment manifest]\n${rows.join('\n')}`
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

export function buildContextSummary(messages: Message[], tokenBudget = DEFAULT_MODEL_HISTORY_TOKEN_BUDGET): string | undefined {
  const total = messages.reduce((sum, message) => sum + messageTokenCost(message), 0)
  if (total <= tokenBudget) return undefined
  return `Earlier conversation was pruned to fit the model context budget. Original approximate history: ${total.toLocaleString()} tokens; budget: ${tokenBudget.toLocaleString()} tokens.`
}

export function selectMessagesForModel(messages: Message[], tokenBudget = DEFAULT_MODEL_HISTORY_TOKEN_BUDGET): Message[] {
  const selected: Message[] = []
  let remaining = tokenBudget

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    const cost = messageTokenCost(message)
    const isRecent = messages.length - index <= RESERVED_RECENT_MESSAGES
    if (!isRecent && selected.length > 0 && remaining - cost < 0) break
    selected.unshift(message)
    remaining -= cost
  }

  const summary = buildContextSummary(messages, tokenBudget)
  if (summary && selected.length > 0) {
    selected.unshift({
      id: 'context-summary',
      role: 'assistant',
      content: summary,
      timestamp: Date.now(),
    })
  }

  return selected
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