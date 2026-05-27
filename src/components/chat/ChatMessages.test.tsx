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
})
