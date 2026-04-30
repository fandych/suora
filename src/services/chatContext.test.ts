import { describe, expect, it } from 'vitest'
import type { Message } from '@/types'
import { buildContextSummary, selectMessagesForModel, toModelMessages } from './chatContext'

function message(id: string, role: Message['role'], content: string): Message {
  return { id, role, content, timestamp: Number(id.replace(/\D/g, '') || 1) }
}

describe('chatContext', () => {
  it('summarizes and prunes older history when the token budget is exceeded', () => {
    const messages = [
      message('m1', 'user', 'a'.repeat(400)),
      message('m2', 'assistant', 'b'.repeat(400)),
      message('m3', 'user', 'recent request'),
    ]

    const summary = buildContextSummary(messages, 80)
    const selected = selectMessagesForModel(messages, 80)

    expect(summary).toContain('Earlier conversation was pruned')
    expect(selected[0].id).toBe('context-summary')
    expect(selected[selected.length - 1]?.content).toBe('recent request')
  })

  it('adds an attachment manifest and clamps large text attachments', () => {
    const modelMessages = toModelMessages([
      {
        id: 'm1',
        role: 'user',
        content: 'Use this file',
        timestamp: 1,
        attachments: [{ id: 'att-1', type: 'file', name: 'notes.txt', mimeType: 'text/plain', data: 'x'.repeat(25_000), size: 25_000 }],
      },
    ])

    expect(modelMessages[0].role).toBe('user')
    expect(JSON.stringify(modelMessages[0].content)).toContain('[Attachment manifest]')
    expect(JSON.stringify(modelMessages[0].content)).toContain('[Attachment truncated:')
  })

  it('uses structured tool envelopes for model tool results', () => {
    const modelMessages = toModelMessages([
      {
        id: 'm1',
        role: 'assistant',
        content: 'Done',
        timestamp: 1,
        toolCalls: [
          {
            id: 'tool-1',
            toolName: 'readFile',
            input: { path: 'large.txt' },
            output: 'raw output',
            outputEnvelope: { status: 'completed', summary: 'Large output stored externally', dataRef: 'runtime-artifacts/tool-outputs/run-tool.txt', storedExternally: true, outputChars: 50_000 },
            status: 'completed',
            startedAt: 1,
          },
        ],
      },
    ])

    expect(modelMessages).toHaveLength(2)
    expect(modelMessages[1].role).toBe('tool')
    expect(JSON.stringify(modelMessages[1].content)).toContain('Large output stored externally')
    expect(JSON.stringify(modelMessages[1].content)).toContain('runtime-artifacts/tool-outputs/run-tool.txt')
  })
})
