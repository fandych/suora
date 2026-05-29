import { useState, type ComponentPropsWithoutRef } from 'react'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { useI18n } from '@/hooks/useI18n'
import { ChannelPlatformIcon } from './ChannelIcons'
import type { ChannelHistoryMessage, ChannelMessageDirection } from '@/types'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ─── Channel Copy Button ───────────────────────────────────────────

export function ChannelCopyButton({ text, className = '' }: { text: string; className?: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => { /* clipboard access denied */ })
  }
  return (
    <button onClick={copy} title={copied ? t('common.copied', 'Copied') : t('common.copy', 'Copy')} className={`text-[11px] px-1.5 py-0.5 rounded-md transition-colors inline-flex items-center gap-1 ${copied ? 'text-success' : 'text-text-muted hover:text-text-secondary hover:bg-surface-3/60'} ${className}`}>
      {copied
        ? <><IconifyIcon name="ui-check" size={12} color="currentColor" /> {t('common.copied', 'Copied')}</>
        : <><IconifyIcon name="ui-copy" size={12} color="currentColor" /> {t('common.copy', 'Copy')}</>}
    </button>
  )
}

// ─── Channel Code Block ────────────────────────────────────────────

function ChannelCodeBlock({ children, className, ...rest }: ComponentPropsWithoutRef<'code'>) {
  const { t } = useI18n()
  const isInline = !className
  const code = String(children).replace(/\n$/, '')
  const lang = className?.replace('language-', '') ?? ''

  if (isInline) {
    return <code className="rounded-md border border-border-subtle/40 bg-surface-3/80 px-1.5 py-0.5 font-[JetBrains_Mono,monospace] text-[11.5px] text-accent" {...rest}>{children}</code>
  }

  return (
    <div className="relative group/code my-3 rounded-xl overflow-hidden border border-border-subtle/80 bg-surface-0/60 shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-2/40 border-b border-border-subtle/60">
        <span className="text-[10px] text-text-muted/70 uppercase tracking-wider font-semibold">{lang || t('channels.codeLabel', 'Code')}</span>
        <ChannelCopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-3.5 text-[11.5px] leading-relaxed"><code className="font-[JetBrains_Mono,monospace] text-text-primary" {...rest}>{children}</code></pre>
    </div>
  )
}

// ─── Channel Markdown Renderer ─────────────────────────────────────

const CHANNEL_MD_COMPONENTS = {
  code: ChannelCodeBlock,
  p: ({ children, ...props }: ComponentPropsWithoutRef<'p'>) => <p className="mb-2 text-[12px] leading-6 last:mb-0" {...props}>{children}</p>,
  ul: ({ children, ...props }: ComponentPropsWithoutRef<'ul'>) => <ul className="mb-2 list-disc space-y-0.5 pl-5" {...props}>{children}</ul>,
  ol: ({ children, ...props }: ComponentPropsWithoutRef<'ol'>) => <ol className="mb-2 list-decimal space-y-0.5 pl-5" {...props}>{children}</ol>,
  li: ({ children, ...props }: ComponentPropsWithoutRef<'li'>) => <li className="text-[12px] leading-6" {...props}>{children}</li>,
  h1: ({ children, ...props }: ComponentPropsWithoutRef<'h1'>) => <h1 className="mt-3 mb-1.5 text-[15px] font-bold" {...props}>{children}</h1>,
  h2: ({ children, ...props }: ComponentPropsWithoutRef<'h2'>) => <h2 className="mt-2.5 mb-1 text-[14px] font-bold" {...props}>{children}</h2>,
  h3: ({ children, ...props }: ComponentPropsWithoutRef<'h3'>) => <h3 className="mt-2 mb-1 text-[13px] font-semibold" {...props}>{children}</h3>,
  blockquote: ({ children, ...props }: ComponentPropsWithoutRef<'blockquote'>) => <blockquote className="border-l-2 border-accent/30 pl-3 my-2 text-text-secondary italic" {...props}>{children}</blockquote>,
  table: ({ children, ...props }: ComponentPropsWithoutRef<'table'>) => <div className="my-2 overflow-x-auto"><table className="w-full border-collapse text-[11.5px]" {...props}>{children}</table></div>,
  th: ({ children, ...props }: ComponentPropsWithoutRef<'th'>) => <th className="border border-border px-2 py-1.5 bg-surface-2 text-left font-semibold text-text-secondary" {...props}>{children}</th>,
  td: ({ children, ...props }: ComponentPropsWithoutRef<'td'>) => <td className="border border-border px-2 py-1.5 text-text-primary" {...props}>{children}</td>,
  a: ({ children, ...props }: ComponentPropsWithoutRef<'a'>) => <a className="text-accent underline underline-offset-2 hover:text-accent-hover" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>,
  hr: (props: ComponentPropsWithoutRef<'hr'>) => <hr className="my-3 border-border" {...props} />,
} as const

function ChannelMarkdownContent({ content }: { content: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={CHANNEL_MD_COMPONENTS as Record<string, React.ComponentType<unknown>>}>
      {content}
    </Markdown>
  )
}

// ─── Relative Time ─────────────────────────────────────────────────

export function formatChannelRelativeTime(value: number | undefined, locale: string, emptyLabel = ''): string {
  if (!value) return emptyLabel

  const diff = Date.now() - value
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (diff < 60_000) return formatter.format(0, 'second')
  if (diff < 3_600_000) return formatter.format(-Math.max(1, Math.floor(diff / 60_000)), 'minute')
  if (diff < 86_400_000) return formatter.format(-Math.max(1, Math.floor(diff / 3_600_000)), 'hour')
  if (diff < 604_800_000) return formatter.format(-Math.max(1, Math.floor(diff / 86_400_000)), 'day')

  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(value))
}

export function formatChannelAbsoluteTime(value: number | undefined, locale: string, emptyLabel = ''): string {
  if (!value) return emptyLabel

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function normalizeChannelDirection(direction?: string): ChannelMessageDirection {
  const normalized = direction?.trim().toLowerCase()
  if (normalized === 'outgoing' || normalized === 'send' || normalized === 'sent' || normalized === 'assistant') return 'outgoing'
  return 'incoming'
}

// ─── Channel Message Bubble ────────────────────────────────────────

export function ChannelMessageBubble({ msg, showChannel }: { msg: ChannelHistoryMessage; showChannel?: string }) {
  const { t, locale } = useI18n()
  const isOutgoing = normalizeChannelDirection(msg.direction) === 'outgoing'
  const statusLabel = msg.status === 'sent'
    ? t('channels.statusSent', 'Sent')
    : msg.status === 'delivered'
      ? t('channels.statusDelivered', 'Delivered')
    : msg.status === 'failed'
      ? t('channels.statusFailed', 'Failed')
      : msg.status === 'pending'
        ? t('channels.pending', 'Pending')
        : msg.status

  const senderLabel = msg.senderName || msg.senderId || t('channels.unknownSender', 'Unknown sender')
  const relativeTime = formatChannelRelativeTime(msg.timestamp, locale)
  const absoluteTime = formatChannelAbsoluteTime(msg.timestamp, locale)

  const incomingBubbleCls = 'bg-surface-2/68 text-text-primary rounded-3xl rounded-bl-md border border-border/60 shadow-sm'
  const outgoingBubbleCls = 'bg-gradient-to-br from-accent to-accent-hover text-white rounded-3xl rounded-br-md shadow-[0_8px_24px_rgba(var(--t-accent-rgb),0.22)]'

  const statusCls =
    msg.status === 'sent' ? 'bg-green-500/15 text-green-400' :
    msg.status === 'delivered' ? 'bg-blue-500/12 text-blue-400' :
    msg.status === 'failed' ? 'bg-red-500/15 text-red-400' :
    msg.status === 'pending' ? 'bg-yellow-500/15 text-yellow-400' :
    'bg-surface-3 text-text-muted'

  return (
    <div className={`group mb-4 flex animate-fade-in ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      {/* Incoming avatar */}
      {!isOutgoing && (
        <div className="mr-3 mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-accent/10 bg-gradient-to-br from-accent/22 via-accent/8 to-transparent shadow-sm">
          <ChannelPlatformIcon platform={msg.platform} size={16} />
        </div>
      )}

      <div className="flex max-w-[82%] flex-col">
        <div className={`px-4 py-3 text-[12.5px] leading-6 ${isOutgoing ? outgoingBubbleCls : incomingBubbleCls}`}>
          {/* Header: sender info, channel, time */}
          {!isOutgoing && (
            <div className="mb-2.5 flex min-w-48 flex-wrap items-center gap-2 border-b border-border-subtle/50 pb-2">
              <span className="max-w-48 truncate rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent/85">
                {senderLabel}
              </span>
              {showChannel && (
                <span className="max-w-40 truncate rounded-full bg-surface-0/65 px-2 py-0.5 text-[10px] text-text-muted/70">
                  → {showChannel}
                </span>
              )}
              <span title={absoluteTime} className="ml-auto shrink-0 text-[10px] text-text-muted/55">{relativeTime}</span>
            </div>
          )}

          {/* Message content with markdown */}
          <div className={`${isOutgoing ? 'whitespace-pre-wrap' : 'markdown-body'} wrap-break-word`}>
            {isOutgoing ? msg.content : <ChannelMarkdownContent content={msg.content} />}
          </div>

          {/* Status badge for failed/pending (only on incoming - outgoing shows in action row) */}
          {!isOutgoing && (msg.status === 'failed' || msg.status === 'pending') && (
            <div className="mt-2 pt-1.5 border-t border-border-subtle/50">
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${statusCls}`}>{statusLabel}</span>
              {msg.retryCount ? <span className="ml-2 text-[9px] text-text-muted/60">{t('channels.retryCount', 'Retries: {count}').replace('{count}', String(msg.retryCount))}</span> : null}
            </div>
          )}
        </div>

        {/* Actions row below bubble */}
        <div className={`mt-1.5 flex min-h-5 flex-wrap items-center gap-1.5 px-1 text-[9px] ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
          {isOutgoing && (
            <>
              <span className={`rounded px-1.5 py-0.5 text-[9px] ${statusCls}`}>{statusLabel}</span>
              {msg.retryCount ? <span className="rounded bg-surface-3 px-1.5 py-0.5 text-text-muted">{t('channels.retryCount', 'Retries: {count}').replace('{count}', String(msg.retryCount))}</span> : null}
              <span title={absoluteTime} className="text-text-muted/45">{relativeTime}</span>
            </>
          )}
          {msg.content && (
            <ChannelCopyButton text={msg.content} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </div>

      {/* Outgoing avatar */}
      {isOutgoing && (
        <div className="ml-3 mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-accent/10 bg-accent/15 text-[10px] font-semibold text-accent/80">
          {t('channels.botLabel', 'Bot')}
        </div>
      )}
    </div>
  )
}
