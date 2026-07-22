import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  beforeEach(() => {
    vi.mocked(window.electron.invoke).mockReset()
  })

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
    expect(screen.getByRole('button', { name: /generate qr code/i })).toBeInTheDocument()
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

  it('previews bare base64 personal WeChat QR payloads as data URLs', async () => {
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
    await user.type(screen.getByLabelText(/qr code url/i), 'iVBORw0KGgoAAAANSUhEUgAAAAUA')

    expect(screen.getByRole('img', { name: /personal wechat qr/i })).toHaveAttribute('src', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA')
  })

  it('falls back to an Electron screenshot when the QR URL is an HTML page', async () => {
    const user = userEvent.setup()
    vi.mocked(window.electron.invoke).mockImplementation(async (channel: string, ...args: unknown[]) => {
      if (channel === 'browser:screenshot') {
        expect(args[0]).toBe('https://liteapp.weixin.qq.com/q/demo')
        return {
          image: 'abc123',
          format: 'png',
        }
      }
      return { success: true }
    })

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
    await user.type(screen.getByLabelText(/qr code url/i), 'https://liteapp.weixin.qq.com/q/demo')

    const qrImage = screen.getByRole('img', { name: /personal wechat qr/i })
    fireEvent.error(qrImage)

    await waitFor(() => {
      expect(window.electron.invoke).toHaveBeenCalledWith('browser:screenshot', 'https://liteapp.weixin.qq.com/q/demo')
    })
  })

  it('stores native personal WeChat credentials after a successful QR login flow', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    vi.mocked(window.electron.invoke).mockImplementation(async (channel: string) => {
      if (channel === 'channel:wechatPersonalLoginStart') {
        return {
          success: true,
          qrCodeUrl: 'https://ilink.example.com/qr.png',
          sessionKey: 'session-1',
        }
      }
      if (channel === 'channel:wechatPersonalLoginWait') {
        return {
          success: true,
          status: 'connected',
          message: 'ok',
          qrCodeUrl: 'https://ilink.example.com/qr.png',
          botToken: 'bot-token',
          baseUrl: 'https://ilink.example.com',
          accountId: 'bot@im.bot',
          userId: 'user@im.wechat',
        }
      }
      return { success: true }
    })

    render(
      <ChannelEditor
        channel={baseChannel}
        agents={[{ id: 'agent-1', name: 'Support Agent', enabled: true }]}
        isNew
        onSave={onSave}
        onCancel={() => {}}
      />,
    )

    await user.selectOptions(screen.getByRole('combobox', { name: /platform/i }), 'wechat_personal')
    await user.click(screen.getByRole('button', { name: /generate qr code/i }))
    await screen.findByRole('img', { name: /personal wechat qr/i })
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      enabled: true,
      autoReply: true,
      connectionMode: 'stream',
      wechatPersonalBindingStatus: 'bound',
      wechatPersonalBotToken: 'bot-token',
      wechatPersonalBaseUrl: 'https://ilink.example.com',
      wechatPersonalAccountId: 'bot@im.bot',
      wechatPersonalUserId: 'user@im.wechat',
    }))
  })
})
