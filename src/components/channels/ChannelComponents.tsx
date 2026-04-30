import { useState, type ComponentPropsWithoutRef } from 'react'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { ChannelPlatformIcon } from './ChannelIcons'
import type { ChannelHistoryMessage, ChannelMessageDirection } from '@/types'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ─── Channel Copy Button ───────────────────────────────────────────

export function ChannelCopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => { /* clipboard access denied */ })
  }
  return (
    <button onClick={copy} title="Copy" className={`text-[11px] px-1.5 py-0.5 rounded-md transition-colors inline-flex items-center gap-1 ${copied ? 'text-success' : 'text-text-muted hover:text-text-secondary hover:bg-surface-3/60'} ${className}`}>
      {copied ? <><IconifyIcon name="ui-check" size={12} color="currentColor" /> Copied</> : <><IconifyIcon name="ui-copy" size={12} color="currentColor" /> Copy</>}
    </button>
  )
}

// ─── Channel Code Block ────────────────────────────────────────────

function ChannelCodeBlock({ children, className, ...rest }: ComponentPropsWithoutRef<'code'>) {
  const isInline = !className
  const code = String(children).replace(/\n$/, '')
  const lang = className?.replace('language-', '') ?? ''

  if (isInline) {
    return <code className="rounded-md border border-border-subtle/40 bg-surface-3/80 px-1.5 py-0.5 font-[JetBrains_Mono,monospace] text-[11.5px] text-accent" {...rest}>{children}</code>
  }

  return (
    <div className="relative group/code my-3 rounded-xl overflow-hidden border border-border-subtle/80 bg-surface-0/60 shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-2/40 border-b border-border-subtle/60">
        <span className="text-[10px] text-text-muted/70 uppercase tracking-wider font-semibold">{lang || 'code'}</span>
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

export function formatChannelRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function normalizeChannelDirection(direction?: string): ChannelMessageDirection {
  const normalized = direction?.trim().toLowerCase()
  if (normalized === 'outgoing' || normalized === 'send' || normalized === 'sent') return 'outgoing'
  return 'incoming'
}

// ─── Channel Message Bubble ────────────────────────────────────────

export function ChannelMessageBubble({ msg, showChannel }: { msg: ChannelHistoryMessage; showChannel?: string }) {
  const isOutgoing = normalizeChannelDirection(msg.direction) === 'outgoing'

  const incomingBubbleCls = 'bg-surface-2/60 text-text-primary rounded-2xl rounded-bl-sm border border-border/60 shadow-sm'
  const outgoingBubbleCls = 'bg-gradient-to-br from-accent to-accent-hover text-white rounded-2xl rounded-br-sm shadow-[0_2px_12px_rgba(var(--t-accent-rgb),0.20)]'

  const statusCls =
    msg.status === 'sent' ? 'bg-green-500/15 text-green-400' :
    msg.status === 'failed' ? 'bg-red-500/15 text-red-400' :
    msg.status === 'pending' ? 'bg-yellow-500/15 text-yellow-400' :
    'bg-surface-3 text-text-muted'

  return (
    <div className={`group mb-4 flex animate-fade-in ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      {/* Incoming avatar */}
      {!isOutgoing && (
        <div className="mr-3 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-accent/10 bg-linear-to-br from-accent/20 to-accent/5 shadow-sm">
          <ChannelPlatformIcon platform={msg.platform} size={16} />
        </div>
      )}

      <div className="flex max-w-[78%] flex-col">
        <div className={`px-3.5 py-2.5 text-[12px] leading-6 ${isOutgoing ? outgoingBubbleCls : incomingBubbleCls}`}>
          {/* Header: sender info, channel, time */}
          {!isOutgoing && (
            <div className="mb-2 flex min-w-45 items-center gap-2.5 border-b border-border-subtle/50 pb-1.5">
              <span className="truncate text-[9px] font-semibold uppercase tracking-wide text-accent/70">
                {msg.senderName || msg.senderId}
              </span>
              {showChannel && (
                <span className="truncate text-[9px] text-text-muted/60">
                  → {showChannel}
                </span>
              )}
              <span className="ml-auto shrink-0 text-[9px] text-text-muted/50">{formatChannelRelativeTime(msg.timestamp)}</span>
            </div>
          )}

          {/* Message content with markdown */}
          <div className={isOutgoing ? 'whitespace-pre-wrap' : 'markdown-body'}>
            {isOutgoing ? msg.content : <ChannelMarkdownContent content={msg.content} />}
          </div>

          {/* Status badge for failed/pending (only on incoming - outgoing shows in action row) */}
          {!isOutgoing && (msg.status === 'failed' || msg.status === 'pending') && (
            <div className="mt-2 pt-1.5 border-t border-border-subtle/50">
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${statusCls}`}>{msg.status}</span>
            </div>
          )}
        </div>

        {/* Actions row below bubble */}
        <div className={`mt-1 flex h-5 items-center gap-1 px-1 text-[9px] ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
          {isOutgoing && (
            <>
              <span className={`rounded px-1.5 py-0.5 text-[9px] ${statusCls}`}>{msg.status}</span>
              <span className="text-text-muted/40">{formatChannelRelativeTime(msg.timestamp)}</span>
            </>
          )}
          {msg.content && (
            <ChannelCopyButton text={msg.content} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </div>

      {/* Outgoing avatar */}
      {isOutgoing && (
        <div className="w-8 h-8 rounded-xl bg-accent/15 flex items-center justify-center text-[11px] ml-3 mt-0.5 shrink-0 font-semibold text-accent/80 border border-accent/10">
          Bot
        </div>
      )}
    </div>
  )
}
