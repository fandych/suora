import type { ChannelConfigRecord } from "@/data/domain/models"
import { sendMessageForChannel } from "@electron/others/channels/channel-runtime-send"
import type { TokenCacheEntry } from "@electron/others/channels/channel-runtime-helpers"

type QueueItem = {
  id: string
  channel: ChannelConfigRecord
  chatId: string
  content: string
  retryCount: number
  maxRetries: number
  nextRetryAt: number
}

export class ChannelMessageQueue {
  private readonly queue: QueueItem[] = []
  private readonly lastSentPerChannel = new Map<string, number>()
  private processing = false
  private readonly rateLimitWindow = 1000

  constructor(private readonly tokenCache: Map<string, TokenCacheEntry>) {}

  enqueue(channel: ChannelConfigRecord, chatId: string, content: string, maxRetries = 3) {
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
    item.nextRetryAt = Date.now() + 2 ** item.retryCount * 1000
    this.queue.push(item)
  }

  private delay(milliseconds: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
  }
}
