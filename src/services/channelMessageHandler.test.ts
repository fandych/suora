import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChannelConfig } from '@/types'
import { buildWeChatXMLReply, parseWeChatXML, restoreChannelRuntime } from './channelMessageHandler'

function createChannel(overrides: Partial<ChannelConfig> = {}): ChannelConfig {
  return {
    id: 'channel-1',
    name: 'Channel 1',
    platform: 'feishu',
    enabled: true,
    status: 'inactive',
    connectionMode: 'webhook',
    webhookPath: '/webhook/feishu/channel-1',
    autoReply: true,
    replyAgentId: 'default-assistant',
    createdAt: Date.now(),
    messageCount: 0,
    ...overrides,
  }
}

describe('channelMessageHandler WeChat XML', () => {
  beforeEach(() => {
    vi.mocked(window.electron.invoke).mockReset()
  })

  it('parses well-formed WeChat XML via DOM parsing', () => {
    const xml = `<xml>
  <ToUserName><![CDATA[toUser]]></ToUserName>
  <FromUserName><![CDATA[fromUser]]></FromUserName>
  <CreateTime>1710000000</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[Hello <world> & team]]></Content>
  <MsgId>123456</MsgId>
</xml>`

    const parsed = parseWeChatXML(xml)

    expect(parsed?.ToUserName).toBe('toUser')
    expect(parsed?.FromUserName).toBe('fromUser')
    expect(parsed?.MsgType).toBe('text')
    expect(parsed?.Content).toBe('Hello <world> & team')
    expect(parsed?.MsgId).toBe('123456')
  })

  it('returns null for invalid XML payloads', () => {
    expect(parseWeChatXML('<xml><MsgType>text</xml>')).toBeNull()
  })

  it('escapes CDATA terminators in generated replies', () => {
    const xml = buildWeChatXMLReply('to]]>user', 'from]]>user', 'hello ]]> world')
    const parsed = parseWeChatXML(xml)

    expect(parsed?.ToUserName).toBe('to]]>user')
    expect(parsed?.FromUserName).toBe('from]]>user')
    expect(parsed?.Content).toBe('hello ]]> world')
  })

  it('restores webhook runtime by registering channels and starting the server', async () => {
    const channel = createChannel()

    vi.mocked(window.electron.invoke).mockImplementation(async (channel: string) => {
      if (channel === 'channel:status') return { running: false }
      if (channel === 'channel:start') return { success: true }
      return { success: true }
    })

    await restoreChannelRuntime([channel])

    expect(window.electron.invoke).toHaveBeenCalledWith('channel:register', [channel])
    expect(window.electron.invoke).toHaveBeenCalledWith('channel:status')
    expect(window.electron.invoke).toHaveBeenCalledWith('channel:start')
  })

  it('does not start the webhook server for stream-only channels', async () => {
    vi.mocked(window.electron.invoke).mockResolvedValue({ success: true })

    await restoreChannelRuntime([
      createChannel({
        platform: 'dingtalk',
        connectionMode: 'stream',
      }),
    ])

    expect(window.electron.invoke).toHaveBeenCalledWith('channel:register', [
      expect.objectContaining({ connectionMode: 'stream', platform: 'dingtalk' }),
    ])
    expect(window.electron.invoke).not.toHaveBeenCalledWith('channel:start')
  })

  it('does not start the webhook server when it is already running', async () => {
    vi.mocked(window.electron.invoke).mockImplementation(async (channel: string) => {
      if (channel === 'channel:status') return { running: true }
      return { success: true }
    })

    await restoreChannelRuntime([createChannel()])

    expect(window.electron.invoke).toHaveBeenCalledWith('channel:status')
    expect(window.electron.invoke).not.toHaveBeenCalledWith('channel:start')
  })
})