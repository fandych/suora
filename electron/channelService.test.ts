import { describe, expect, it } from 'vitest'
import { buildWeChatSignature, parseWeChatWebhookPayload, weChatPersonalMessageToChannelMessage, weChatWebhookToChannelMessage } from './channelService'

describe('channelService WeChat helpers', () => {
  it('parses XML webhook payloads', () => {
    const payload = parseWeChatWebhookPayload(`<xml>
  <ToUserName><![CDATA[toUser]]></ToUserName>
  <FromUserName><![CDATA[fromUser]]></FromUserName>
  <CreateTime>1710000000</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[hello wechat]]></Content>
  <MsgId>123456</MsgId>
</xml>`)

    expect(payload).toEqual(expect.objectContaining({
      ToUserName: 'toUser',
      FromUserName: 'fromUser',
      CreateTime: 1710000000,
      MsgType: 'text',
      Content: 'hello wechat',
      MsgId: '123456',
    }))
  })

  it('accepts object payloads and maps them to channel messages', () => {
    const payload = parseWeChatWebhookPayload({
      FromUserName: 'wx-user',
      ToUserName: 'bot',
      CreateTime: '1710000001',
      MsgType: 'event',
      Event: 'subscribe',
      EventKey: 'qrscene_42',
    })

    expect(payload).not.toBeNull()
    if (!payload) throw new Error('Expected payload to be parsed')
    const message = weChatWebhookToChannelMessage(payload, 'channel-1', 'wechat_official')
    expect(message).toEqual(expect.objectContaining({
      channelId: 'channel-1',
      platform: 'wechat_official',
      senderId: 'wx-user',
      chatId: 'wx-user',
      messageType: 'text',
      content: '[Event: subscribe - qrscene_42]',
    }))
  })

  it('builds plain and encrypted WeChat signatures', () => {
    expect(buildWeChatSignature('token', '123', '456')).toBe('8779cd22a93aad0cb09babdc953a6d114bbf1c53')
    expect(buildWeChatSignature('token', '123', '456', 'cipher')).toBe('ef11aae4402600fe59281e77370e1c93296727a3')
  })

  it('maps native personal WeChat updates into channel messages', () => {
    const message = weChatPersonalMessageToChannelMessage({
      message_id: 42,
      from_user_id: 'user@im.wechat',
      create_time_ms: 1710000002000,
      item_list: [{ type: 1, text_item: { text: 'hello from qr login' } }],
    }, 'channel-1')

    expect(message).toEqual(expect.objectContaining({
      channelId: 'channel-1',
      platform: 'wechat_personal',
      senderId: 'user@im.wechat',
      chatId: 'user@im.wechat',
      messageType: 'text',
      content: 'hello from qr login',
    }))
  })
})
