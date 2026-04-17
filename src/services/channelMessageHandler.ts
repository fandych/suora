import { useAppStore } from '@/store/appStore'
import { streamResponseWithTools, initializeProvider, validateModelConfig } from './aiService'
import { getToolsForAgent, getSkillSystemPrompts, mergeSkillsWithBuiltins, buildSystemPrompt } from './tools'
import type { ChannelConfig, ChannelMessage, ChannelHistoryMessage, ChannelUser, ChannelUserConversationMessage } from '@/types'
import type { ModelMessage } from 'ai'
import { logger } from './logger'

// Maximum number of conversation history entries per user
const MAX_USER_CONVERSATION_HISTORY = 20

function storeChannelMessage(msg: ChannelHistoryMessage) {
  useAppStore.getState().addChannelMessage(msg)
}

/**
 * Track and update channel user, returning updated user with conversation history
 */
function trackChannelUser(channel: ChannelConfig, message: ChannelMessage): ChannelUser {
  const state = useAppStore.getState()
  const userKey = `${channel.id}:${message.senderId}`
  const existing = state.channelUsers[userKey]

  const user: ChannelUser = existing
    ? {
        ...existing,
        senderName: message.senderName || existing.senderName,
        lastActiveAt: Date.now(),
        messageCount: existing.messageCount + 1,
        conversationHistory: existing.conversationHistory,
      }
    : {
        id: userKey,
        channelId: channel.id,
        senderId: message.senderId,
        senderName: message.senderName || message.senderId,
        platform: channel.platform,
        firstSeenAt: Date.now(),
        lastActiveAt: Date.now(),
        messageCount: 1,
        conversationHistory: [],
      }

  state.upsertChannelUser(user)
  return user
}

/**
 * Append a message to user's conversation history and persist
 */
function appendUserConversation(channelId: string, senderId: string, entry: ChannelUserConversationMessage): void {
  const state = useAppStore.getState()
  const userKey = `${channelId}:${senderId}`
  const user = state.channelUsers[userKey]
  if (!user) return

  const updated: ChannelUser = {
    ...user,
    conversationHistory: [
      ...user.conversationHistory,
      entry,
    ].slice(-MAX_USER_CONVERSATION_HISTORY), // Keep only recent entries
  }
  state.upsertChannelUser(updated)
}

// ─── Non-Text Message Processing ───────────────────────────────────

function formatNonTextContent(message: ChannelMessage): string {
  switch (message.messageType) {
    case 'image':
      return `[Image: ${message.content || 'Received an image'}]\n(Image URL/data: ${message.content.slice(0, 200)})`
    case 'file':
      return `[File: ${message.content || 'Received a file'}]\n(File info: ${message.content.slice(0, 200)})`
    case 'voice':
      return `[Voice Message: ${message.content || 'Received a voice message'}]\n(Audio data reference: ${message.content.slice(0, 100)})`
    case 'text':
    default:
      return message.content
  }
}

// ─── WeChat Enterprise XML Parser ──────────────────────────────────

export interface WeChatXMLMessage {
  ToUserName: string
  FromUserName: string
  CreateTime: number
  MsgType: 'text' | 'image' | 'voice' | 'video' | 'location' | 'link' | 'event'
  Content?: string          // for text
  PicUrl?: string           // for image
  MediaId?: string          // for image/voice/video
  Format?: string           // for voice (amr/speex)
  Recognition?: string      // for voice (speech-to-text)
  ThumbMediaId?: string     // for video
  Location_X?: string       // latitude
  Location_Y?: string       // longitude
  Scale?: string
  Label?: string            // location label
  Title?: string            // for link
  Description?: string      // for link
  Url?: string              // for link
  Event?: string            // for event (subscribe/unsubscribe/CLICK/VIEW)
  EventKey?: string
  MsgId?: string
  AgentID?: string          // WeChat Work agent ID
}

function parseWeChatXMLWithRegex(xml: string): WeChatXMLMessage | null {
  const getTag = (tag: string): string | undefined => {
    const cdataMatch = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`))
    if (cdataMatch) return cdataMatch[1]
    const plainMatch = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))
    return plainMatch ? plainMatch[1] : undefined
  }

  const msgType = getTag('MsgType')?.trim()
  if (!msgType) return null

  return {
    ToUserName: getTag('ToUserName') || '',
    FromUserName: getTag('FromUserName') || '',
    CreateTime: parseInt(getTag('CreateTime') || '0', 10),
    MsgType: msgType as WeChatXMLMessage['MsgType'],
    Content: getTag('Content'),
    PicUrl: getTag('PicUrl'),
    MediaId: getTag('MediaId'),
    Format: getTag('Format'),
    Recognition: getTag('Recognition'),
    ThumbMediaId: getTag('ThumbMediaId'),
    Location_X: getTag('Location_X'),
    Location_Y: getTag('Location_Y'),
    Scale: getTag('Scale'),
    Label: getTag('Label'),
    Title: getTag('Title'),
    Description: getTag('Description'),
    Url: getTag('Url'),
    Event: getTag('Event'),
    EventKey: getTag('EventKey'),
    MsgId: getTag('MsgId'),
    AgentID: getTag('AgentID'),
  }
}

function toSafeCData(value: string): string {
  return value.replace(/]]>/g, ']]]]><![CDATA[>')
}

export function parseWeChatXML(xml: string): WeChatXMLMessage | null {
  try {
    if (typeof DOMParser === 'undefined') {
      return parseWeChatXMLWithRegex(xml)
    }

    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    if (doc.getElementsByTagName('parsererror').length > 0) {
      return parseWeChatXMLWithRegex(xml)
    }

    const root = doc.documentElement
    if (!root || root.nodeName !== 'xml') return null

    const getTag = (tag: string): string | undefined => {
      const node = root.getElementsByTagName(tag).item(0)
      return node?.textContent ?? undefined
    }

    const msgType = getTag('MsgType')?.trim()
    if (!msgType) return null

    return {
      ToUserName: getTag('ToUserName') || '',
      FromUserName: getTag('FromUserName') || '',
      CreateTime: parseInt(getTag('CreateTime') || '0', 10),
      MsgType: msgType as WeChatXMLMessage['MsgType'],
      Content: getTag('Content'),
      PicUrl: getTag('PicUrl'),
      MediaId: getTag('MediaId'),
      Format: getTag('Format'),
      Recognition: getTag('Recognition'),
      ThumbMediaId: getTag('ThumbMediaId'),
      Location_X: getTag('Location_X'),
      Location_Y: getTag('Location_Y'),
      Scale: getTag('Scale'),
      Label: getTag('Label'),
      Title: getTag('Title'),
      Description: getTag('Description'),
      Url: getTag('Url'),
      Event: getTag('Event'),
      EventKey: getTag('EventKey'),
      MsgId: getTag('MsgId'),
      AgentID: getTag('AgentID'),
    }
  } catch (err) {
    logger.error('Failed to parse WeChat XML', { error: err })
    return null
  }
}

export function weChatXMLToChannelMessage(parsed: WeChatXMLMessage, channelId: string): ChannelMessage {
  let content = ''
  let messageType: ChannelMessage['messageType'] = 'text'

  switch (parsed.MsgType) {
    case 'text':
      content = parsed.Content || ''
      messageType = 'text'
      break
    case 'image':
      content = parsed.PicUrl || parsed.MediaId || '[Image]'
      messageType = 'image'
      break
    case 'voice':
      content = parsed.Recognition || parsed.MediaId || '[Voice]'
      messageType = 'voice'
      break
    case 'video':
      content = parsed.ThumbMediaId || parsed.MediaId || '[Video]'
      messageType = 'file'
      break
    case 'location':
      content = `[Location] ${parsed.Label || 'Location'} (${parsed.Location_X}, ${parsed.Location_Y})`
      messageType = 'text'
      break
    case 'link':
      content = `[Link] ${parsed.Title || 'Link'}: ${parsed.Url || ''}\n${parsed.Description || ''}`
      messageType = 'text'
      break
    case 'event':
      content = `[Event: ${parsed.Event}${parsed.EventKey ? ` - ${parsed.EventKey}` : ''}]`
      messageType = 'text'
      break
    default:
      content = `[Unsupported message type: ${parsed.MsgType}]`
  }

  return {
    id: parsed.MsgId || `wechat-${Date.now()}`,
    channelId,
    platform: 'wechat',
    senderId: parsed.FromUserName,
    content,
    timestamp: parsed.CreateTime * 1000,
    messageType,
  }
}

/**
 * Build a WeChat XML reply envelope
 */
export function buildWeChatXMLReply(
  toUser: string,
  fromUser: string,
  content: string,
  msgType: 'text' | 'image' = 'text'
): string {
  const timestamp = Math.floor(Date.now() / 1000)
  const safeToUser = toSafeCData(toUser)
  const safeFromUser = toSafeCData(fromUser)
  const safeContent = toSafeCData(content)
  if (msgType === 'text') {
    return `<xml>
  <ToUserName><![CDATA[${safeToUser}]]></ToUserName>
  <FromUserName><![CDATA[${safeFromUser}]]></FromUserName>
  <CreateTime>${timestamp}</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[${safeContent}]]></Content>
</xml>`
  }
  // Image reply
  return `<xml>
  <ToUserName><![CDATA[${safeToUser}]]></ToUserName>
  <FromUserName><![CDATA[${safeFromUser}]]></FromUserName>
  <CreateTime>${timestamp}</CreateTime>
  <MsgType><![CDATA[image]]></MsgType>
  <Image><MediaId><![CDATA[${safeContent}]]></MediaId></Image>
</xml>`
}

/**
 * Handle incoming channel messages and generate AI responses
 * Supports per-user multi-turn conversation context
 */
export async function handleChannelMessage(
  channel: ChannelConfig,
  message: ChannelMessage
): Promise<string> {
  try {
    logger.info('Processing channel message', {
      channelId: channel.id,
      platform: channel.platform,
      messageId: message.id,
      senderId: message.senderId,
    })

    // Track the user and get their conversation history
    const user = trackChannelUser(channel, message)

    // Get the agent configured for this channel
    const state = useAppStore.getState()
    const agent = state.agents.find((a) => a.id === channel.replyAgentId)

    if (!agent) {
      logger.warn('Agent not found for channel', { agentId: channel.replyAgentId })
      return '抱歉，当前助手不可用。'
    }

    // Get the model for this agent or use the default
    const model = agent.modelId
      ? state.models.find((m) => m.id === agent.modelId) || state.selectedModel
      : state.selectedModel

    if (!model) {
      logger.warn('No model available')
      return '抱歉，当前模型不可用。'
    }

    // Validate model configuration
    const validation = validateModelConfig(model)
    if (!validation.valid) {
      logger.warn('Model configuration invalid', { error: validation.error })
      return `抱歉，模型配置不完整：${validation.error}`
    }

    // Initialize AI provider (must be done before streaming)
    try {
      if (model.apiKey || model.providerType === 'ollama') {
        initializeProvider(model.providerType, model.apiKey || 'ollama', model.baseUrl, model.provider)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to initialize AI provider'
      logger.error('Failed to initialize provider for channel', { error: errorMsg })
      return `抱歉，AI 服务初始化失败：${errorMsg}`
    }

    // Build conversation messages with per-user context for multi-turn conversations
    const formattedContent = formatNonTextContent(message)

    // Include prior conversation history for this specific user
    const conversationMessages: ModelMessage[] = [
      ...user.conversationHistory.map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      {
        role: 'user' as const,
        content: formattedContent,
      },
    ]

    // Store the user's message in their conversation history
    appendUserConversation(channel.id, message.senderId, {
      role: 'user',
      content: formattedContent,
      timestamp: Date.now(),
    })

    // Add agent memories to system prompt if autoLearn is enabled
    let agentPromptBase = agent.systemPrompt

    // Add user context to system prompt (sanitize user-provided data to prevent prompt injection)
    if (message.senderName) {
      const safeName = String(message.senderName).replace(/[<>&"'`\n\r]/g, '').slice(0, 100)
      const safeId = String(message.senderId).replace(/[<>&"'`\n\r]/g, '').slice(0, 100)
      agentPromptBase += `\n\nCurrent user: ${safeName} (ID: ${safeId})`
    }

    // Build tools for the agent (same as direct chat)
    const { skills } = state
    const allSkills = mergeSkillsWithBuiltins(skills)
    const filteredTools = getToolsForAgent(agent.skills, allSkills, {
      allowedTools: agent.allowedTools,
      disallowedTools: agent.disallowedTools,
      permissionMode: (agent as unknown as { permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions' }).permissionMode,
    })

    // Add skill system prompts
    const skillPrompts = await getSkillSystemPrompts(agent.skills, allSkills)

    const systemPrompt = buildSystemPrompt({
      agentPrompt: agentPromptBase,
      responseStyle: agent.responseStyle as string | undefined,
      memories: agent.autoLearn ? agent.memories : undefined,
      skillPrompts: skillPrompts || undefined,
      toolNames: Object.keys(filteredTools),
      permissionMode: (agent as unknown as { permissionMode?: string }).permissionMode,
    }) ?? agent.systemPrompt

    // Build proper model identifier (provider:modelId)
    const modelIdentifier = `${model.provider}:${model.modelId}`

    // Stream the response and collect it
    let fullResponse = ''

    try {
      for await (const event of streamResponseWithTools(
        modelIdentifier,
        conversationMessages,
        {
          systemPrompt,
          tools: filteredTools,
          maxSteps: Math.max(2, Math.min(agent.maxTurns ?? 20, 50)),
          apiKey: model.apiKey,
          baseUrl: model.baseUrl,
        }
      )) {
        switch (event.type) {
          case 'text-delta':
            fullResponse += event.text
            break
          case 'tool-call':
            logger.info('Channel tool call', { toolName: event.toolName, toolCallId: event.toolCallId })
            break
          case 'tool-result':
            logger.info('Channel tool result', { toolName: event.toolName, outputLength: event.output?.length ?? 0 })
            break
          case 'tool-error':
            logger.error('Channel tool error', { toolName: event.toolName, error: event.error })
            break
          case 'error':
            logger.error('Channel stream error', { error: event.error })
            break
        }
      }
    } catch (error) {
      logger.error('Error streaming response', { error })
      throw error
    }

    // Update channel stats
    useAppStore.setState((state) => ({
      channels: state.channels.map((c) =>
        c.id === channel.id
          ? {
              ...c,
              messageCount: c.messageCount + 1,
              lastMessageAt: Date.now(),
              status: 'active' as const,
            }
          : c
      ),
    }))

    // Store assistant response in user's conversation history for multi-turn context
    appendUserConversation(channel.id, message.senderId, {
      role: 'assistant',
      content: fullResponse,
      timestamp: Date.now(),
    })

    logger.info('Channel message processed successfully', {
      channelId: channel.id,
      senderId: message.senderId,
      responseLength: fullResponse.length,
    })

    return fullResponse
  } catch (error) {
    logger.error('Failed to handle channel message', { error, channelId: channel.id })

    // Update channel status to error
    useAppStore.setState((state) => ({
      channels: state.channels.map((c) =>
        c.id === channel.id ? { ...c, status: 'error' as const } : c
      ),
    }))

    return '抱歉，处理消息时出现错误，请稍后重试。'
  }
}

/**
 * Send reply back to the platform
 */
export async function sendChannelReply(
  channel: ChannelConfig,
  chatId: string,
  content: string
): Promise<boolean> {
  try {
    const result = await window.electron.invoke(
      'channel:sendMessage',
      channel.id,
      chatId,
      content
    ) as { success?: boolean; error?: string }

    if (result.error) {
      logger.error('Failed to send channel reply', {
        error: result.error,
        channelId: channel.id,
      })
      return false
    }

    return true
  } catch (error) {
    logger.error('Error sending channel reply', { error, channelId: channel.id })
    return false
  }
}

/**
 * Initialize channel message listener
 * This should be called once when the app starts.
 * Returns a cleanup function to remove the listener.
 */
export function initChannelMessageListener(): () => void {
  // Listen for incoming channel messages from main process
  const handler = async (_event: unknown, data: unknown) => {
    const { channel, message } = data as {
      channel: ChannelConfig
      message: ChannelMessage
    }

    logger.info('Received channel message', {
      channelId: channel.id,
      platform: channel.platform,
      sender: message.senderName,
    })

    // Store incoming message in history
    storeChannelMessage({
      id: message.id,
      channelId: channel.id,
      direction: 'incoming',
      platform: channel.platform,
      senderId: message.senderId,
      senderName: message.senderName,
      content: message.content,
      timestamp: message.timestamp,
      status: 'delivered',
    })

    // Handle the message if autoReply is enabled
    if (channel.autoReply) {
      const response = await handleChannelMessage(channel, message)

      // Store outgoing reply in history
      storeChannelMessage({
        id: `reply-${message.id}`,
        channelId: channel.id,
        direction: 'outgoing',
        platform: channel.platform,
        senderId: 'assistant',
        senderName: 'AI Assistant',
        content: response,
        timestamp: Date.now(),
        status: 'pending',
      })

      // Send reply back
      if (message.chatId) {
        const success = await sendChannelReply(channel, message.chatId, response)
        if (success) {
          logger.info('Reply sent successfully', { channelId: channel.id })

          // Update message status
          useAppStore.setState((state) => ({
            channelMessages: state.channelMessages.map((m) =>
              m.id === `reply-${message.id}` ? { ...m, status: 'sent' as const } : m
            ),
          }))
        } else {
          // Mark as failed
          useAppStore.setState((state) => ({
            channelMessages: state.channelMessages.map((m) =>
              m.id === `reply-${message.id}` ? { ...m, status: 'failed' as const } : m
            ),
          }))
        }
      }
    } else {
      logger.info('AutoReply disabled, message not processed', {
        channelId: channel.id,
      })
    }
  }

  window.electron.on('channel:message', handler)
  logger.info('Channel message listener initialized')

  // Return cleanup function
  return () => {
    window.electron.off('channel:message', handler)
    logger.info('Channel message listener removed')
  }
}

/**
 * Register channels with the main process
 */
export async function registerChannels(channels: ChannelConfig[]): Promise<void> {
  try {
    const enabledChannels = channels.filter((c) => c.enabled)

    await window.electron.invoke('channel:register', enabledChannels)

    logger.info('Channels registered', { count: enabledChannels.length })
  } catch (error) {
    logger.error('Failed to register channels', { error })
    throw error
  }
}

/**
 * Restore channel runtime state on startup.
 * - Always registers enabled channels so webhook routes and stream clients are rebuilt
 * - Auto-starts the HTTP webhook server when at least one enabled webhook-mode channel exists
 */
export async function restoreChannelRuntime(channels: ChannelConfig[]): Promise<void> {
  await registerChannels(channels)

  const hasEnabledWebhookChannel = channels.some(
    (channel) => channel.enabled && (channel.connectionMode ?? 'webhook') === 'webhook',
  )

  if (!hasEnabledWebhookChannel) return

  const running = await getChannelServerStatus()
  if (!running) {
    await startChannelServer()
  }
}

/**
 * Start the channel webhook server
 */
export async function startChannelServer(): Promise<boolean> {
  try {
    const result = await window.electron.invoke('channel:start') as {
      success?: boolean
      error?: string
    }

    if (result.error) {
      logger.error('Failed to start channel server', { error: result.error })
      return false
    }

    logger.info('Channel server started successfully')
    return true
  } catch (error) {
    logger.error('Error starting channel server', { error })
    return false
  }
}

/**
 * Stop the channel webhook server
 */
export async function stopChannelServer(): Promise<boolean> {
  try {
    const result = await window.electron.invoke('channel:stop') as {
      success?: boolean
      error?: string
    }

    if (result.error) {
      logger.error('Failed to stop channel server', { error: result.error })
      return false
    }

    logger.info('Channel server stopped successfully')
    return true
  } catch (error) {
    logger.error('Error stopping channel server', { error })
    return false
  }
}

/**
 * Get channel webhook server status
 */
export async function getChannelServerStatus(): Promise<boolean> {
  try {
    const result = await window.electron.invoke('channel:status') as {
      running: boolean
    }

    return result.running
  } catch (error) {
    logger.error('Error getting channel server status', { error })
    return false
  }
}

/**
 * Get webhook URL for a channel
 */
export async function getChannelWebhookUrl(channel: ChannelConfig): Promise<string | null> {
  try {
    const result = await window.electron.invoke('channel:getWebhookUrl', channel) as {
      success?: boolean
      url?: string
      error?: string
    }

    if (result.error || !result.url) {
      logger.error('Failed to get webhook URL', { error: result.error })
      return null
    }

    return result.url
  } catch (error) {
    logger.error('Error getting webhook URL', { error })
    return null
  }
}
