import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store/appStore'
import type { Model, Session } from '@/types'
import { SessionList } from './SessionList'

vi.mock('@/components/layout/SidePanel', () => ({
  SidePanel: ({ title, action, children, contentRef, onContentScroll }: { title: string; action?: React.ReactNode; children: React.ReactNode; contentRef?: React.Ref<HTMLDivElement>; onContentScroll?: React.UIEventHandler<HTMLDivElement> }) => (
    <section>
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      <div data-testid="side-panel-content" ref={contentRef} onScroll={onContentScroll}>{children}</div>
    </section>
  ),
}))

describe('SessionList', () => {
  beforeEach(() => {
    localStorage.clear()
    const model: Model = {
      id: 'model-1',
      name: 'GPT Test',
      provider: 'openai',
      providerType: 'openai',
      modelId: 'gpt-4.1',
      enabled: true,
    }

    const visibleSession: Session = {
      id: 'session-visible',
      title: 'Visible chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      modelId: model.id,
      messages: [],
    }

    const hiddenSession: Session = {
      id: 'session-hidden',
      title: 'Timer draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      surface: 'timer-assistant',
      modelId: model.id,
      messages: [],
    }

    useAppStore.setState({
      sessions: [hiddenSession, visibleSession],
      activeSessionId: visibleSession.id,
      openSessionTabs: [visibleSession.id],
      models: [model],
      selectedModel: model,
      selectedAgent: null,
      agents: [],
    })
  })

  it('shows only main chat sessions', () => {
    render(<SessionList />)

    expect(screen.getByText('Visible chat')).toBeInTheDocument()
    expect(screen.queryByText('Timer draft')).not.toBeInTheDocument()
  })

  it('renders long session lists incrementally and loads more while scrolling', async () => {
    const model = useAppStore.getState().models[0]
    expect(model).toBeDefined()
    if (!model) {
      throw new Error('Expected test model to be seeded in beforeEach')
    }
    const sessions: Session[] = Array.from({ length: 150 }, (_, index) => ({
      id: `session-${index + 1}`,
      title: `Chat ${index + 1}`,
      createdAt: Date.now() - index,
      updatedAt: Date.now() - index,
      modelId: model.id,
      messages: [],
    }))

    useAppStore.setState({
      sessions,
      activeSessionId: sessions[0].id,
      openSessionTabs: [sessions[0].id],
      selectedModel: model,
      selectedAgent: null,
      agents: [],
    })

    render(<SessionList />)

    expect(screen.getByText('90 more sessions load as you scroll.')).toBeInTheDocument()
    expect(screen.getByText('Chat 60')).toBeInTheDocument()
    expect(screen.queryByText('Chat 61')).not.toBeInTheDocument()

    const scroller = screen.getByTestId('side-panel-content')
    Object.defineProperty(scroller, 'scrollTop', { value: 600, writable: true, configurable: true })
    Object.defineProperty(scroller, 'scrollHeight', { value: 1000, writable: true, configurable: true })
    Object.defineProperty(scroller, 'clientHeight', { value: 320, writable: true, configurable: true })

    fireEvent.scroll(scroller)

    await waitFor(() => expect(screen.getByText('30 more sessions load as you scroll.')).toBeInTheDocument())
    expect(screen.getByText('Chat 120')).toBeInTheDocument()
    expect(screen.queryByText('Chat 121')).not.toBeInTheDocument()
  })
})