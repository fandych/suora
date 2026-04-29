import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { ChannelMessageHistory } from './ChannelPanels'
import { useAppStore } from '@/store/appStore'
import type { ChannelConfig, ChannelHistoryMessage, ChannelUser } from '@/types'

function buildLegacyMessage(overrides: {
  id: string
  content: string
  direction: string
  timestamp: number
  senderId?: string
  senderName?: string
  status?: ChannelHistoryMessage['status']
}): ChannelHistoryMessage {
  return {
    id: overrides.id,
    channelId: 'channel-1',
    direction: overrides.direction as unknown as ChannelHistoryMessage['direction'],
    platform: 'custom',
    senderId: overrides.senderId ?? 'user-1',
    senderName: overrides.senderName ?? 'Legacy User',
    content: overrides.content,
    timestamp: overrides.timestamp,
    status: overrides.status ?? 'delivered',
  }
}

describe('ChannelMessageHistory', () => {
  beforeEach(() => {
    const channel: ChannelConfig = {
      id: 'channel-1',
      name: '测试渠道',
      platform: 'custom',
      enabled: true,
      status: 'active',
      connectionMode: 'webhook',
      webhookPath: '/hook/test',
      autoReply: true,
      replyAgentId: 'default-assistant',
      customPlatformName: 'Custom',
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
      messageCount: 2,
    }

    const channelUser: ChannelUser = {
      id: 'channel-1:user-1',
      channelId: 'channel-1',
      senderId: 'user-1',
      senderName: 'Legacy User',
      platform: 'custom',
      firstSeenAt: Date.now(),
      lastActiveAt: Date.now(),
      messageCount: 2,
      conversationHistory: [],
    }

    useAppStore.setState({
      locale: 'zh',
      channels: [channel],
      channelUsers: {
        [channelUser.id]: channelUser,
      },
      channelMessages: [
        buildLegacyMessage({ id: 'legacy-send', content: '旧发送消息', direction: 'send', timestamp: 2, senderId: 'assistant', senderName: 'AI Assistant', status: 'sent' }),
        buildLegacyMessage({ id: 'legacy-receive', content: '旧接收消息', direction: 'receive', timestamp: 1 }),
      ],
    })
  })

  it('filters legacy receive/send messages with the direction toggles', async () => {
    const user = userEvent.setup()

    render(<ChannelMessageHistory channelId="channel-1" />)

    expect(screen.getByText('旧接收消息')).toBeInTheDocument()
    expect(screen.getByText('旧发送消息')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '接收' }))
    expect(screen.getByText('旧接收消息')).toBeInTheDocument()
    expect(screen.queryByText('旧发送消息')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '发送' }))
    expect(screen.getByText('旧发送消息')).toBeInTheDocument()
    expect(screen.queryByText('旧接收消息')).not.toBeInTheDocument()
  })
})