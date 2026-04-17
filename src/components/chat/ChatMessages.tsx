import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/store/appStore'
import type { Message, ToolCall, MessageAttachment } from '@/types'
import { IconifyIcon, ICON_DATA } from '@/components/icons/IconifyIcons'
import { isSpeechSynthesisAvailable, loadVoiceSettings, speak } from '@/services/voiceInteraction'
import { CopyButton, MarkdownContent } from './ChatMarkdown'
import { useI18n } from '@/hooks/useI18n'

// ─── Helpers ───────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const STATUS_CONFIG = {
  pending:   { icon: '○', label: 'Pending',  color: 'text-text-muted', bg: 'bg-surface-3',    border: 'border-border' },
  running:   { icon: '◌', label: 'Running',  color: 'text-accent',     bg: 'bg-accent/10',    border: 'border-accent/20' },
  completed: { icon: 'ui-check', label: 'Success',  color: 'text-success',    bg: 'bg-success/10',   border: 'border-success/20' },
  error:     { icon: 'ui-cross', label: 'Failed',   color: 'text-danger',     bg: 'bg-danger/10',    border: 'border-danger/20' },
} as const

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/** Detect result content type for rendering hints */
function detectResultType(output: string): 'json' | 'error' | 'path' | 'text' {
  const trimmed = output.trim()
  if (trimmed.startsWith('Error:') || trimmed.startsWith('Tool "') || trimmed.startsWith('[Custom tool error]') || trimmed.startsWith('Path blocked') || trimmed.startsWith('Command blocked'))
    return 'error'
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))
    return 'json'
  if (/^[A-Z]:\\|^\//.test(trimmed) && trimmed.split('\n').length <= 3)
    return 'path'
  return 'text'
}

/** Generate a compact preview for collapsed tool results */
function resultPreview(output: string, maxLen = 60): string {
  const trimmed = output.trim()
  const firstLine = trimmed.split('\n')[0]
  if (firstLine.length <= maxLen) return firstLine
  return firstLine.slice(0, maxLen) + '…'
}

/** Categorize tool errors for better display */
function categorizeError(output: string): { kind: 'permission' | 'timeout' | 'validation' | 'crash' | 'generic'; label: string } {
  const lower = output.toLowerCase()
  if (lower.includes('blocked by confirmation') || lower.includes('permission') || lower.includes('plan mode'))
    return { kind: 'permission', label: 'Permission Denied' }
  if (lower.includes('timeout') || lower.includes('timed out'))
    return { kind: 'timeout', label: 'Timeout' }
  if (lower.includes('validation') || lower.includes('invalid') || lower.includes('missing parameter'))
    return { kind: 'validation', label: 'Validation Error' }
  if (lower.includes('threw exception') || lower.includes('unexpected'))
    return { kind: 'crash', label: 'Runtime Error' }
  return { kind: 'generic', label: 'Error' }
}

const RESULT_TYPE_BADGE = {
  json:  { label: 'JSON', cls: 'bg-purple-500/10 text-purple-400' },
  error: { label: 'ERR',  cls: 'bg-danger/10 text-danger' },
  path:  { label: 'PATH', cls: 'bg-amber-500/10 text-amber-400' },
  text:  { label: 'TEXT', cls: 'bg-surface-3 text-text-muted' },
} as const

/** Max chars shown in UI for tool results (Claude Code uses 50 000 with disk persistence) */
const MAX_RESULT_DISPLAY = 10_000

// ─── Tool Call Row ─────────────────────────────────────────────────

function ToolCallRow({ call, stepLabel }: { call: ToolCall; stepLabel?: string }) {
  const [open, setOpen] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const cfg = STATUS_CONFIG[call.status]
  const resultType = call.output ? detectResultType(call.output) : null
  const typeBadge = resultType ? RESULT_TYPE_BADGE[resultType] : null
  const errorInfo = call.status === 'error' && call.output ? categorizeError(call.output) : null
  const truncatedOutput = call.output && call.output.length > MAX_RESULT_DISPLAY
    ? call.output.slice(0, MAX_RESULT_DISPLAY) + `\n\n... [${(call.output.length - MAX_RESULT_DISPLAY).toLocaleString()} characters truncated]`
    : call.output

  useEffect(() => {
    if (call.status !== 'running') {
      if (call.completedAt && call.startedAt) setElapsed(call.completedAt - call.startedAt)
      return
    }
    const tick = () => setElapsed(Date.now() - call.startedAt)
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [call.status, call.startedAt, call.completedAt])

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} text-[12px] transition-all duration-200 overflow-hidden`}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-2.5 px-4 py-3 hover:brightness-95 transition-all rounded-xl">
        <span className={`${cfg.color} text-[12px] shrink-0 leading-none ${call.status === 'running' ? 'animate-spin' : ''}`}>
          {cfg.icon in ICON_DATA ? <IconifyIcon name={cfg.icon} size={13} color="currentColor" /> : cfg.icon}
        </span>
        {stepLabel && <span className="text-[9px] text-text-muted/50 font-mono shrink-0">{stepLabel}</span>}
        <span className="font-semibold text-text-secondary truncate text-[11.5px]">{call.toolName}</span>
        {!open && call.output && call.status === 'completed' && (
          <span className="text-text-muted/40 truncate text-[10px] flex-1 text-left font-[JetBrains_Mono,monospace]">
            ⎿ {resultPreview(call.output)}
          </span>
        )}
        {!open && !call.output && call.input && (
          <span className="text-text-muted/50 truncate text-[10px] flex-1 text-left font-[JetBrains_Mono,monospace]">
            {Object.entries(call.input).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(', ').slice(0, 80)}
          </span>
        )}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {typeBadge && !open && (
            <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${typeBadge.cls}`}>{typeBadge.label}</span>
          )}
          {errorInfo && !open && (
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-danger/10 text-danger">{errorInfo.label}</span>
          )}
          <span className={`${cfg.color} text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md flex items-center gap-1`}>
            {cfg.label}
            {elapsed > 0 && <span className="opacity-50 normal-case font-medium">({formatDuration(elapsed)})</span>}
          </span>
        </div>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-text-muted/40 shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2 animate-fade-in">
          <div className="font-display text-[10px] text-text-muted/50 font-semibold uppercase tracking-wider mt-0.5">Arguments</div>
          <pre className="text-[11px] text-text-muted overflow-x-auto font-[JetBrains_Mono,monospace] bg-surface-0/30 rounded-lg px-3 py-2.5 max-h-40 overflow-y-auto border border-border-subtle/20">{JSON.stringify(call.input, null, 2)}</pre>
          {truncatedOutput && (<>
            <div className="flex items-center gap-2">
              <div className="font-display text-[10px] text-text-muted/50 font-semibold uppercase tracking-wider">Result</div>
              {typeBadge && <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${typeBadge.cls}`}>{typeBadge.label}</span>}
              {call.output && call.output.length > MAX_RESULT_DISPLAY && (
                <span className="text-[9px] text-text-muted/40">({(call.output.length / 1024).toFixed(1)} KB total)</span>
              )}
              {call.output && (
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      void navigator.clipboard.writeText(call.output ?? '')
                    }}
                    title="Copy full output to clipboard"
                    className="text-[9px] px-1.5 py-0.5 rounded-md bg-surface-3/60 text-text-muted hover:bg-accent/10 hover:text-accent transition-colors"
                  >
                    Copy
                  </button>
                  {call.output.length > MAX_RESULT_DISPLAY && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        try {
                          const blob = new Blob([call.output ?? ''], { type: 'text/plain;charset=utf-8' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `${call.toolName || 'tool-output'}-${call.id.slice(0, 8)}.txt`
                          document.body.appendChild(a)
                          a.click()
                          document.body.removeChild(a)
                          setTimeout(() => URL.revokeObjectURL(url), 1_000)
                        } catch { /* download may fail in some contexts */ }
                      }}
                      title="Download full output as .txt"
                      className="text-[9px] px-1.5 py-0.5 rounded-md bg-surface-3/60 text-text-muted hover:bg-accent/10 hover:text-accent transition-colors"
                    >
                      Download
                    </button>
                  )}
                </div>
              )}
            </div>
            <pre className={`text-[11px] ${call.status === 'error' ? 'text-danger' : 'text-success/80'} overflow-x-auto whitespace-pre-wrap font-[JetBrains_Mono,monospace] bg-surface-0/30 rounded-lg px-3 py-2.5 max-h-48 overflow-y-auto border border-border-subtle/20`}>{truncatedOutput}</pre>
          </>)}
        </div>
      )}
    </div>
  )
}

// ─── Error Handling ────────────────────────────────────────────────

type ErrorCategory =
  | 'auth'
  | 'permission'
  | 'rate-limit'
  | 'not-found'
  | 'server'
  | 'unavailable'
  | 'timeout'
  | 'network'
  | 'not-configured'
  | 'config'
  | 'unknown'

function classifyError(raw: string): ErrorCategory {
  const s = raw.toLowerCase()
  if (/\b401\b|unauthorized|invalid\s*api[_\- ]?key|\bauthentication\b/.test(s)) return 'auth'
  if (/\b403\b|\bforbidden\b|permission\s*denied/.test(s)) return 'permission'
  if (/\b429\b|rate\s*limit|too\s*many/.test(s)) return 'rate-limit'
  if (/\b404\b|not\s*found|model\b.*\b(?:exist|available)/.test(s)) return 'not-found'
  if (/\b500\b|internal\s*server/.test(s)) return 'server'
  if (/\b50[234]\b|bad\s*gateway|service\s*unavailable/.test(s)) return 'unavailable'
  if (/\btimeout\b|timed\s*out|econnaborted/.test(s)) return 'timeout'
  if (/\bnetwork\b|\bfetch\b|econnrefused|enotfound|dns/.test(s)) return 'network'
  if (/not\s*initialized|api\s*key/.test(s)) return 'not-configured'
  if (/configuration\s*error|missing/.test(s)) return 'config'
  return 'unknown'
}

function useFriendlyError(raw: string): { title: string; detail: string; hint: string } {
  const { t } = useI18n()
  const category = classifyError(raw)
  const truncated = raw.length > 120 ? raw.slice(0, 120) + '…' : raw

  switch (category) {
    case 'auth':
      return {
        title: t('chat.error.auth.title', 'Authentication Failed'),
        detail: t('chat.error.auth.detail', 'The API Key is invalid or expired.'),
        hint: t('chat.error.auth.hint', 'Check and update your API Key in Models settings.'),
      }
    case 'permission':
      return {
        title: t('chat.error.permission.title', 'Permission Denied'),
        detail: t('chat.error.permission.detail', 'The current API Key does not have permission to access this model.'),
        hint: t('chat.error.permission.hint', 'Verify API Key scopes or try a different model.'),
      }
    case 'rate-limit':
      return {
        title: t('chat.error.rateLimit.title', 'Rate Limit Exceeded'),
        detail: t('chat.error.rateLimit.detail', 'The API rate limit has been reached.'),
        hint: t('chat.error.rateLimit.hint', 'Wait a moment and retry, or upgrade your plan.'),
      }
    case 'not-found':
      return {
        title: t('chat.error.notFound.title', 'Model Not Found'),
        detail: t('chat.error.notFound.detail', 'The requested model ID is invalid or unavailable.'),
        hint: t('chat.error.notFound.hint', 'Verify the model name in Models settings.'),
      }
    case 'server':
      return {
        title: t('chat.error.server.title', 'Server Error'),
        detail: t('chat.error.server.detail', 'The AI provider returned an internal error.'),
        hint: t('chat.error.server.hint', 'This is usually temporary — please retry later.'),
      }
    case 'unavailable':
      return {
        title: t('chat.error.unavailable.title', 'Service Unavailable'),
        detail: t('chat.error.unavailable.detail', 'The AI service is temporarily unavailable.'),
        hint: t('chat.error.unavailable.hint', 'The provider may be under maintenance — retry later.'),
      }
    case 'timeout':
      return {
        title: t('chat.error.timeout.title', 'Request Timeout'),
        detail: t('chat.error.timeout.detail', 'The connection to the AI service timed out.'),
        hint: t('chat.error.timeout.hint', 'Check your network connection and retry.'),
      }
    case 'network':
      return {
        title: t('chat.error.network.title', 'Network Error'),
        detail: t('chat.error.network.detail', 'Unable to reach the AI service.'),
        hint: t('chat.error.network.hint', 'Check your network connection and proxy settings.'),
      }
    case 'not-configured':
      return {
        title: t('chat.error.notConfigured.title', 'Not Configured'),
        detail: t('chat.error.notConfigured.detail', 'The model API Key has not been set.'),
        hint: t('chat.error.notConfigured.hint', 'Configure the API Key in Models settings.'),
      }
    case 'config':
      return {
        title: t('chat.error.config.title', 'Configuration Error'),
        detail: truncated,
        hint: t('chat.error.config.hint', 'Check your model configuration in Models settings.'),
      }
    default:
      return {
        title: t('chat.error.unknown.title', 'Request Failed'),
        detail: truncated,
        hint: t('chat.error.unknown.hint', 'Please retry. If the problem persists, check your model configuration.'),
      }
  }
}

function ErrorBubble({ message, onRetry }: { message: Message; onRetry?: () => void }) {
  const error = useFriendlyError(message.content)
  const { t } = useI18n()
  const [showDetail, setShowDetail] = useState(false)

  return (
    <div className="flex justify-start mb-5 animate-fade-in">
      <div className="w-9 h-9 rounded-xl bg-danger/8 flex items-center justify-center text-danger text-[11px] mr-3 mt-0.5 shrink-0 font-semibold border border-danger/8">!</div>
      <div className="max-w-[84%] rounded-[20px] rounded-bl-sm border border-danger/15 bg-danger/4 px-5 py-4">
        <div className="flex items-center gap-2 mb-1.5"><span className="text-[14px] font-semibold text-danger">{error.title}</span></div>
        <p className="text-[14px] text-text-secondary leading-relaxed">{error.detail}</p>
        <p className="text-[12px] text-text-muted mt-2"><IconifyIcon name="ui-lightbulb" size={13} color="currentColor" className="inline-block" /> {error.hint}</p>
        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-danger/8">
          {onRetry && <button type="button" onClick={onRetry} className="text-[12px] px-3.5 py-2 rounded-xl bg-accent/10 text-accent hover:bg-accent/18 transition-colors font-medium">↻ {t('chat.retry', 'Retry')}</button>}
          <CopyButton text={message.content} className="text-[11px] px-3 py-2 rounded-xl text-text-muted hover:bg-surface-3/40 transition-colors" />
          <button type="button" onClick={() => setShowDetail((v) => !v)} className="text-[11px] px-3 py-2 rounded-xl text-text-muted hover:bg-surface-3/40 transition-colors">{showDetail ? t('chat.hideDetail', 'Hide detail') : t('chat.showDetail', 'Show detail')}</button>
        </div>
        {showDetail && <pre className="mt-2 text-[10px] text-text-muted bg-surface-0/40 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap font-[JetBrains_Mono,monospace] border border-border-subtle/30">{message.content}</pre>}
      </div>
    </div>
  )
}

// ─── Thinking Indicator ────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 text-text-muted text-[12px] py-2">
      <span className="flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-accent/70 animate-bounce" />
        <span className="w-1.5 h-1.5 rounded-full bg-accent/70 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-accent/70 animate-bounce [animation-delay:300ms]" />
      </span>
      <span className="text-text-secondary">Thinking…</span>
    </div>
  )
}

// ─── Image Lightbox ────────────────────────────────────────────────

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    closeRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} role="dialog" aria-label={`Image preview: ${alt}`}>
      <button type="button" ref={closeRef} onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/50" title="Close" aria-label="Close preview"><IconifyIcon name="ui-close" size={14} color="currentColor" /></button>
      <img src={src} alt={alt} className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
      <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs bg-black/50 px-3 py-1 rounded-full">{alt}</span>
    </div>
  )
}

// ─── Audio Player ──────────────────────────────────────────────────

function AudioPlayer({ data, mimeType, name }: { data: string; mimeType: string; name: string }) {
  const src = `data:${mimeType};base64,${data}`
  return (
    <div className="flex items-center gap-2.5 bg-surface-2/60 rounded-[14px] px-3.5 py-2.5 border border-border-subtle/60 max-w-80">
      <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-text-secondary truncate font-medium">{name}</div>
        <audio controls src={src} className="w-full min-w-0 h-8 mt-1" preload="metadata" />
      </div>
    </div>
  )
}

// ─── File Card ─────────────────────────────────────────────────────

function FileCard({ attachment }: { attachment: MessageAttachment }) {
  const [expanded, setExpanded] = useState(false)
  const ext = attachment.name.split('.').pop()?.toLowerCase() ?? ''
  const preview = attachment.data.length > 500 ? attachment.data.slice(0, 500) + '\n…' : attachment.data

  return (
    <div className="rounded-[14px] border border-border-subtle/70 bg-surface-2/40 max-w-90 overflow-hidden">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full flex items-center gap-3 px-3.5 py-3 hover:bg-surface-3/40 transition-colors text-left">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
          <span className="text-[12px] text-accent font-bold uppercase">{ext || <IconifyIcon name="ui-file" size={12} color="currentColor" />}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-text-primary font-medium truncate">{attachment.name}</div>
          <div className="text-[11px] text-text-muted">{formatFileSize(attachment.size)}</div>
        </div>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-text-muted/60 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      {expanded && (
        <div className="border-t border-border-subtle/60 px-3 py-2">
          <pre className="text-[11px] text-text-secondary font-[JetBrains_Mono,monospace] whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">{preview}</pre>
        </div>
      )}
    </div>
  )
}

// ─── Message Bubble ────────────────────────────────────────────────

export function MessageBubble({ message, onRetry, onDelete, onRegenerate, onFeedback }: { message: Message; onRetry?: () => void; onDelete?: () => void; onRegenerate?: () => void; onFeedback?: (feedback: 'positive' | 'negative' | undefined) => void }) {
  const isUser = message.role === 'user'
  const bubbleStyle = useAppStore((s) => s.bubbleStyle)
  const [lightboxSrc, setLightboxSrc] = useState<{ src: string; alt: string } | null>(null)

  if (message.isError) return <ErrorBubble message={message} onRetry={onRetry} />

  const showThinking = !isUser && message.isStreaming && !message.content && !message.toolCalls?.length
  const imageAttachments = message.attachments?.filter((a) => a.type === 'image') ?? []
  const fileAttachments = message.attachments?.filter((a) => a.type === 'file') ?? []
  const audioAttachments = message.attachments?.filter((a) => a.type === 'audio') ?? []

  const userBubbleCls = {
    default: 'user-bubble-gradient text-white rounded-[18px] rounded-br-sm whitespace-pre-wrap',
    minimal: 'bg-transparent text-text-primary rounded-[18px] rounded-br-sm border border-accent/15 whitespace-pre-wrap',
    bordered: 'bg-surface-1 text-text-primary rounded-[18px] rounded-br-sm border-2 border-accent/30 whitespace-pre-wrap',
    glassmorphism: 'bg-accent/12 backdrop-blur-md text-text-primary rounded-[18px] rounded-br-sm border border-accent/15 shadow-lg whitespace-pre-wrap',
  }[bubbleStyle]

  const aiBubbleCls = {
    default: 'bg-surface-2/40 text-text-primary rounded-[18px] rounded-bl-sm border border-border-subtle/50',
    minimal: 'bg-transparent text-text-primary rounded-[18px] rounded-bl-sm',
    bordered: 'bg-surface-1 text-text-primary rounded-[18px] rounded-bl-sm border-2 border-border-subtle',
    glassmorphism: 'bg-surface-2/25 backdrop-blur-md text-text-primary rounded-[18px] rounded-bl-sm border border-border-subtle/40 shadow-lg',
  }[bubbleStyle]

  const renderAttachments = () => {
    const hasAttachments = imageAttachments.length || fileAttachments.length || audioAttachments.length
    if (!hasAttachments) return null
    return (
      <div className="mt-2 flex flex-col gap-2">
        {imageAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {imageAttachments.map((att) => (
              <img key={att.id} src={`data:${att.mimeType};base64,${att.data}`} alt={att.name}
                className="max-w-50 max-h-50 rounded-lg border border-white/20 object-contain cursor-pointer hover:brightness-90 transition-all"
                onClick={() => setLightboxSrc({ src: `data:${att.mimeType};base64,${att.data}`, alt: att.name })}
                title={`${att.name} (${formatFileSize(att.size)}) — Click to preview`} />
            ))}
          </div>
        )}
        {audioAttachments.map((att) => <AudioPlayer key={att.id} data={att.data} mimeType={att.mimeType} name={att.name} />)}
        {fileAttachments.map((att) => <FileCard key={att.id} attachment={att} />)}
      </div>
    )
  }

  const contentParts = message.contentParts ?? []
  const toolCalls = message.toolCalls ?? []

  return (
    <>
      {lightboxSrc && <ImageLightbox src={lightboxSrc.src} alt={lightboxSrc.alt} onClose={() => setLightboxSrc(null)} />}
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6 animate-fade-in group`}>
        {!isUser && (
          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-accent/15 to-accent/5 flex items-center justify-center text-accent text-[11px] mr-3 mt-0.5 shrink-0 font-semibold border border-accent/8">AI</div>
        )}
        <div className="max-w-[84%] flex flex-col">
          <div className={`px-5.5 py-4 text-[15px] leading-[1.8] ${isUser ? userBubbleCls : aiBubbleCls}`}>
            {!isUser && (
              <div className="flex items-center gap-3 mb-2.5 pb-2 border-b border-border-subtle/30 min-w-52">
                <span className="font-display text-[10px] text-accent/60 font-semibold tracking-wider uppercase truncate">{message.modelUsed ?? 'Assistant'}</span>
                <span className="text-[10px] text-text-muted/40 shrink-0 ml-auto">{formatRelativeTime(message.timestamp)}</span>
              </div>
            )}
            {showThinking ? <ThinkingIndicator /> : isUser ? (<>{message.content}{renderAttachments()}</>) : contentParts.length > 0 ? (<>
              {(() => { const toolParts = contentParts.filter(p => p.type === 'tool-call'); const totalSteps = toolParts.length; let stepIdx = 0; return contentParts.map((part, idx) => {
                if (part.type === 'text') return <div key={idx} className="markdown-body"><MarkdownContent content={part.text} /></div>
                const call = toolCalls.find((t) => t.id === part.toolCallId)
                if (!call) return null
                const label = totalSteps > 1 ? `${++stepIdx}/${totalSteps}` : undefined
                return <div key={idx} className="my-2 space-y-1.5"><ToolCallRow call={call} stepLabel={label} /></div>
              })})()}
            </>) : (<>
              {message.content && <div className="markdown-body"><MarkdownContent content={message.content} /></div>}
              {toolCalls.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-border-subtle/40 pt-3">
                  <div className="font-display text-[10px] text-text-muted/60 font-semibold uppercase tracking-wider mb-1">Tool Calls</div>
                  {toolCalls.map((call, i) => <ToolCallRow key={call.id} call={call} stepLabel={toolCalls.length > 1 ? `${i + 1}/${toolCalls.length}` : undefined} />)}
                </div>
              )}
            </>)}
            {!isUser && message.isStreaming && message.content && <span className="inline-block w-1.25 h-3.5 ml-1 bg-accent rounded-sm animate-pulse-soft align-middle" />}
            {!isUser && !message.isStreaming && message.tokenUsage && (
              <div className="mt-3 pt-2.5 border-t border-border-subtle/30">
                <span className="text-[10px] text-text-muted/40 font-medium">Tokens: {message.tokenUsage.promptTokens} in / {message.tokenUsage.completionTokens} out / {message.tokenUsage.totalTokens} total</span>
              </div>
            )}
          </div>
          <div className={`flex items-center mt-1 gap-1 px-1 text-[11px] h-8 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {isUser && <span className="text-text-muted/30 text-[10px]">{formatRelativeTime(message.timestamp)}</span>}
            {!isUser && message.content && !message.isStreaming && (<>
              <CopyButton text={message.content} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              {onRegenerate && <button type="button" onClick={onRegenerate} title="Regenerate" className="text-[11px] px-2 py-1 rounded-md text-text-muted/60 hover:text-accent hover:bg-accent/8 opacity-0 group-hover:opacity-100 transition-all">↻</button>}
              {isSpeechSynthesisAvailable() && <button type="button" onClick={() => speak(message.content, loadVoiceSettings()).catch(() => {})} title="Read aloud" className="text-[11px] px-2 py-1 rounded-md text-text-muted/60 hover:text-text-secondary hover:bg-surface-3/40 opacity-0 group-hover:opacity-100 transition-all"><IconifyIcon name="ui-speaker" size={15} color="currentColor" /></button>}
            </>)}
            {!isUser && !message.isStreaming && onFeedback && (<>
              <button type="button" onClick={() => onFeedback(message.feedback === 'positive' ? undefined : 'positive')} title="Good response" className={`text-[11px] px-2 py-1 rounded-md transition-all ${message.feedback === 'positive' ? 'text-success opacity-100' : 'text-text-muted/60 hover:text-success hover:bg-success/8 opacity-0 group-hover:opacity-100'}`}><IconifyIcon name="ui-thumbs-up" size={15} color="currentColor" /></button>
              <button type="button" onClick={() => onFeedback(message.feedback === 'negative' ? undefined : 'negative')} title="Bad response" className={`text-[11px] px-2 py-1 rounded-md transition-all ${message.feedback === 'negative' ? 'text-danger opacity-100' : 'text-text-muted/60 hover:text-danger hover:bg-danger/8 opacity-0 group-hover:opacity-100'}`}><IconifyIcon name="ui-thumbs-down" size={15} color="currentColor" /></button>
            </>)}
            {onDelete && !message.isStreaming && <button type="button" onClick={onDelete} title="Delete message" className="text-[11px] px-2 py-1 rounded-md text-text-muted/60 hover:text-danger hover:bg-danger/8 opacity-0 group-hover:opacity-100 transition-all"><IconifyIcon name="ui-trash" size={15} color="currentColor" /></button>}
          </div>
        </div>
        {isUser && <div className="w-9 h-9 rounded-xl bg-accent/12 flex items-center justify-center text-[11px] ml-3 mt-0.5 shrink-0 font-semibold text-accent/70 border border-accent/8">You</div>}
      </div>
    </>
  )
}
