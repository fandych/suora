import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { EmptyChatState, NewSessionHero } from './ChatStatusPanels'
import { useAppStore } from '@/store/appStore'

describe('EmptyChatState', () => {
  beforeEach(() => {
    useAppStore.setState({ locale: 'en' })
  })

  it('renders the ready eyebrow in English when the locale is English', () => {
    render(
      <EmptyChatState
        starterPrompts={[]}
        sessionAgentAvatar="agent-robot"
        displayAgentName="Assistant"
        displayAgentGreeting="Hi!"
        isStreaming={false}
        onPromptSelect={() => {}}
        hintsTitle="Hints"
        pipelineHint="Try /pipeline list"
        pasteHint="Paste screenshots"
      />,
    )

    expect(screen.getByText('Ready')).toBeVisible()
    expect(screen.queryByText('就绪')).not.toBeInTheDocument()
  })

  it('shows an Open Models action when chat cannot start yet', () => {
    render(
      <NewSessionHero
        starterPrompts={[]}
        onPromptSelect={() => {}}
        createSessionAndSend={() => {}}
        canChat={false}
        hintsTitle="Hints"
        pipelineHint="Try /pipeline list"
        pasteHint="Paste screenshots"
        badgeOne="Workbench"
        badgeTwo="Workspace"
        promptEyebrow="Start here"
        title="Suora"
        description="Select or create a conversation to begin"
        promptTitle="Pick a session"
        promptDescription="Choose an agent and model"
        footer={null}
      />,
    )

    expect(screen.getByRole('button', { name: 'Open Models' })).toBeVisible()
  })
})