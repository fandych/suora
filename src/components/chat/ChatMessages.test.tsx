import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MessageBubble } from './ChatMessages'
import type { Message } from '@/types'

describe('MessageBubble', () => {
  it('renders duplicate contentParts tool-call entries only once inside the collapsed process section', async () => {
    const user = userEvent.setup()
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

    expect(screen.queryByText('run_command')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Show process/i }))
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

  it('places the collapsed process section before the result when tool calls happen first', () => {
    const message: Message = {
      id: 'msg-3',
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      contentParts: [
        { type: 'tool-call', toolCallId: 'tool-1' },
        { type: 'text', text: 'Final answer' },
      ],
      toolCalls: [
        {
          id: 'tool-1',
          toolName: 'run_command',
          input: { command: 'echo test' },
          output: 'ok',
          status: 'completed',
          startedAt: Date.now(),
          completedAt: Date.now(),
        },
      ],
    }

    render(<MessageBubble message={message} />)

    const processButton = screen.getByRole('button', { name: /Show process/i })
    const finalAnswer = screen.getByText('Final answer')
    const processContainer = processButton.parentElement

    expect(processContainer).not.toBeNull()
    if (!processContainer) {
      throw new Error('Expected process section container to render')
    }

    expect(processContainer.compareDocumentPosition(finalAnswer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
