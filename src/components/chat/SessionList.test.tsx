import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store/appStore'
import type { Model, Session } from '@/types'
import { SessionList } from './SessionList'

vi.mock('@/components/layout/SidePanel', () => ({
  SidePanel: ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
    <section>
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      <div>{children}</div>
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
})