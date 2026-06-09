import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MessageBubble } from './ChatMessages'
import type { Message } from '@/types'

describe('MessageBubble', () => {
  it('renders duplicate contentParts tool-call entries only once', () => {
    const message: Message = {
      id: 'msg-1',
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      contentParts: [
        { type: 'tool-call', toolCallId: 'tool-1' },
        { type: 'tool-call', toolCallId: 'tool-1' },
      ],
      toolCalls: [
        {
          id: 'tool-1',
          toolName: 'run_command',
          input: { command: 'npm test' },
          output: 'Error: failed',
          status: 'error',
          startedAt: Date.now(),
          completedAt: Date.now(),
        },
      ],
    }

    render(<MessageBubble message={message} />)

    expect(screen.getAllByText('run_command')).toHaveLength(1)
  })

  it('renders response-chain and cached prompt badges from runtime metadata', () => {
    const message: Message = {
      id: 'msg-2',
      role: 'assistant',
      content: 'Done',
      timestamp: Date.now(),
      runtime: {
        runId: 'run-1',
        startedAt: Date.now(),
        providerResponseId: 'resp-123',
        cachedPromptTokens: 256,
      },
      tokenUsage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
    }

    render(<MessageBubble message={message} />)

    expect(screen.getByText('response chain')).toBeInTheDocument()
    expect(screen.getByText('256 cached')).toBeInTheDocument()
  })
})
