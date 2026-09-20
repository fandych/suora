import type { ChannelConfigRecord } from "@/types/channel"
import { sendMessageForChannel } from "@/electron/app/channels/runtime/channel-runtime-send"
import type { TokenCacheEntry } from "@/electron/app/channels/runtime/channel-runtime-helpers"

type QueueItem = {
  id: string
  channel: ChannelConfigRecord
  chatId: string
  content: string
  retryCount: number
  maxRetries: number
  nextRetryAt: number
}

const MAX_RETRY_DELAY_MS = 5 * 60 * 1000
const MAX_QUEUE_ITEMS = 500
const MAX_QUEUE_ITEMS_PER_CHANNEL = 100
const MAX_QUEUE_CONTENT_BYTES = 32 * 1024

export class ChannelMessageQueue {
  private readonly queue: QueueItem[] = []
  private readonly lastSentPerChannel = new Map<string, number>()
  private processing = false
  private readonly rateLimitWindow = 1000
  private readonly tokenCache: Map<string, TokenCacheEntry>

  constructor(tokenCache: Map<string, TokenCacheEntry>) {
    this.tokenCache = tokenCache
  }

  enqueue(channel: ChannelConfigRecord, chatId: string, content: string, maxRetries = 3) {
    if (Buffer.byteLength(content, "utf8") > MAX_QUEUE_CONTENT_BYTES) {
      throw new Error("Queued channel message exceeds the 32 KB size limit.")
    }
    if (this.queue.length >= MAX_QUEUE_ITEMS) {
      throw new Error("Channel message queue is full.")
    }
    if (this.queue.filter((item) => item.channel.id === channel.id).length >= MAX_QUEUE_ITEMS_PER_CHANNEL) {
      throw new Error(`Channel message queue for '${channel.id}' is full.`)
    }
    const id = `mq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    this.queue.push({ id, channel, chatId, content, retryCount: 0, maxRetries, nextRetryAt: 0 })
    void this.processQueue()
    return id
  }

  private async processQueue() {
    if (this.processing) return
    this.processing = true

    try {
      while (this.queue.length > 0) {
        const item = this.queue[0]
        if (!item) break
        await this.waitForSendWindow(item)
        await this.sendOrRetry(item)
      }
    } finally {
      this.processing = false
    }
  }

  private async waitForSendWindow(item: QueueItem) {
    const lastSent = this.lastSentPerChannel.get(item.channel.id) || 0
    const remainingRateLimit = this.rateLimitWindow - (Date.now() - lastSent)
    if (remainingRateLimit > 0) await this.delay(remainingRateLimit)

    const remainingRetryDelay = item.nextRetryAt - Date.now()
    if (remainingRetryDelay > 0) await this.delay(remainingRetryDelay)
  }

  private async sendOrRetry(item: QueueItem) {
    const result = await sendMessageForChannel(item.channel, item.chatId, item.content, this.tokenCache)
    this.lastSentPerChannel.set(item.channel.id, Date.now())
    this.queue.shift()
    if (result.success || item.retryCount >= item.maxRetries - 1) return

    item.retryCount += 1
    item.nextRetryAt = Date.now() + Math.min(2 ** item.retryCount * 1000, MAX_RETRY_DELAY_MS)
    this.queue.push(item)
  }

  private delay(milliseconds: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
  }
}
