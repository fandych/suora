import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChannelEditor } from './ChannelEditor'
import type { ChannelConfig } from '@/types'

Object.assign(globalThis.navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
})

const baseChannel: ChannelConfig = {
  id: 'channel-1',
  name: 'Support',
  platform: 'feishu',
  enabled: false,
  status: 'inactive',
  connectionMode: 'webhook',
  webhookPath: '/webhook/feishu/channel-1',
  autoReply: true,
  replyAgentId: 'agent-1',
  createdAt: Date.now(),
  messageCount: 0,
}

describe('ChannelEditor', () => {
  it('shows personal WeChat binding fields when that platform is selected', async () => {
    const user = userEvent.setup()

    render(
      <ChannelEditor
        channel={baseChannel}
        agents={[{ id: 'agent-1', name: 'Support Agent', enabled: true }]}
        isNew
        onSave={() => {}}
        onCancel={() => {}}
      />,
    )

    await user.selectOptions(screen.getByRole('combobox', { name: /platform/i }), 'wechat_personal')

    expect(screen.getByLabelText(/qr code url/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/binding status/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/outgoing webhook url/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/bridge auth token/i)).toBeInTheDocument()
  })

  it('previews the personal WeChat QR code when a QR URL is provided', async () => {
    const user = userEvent.setup()

    render(
      <ChannelEditor
        channel={baseChannel}
        agents={[{ id: 'agent-1', name: 'Support Agent', enabled: true }]}
        isNew
        onSave={() => {}}
        onCancel={() => {}}
      />,
    )

    await user.selectOptions(screen.getByRole('combobox', { name: /platform/i }), 'wechat_personal')
    await user.type(screen.getByLabelText(/qr code url/i), 'https://bridge.example.com/qr.png')

    expect(screen.getByRole('img', { name: /personal wechat qr/i })).toHaveAttribute('src', 'https://bridge.example.com/qr.png')
  })
})
