import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Agent, ChannelConfig, ChannelMessage, Model } from '@/types'
import { useAppStore } from '@/store/appStore'
import { buildWeChatXMLReply, handleChannelMessage, parseWeChatXML, restoreChannelRuntime } from './channelMessageHandler'
import { setI18nLocale } from './i18n'

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
    localStorage.clear()
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

  it('does not start the webhook server for native personal WeChat channels with a bound token', async () => {
    vi.mocked(window.electron.invoke).mockResolvedValue({ success: true })

    await restoreChannelRuntime([
      createChannel({
        platform: 'wechat_personal',
        connectionMode: 'webhook',
        wechatPersonalBotToken: 'bot-token',
        wechatPersonalBindingStatus: 'bound',
      }),
    ])

    expect(window.electron.invoke).toHaveBeenCalledWith('channel:register', [
      expect.objectContaining({ platform: 'wechat_personal', wechatPersonalBotToken: 'bot-token' }),
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

  it('handles channel control commands for clearing context and fixing model or agent', async () => {
    setI18nLocale('zh')
    const channel = createChannel()
    const message: ChannelMessage = {
      id: 'msg-1',
      channelId: channel.id,
      platform: channel.platform,
      senderId: 'user-1',
      senderName: 'User One',
      content: '/clear',
      timestamp: Date.now(),
      messageType: 'text',
    }
    const testModel: Model = {
      id: 'model-1',
      name: 'GPT Test',
      provider: 'openai',
      providerType: 'openai',
      modelId: 'gpt-test',
      apiKey: 'test-key',
      enabled: true,
    }
    const testAgent: Agent = {
      id: 'agent-1',
      name: 'Research Agent',
      systemPrompt: 'Research',
      modelId: 'model-1',
      skills: [],
      enabled: true,
      memories: [],
      autoLearn: false,
    }
    useAppStore.setState({
      agents: [testAgent],
      models: [testModel],
      selectedModel: testModel,
      channelUsers: {
        [`${channel.id}:user-1`]: {
          id: `${channel.id}:user-1`,
          channelId: channel.id,
          senderId: 'user-1',
          senderName: 'User One',
          platform: channel.platform,
          firstSeenAt: Date.now(),
          lastActiveAt: Date.now(),
          messageCount: 1,
          conversationHistory: [{ role: 'user', content: 'old context', timestamp: Date.now() }],
        },
      },
    })

    await expect(handleChannelMessage(channel, message)).resolves.toBe('上下文已清除。')
    expect(useAppStore.getState().channelUsers[`${channel.id}:user-1`]?.conversationHistory).toEqual([])

    await expect(handleChannelMessage(channel, { ...message, id: 'msg-2', content: '/model user GPT Test' })).resolves.toBe('已切换模型：GPT Test')
    expect(useAppStore.getState().channelUsers[`${channel.id}:user-1`]?.modelId).toBe('model-1')

    await expect(handleChannelMessage(channel, { ...message, id: 'msg-3', content: '/agent use $Research Agent' })).resolves.toBe('已固定使用 Agent：Research Agent')
    expect(useAppStore.getState().channelUsers[`${channel.id}:user-1`]?.agentId).toBe('agent-1')

    const helpReply = await handleChannelMessage(channel, { ...message, id: 'msg-4', content: '/help' })
    expect(helpReply).toContain('/clear')
    expect(helpReply).toContain('/pipeline')
    setI18nLocale('en')
  })

  it('reports a friendly error when a builder shortcut targets a missing builder agent', async () => {
    setI18nLocale('en')
    const channel = createChannel()
    const message: ChannelMessage = {
      id: 'msg-shortcut-missing',
      channelId: channel.id,
      platform: channel.platform,
      senderId: 'user-shortcut',
      senderName: 'User Shortcut',
      content: '/pipeline create morning summary',
      timestamp: Date.now(),
      messageType: 'text',
    }
    useAppStore.setState({
      agents: [],
      models: [],
      selectedModel: null,
      channelUsers: {},
    })

    const reply = await handleChannelMessage(channel, message)
    expect(reply).toContain('Builder agent for /pipeline')
    // Importantly: no per-user pinned agent has been written.
    expect(useAppStore.getState().channelUsers[`${channel.id}:user-shortcut`]?.agentId).toBeUndefined()
  })
})