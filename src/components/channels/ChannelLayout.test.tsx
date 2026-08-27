import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ChannelLayout } from './ChannelLayout'
import { useAppStore } from '@/store/appStore'

vi.mock('@/components/layout/SidePanel', () => ({
  SidePanel: ({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) => (
    <section>
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      <div>{children}</div>
    </section>
  ),
}))

vi.mock('@/components/layout/ResizeHandle', () => ({
  ResizeHandle: () => <div data-testid="resize-handle" />,
}))

vi.mock('@/hooks/useResizablePanel', () => ({
  useResizablePanel: () => [320, vi.fn()],
}))

vi.mock('@/services/channelMessageHandler', () => ({
  startChannelServer: vi.fn().mockResolvedValue(true),
  stopChannelServer: vi.fn().mockResolvedValue(true),
  getChannelServerStatus: vi.fn().mockResolvedValue(false),
  getChannelWebhookUrl: vi.fn().mockResolvedValue(''),
  registerChannels: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./ChannelEditor', () => ({
  ChannelEditor: () => <div>channel-editor</div>,
}))

vi.mock('./ChannelPanels', () => ({
  ChannelMessageHistory: () => <div>messages</div>,
  ChannelHealthMonitor: () => <div>health</div>,
  ChannelDebugPanel: () => <div>debug</div>,
  ChannelUsersPanel: () => <div>users</div>,
}))

vi.mock('./ChannelIcons', () => ({
  ChannelPlatformIcon: () => <span data-testid="channel-icon" />,
  getPlatformDisplayName: () => 'Slack',
  useChannelIconCollections: () => undefined,
}))

vi.mock('./ChannelComponents', () => ({
  formatChannelRelativeTime: () => 'No activity yet',
}))

vi.mock('@/services/confirmDialog', () => ({
  confirm: vi.fn().mockResolvedValue(true),
}))

describe('ChannelLayout', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppStore.setState({
      locale: 'en',
      channels: [],
      agents: [],
    })
  })

  it('hides server controls when there are no channels yet', async () => {
    render(<ChannelLayout />)

    expect(await screen.findByText('No channels yet')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Add a channel to begin' })).toBeInTheDocument()
    expect(screen.getByText('Start with a channel for Slack, Feishu, Telegram, or a custom webhook to route inbound messages into your agents.')).toBeInTheDocument()
    expect(screen.queryByText('Server Stopped')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start Server' })).not.toBeInTheDocument()
  })

  it('shows a direct no-agent-assigned label when a channel has no reply agent', async () => {
    useAppStore.setState({
      locale: 'en',
      channels: [
        {
          id: 'channel-1',
          name: 'Support Inbox',
          platform: 'slack',
          replyAgentId: '',
          enabled: true,
          autoReply: false,
          connectionMode: 'webhook',
          webhookPath: '/hooks/support',
          status: 'inactive',
          messageCount: 0,
          createdAt: 1,
        },
      ],
      agents: [],
    })

    render(<ChannelLayout />)

    expect(await screen.findAllByText('Support Inbox')).toHaveLength(2)
    expect(screen.getAllByText('No agent assigned').length).toBeGreaterThan(0)
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument()
  })
})