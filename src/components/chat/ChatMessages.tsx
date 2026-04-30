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

function formatRelativeTime(ts: number, locale = 'en'): string {
  const diffSeconds = Math.round((ts - Date.now()) / 1000)
  const absSeconds = Math.abs(diffSeconds)
  const relativeFormatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (absSeconds < 45) return relativeFormatter.format(0, 'second')
  if (absSeconds < 3600) return relativeFormatter.format(Math.round(diffSeconds / 60), 'minute')
  if (absSeconds < 86400) return relativeFormatter.format(Math.round(diffSeconds / 3600), 'hour')
  if (absSeconds < 604800) return relativeFormatter.format(Math.round(diffSeconds / 86400), 'day')

  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(ts)
}

const STATUS_CONFIG = {
  pending:   { icon: '○', label: 'Pending', color: 'text-text-muted', bg: 'bg-surface-2/65', border: 'border-border-subtle/55' },
  running:   { icon: '◌', label: 'Running', color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/18' },
  completed: { icon: 'ui-check', label: 'Success', color: 'text-success', bg: 'bg-success/10', border: 'border-success/18' },
  error:     { icon: 'ui-cross', label: 'Failed', color: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/18' },
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
  json:  { label: 'JSON', cls: 'border border-sky-500/18 bg-sky-500/10 text-sky-400' },
  error: { label: 'ERR', cls: 'border border-danger/18 bg-danger/10 text-danger' },
  path:  { label: 'PATH', cls: 'border border-amber-500/18 bg-amber-500/10 text-amber-400' },
  text:  { label: 'TEXT', cls: 'border border-border-subtle/55 bg-surface-2/75 text-text-muted' },
} as const

/** Max chars shown in UI for tool results (Claude Code uses 50 000 with disk persistence) */
const MAX_RESULT_DISPLAY = 10_000

// ─── Tool Call Row ─────────────────────────────────────────────────

function ToolCallRow({ call, stepLabel }: { call: ToolCall; stepLabel?: string }) {
  const [open, setOpen] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const cfg = STATUS_CONFIG[call.status]
  const displayOutput = call.outputEnvelope?.dataPreview ?? call.output
  const resultType = displayOutput ? detectResultType(displayOutput) : null
  const typeBadge = resultType ? RESULT_TYPE_BADGE[resultType] : null
  const errorInfo = call.status === 'error' && displayOutput ? categorizeError(displayOutput) : null
  const truncatedOutput = displayOutput && displayOutput.length > MAX_RESULT_DISPLAY
    ? displayOutput.slice(0, MAX_RESULT_DISPLAY) + `\n\n... [${(displayOutput.length - MAX_RESULT_DISPLAY).toLocaleString()} characters truncated]`
    : displayOutput

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

  const collapsedSummary = (() => {
    if (call.outputEnvelope?.summary) return call.outputEnvelope.summary
    if (call.output && call.status === 'completed') return resultPreview(call.output)
    if (!call.output && call.status === 'completed') return 'Completed with no explicit output'
    if (call.status === 'pending') return 'Waiting for execution'
    if (call.input && call.status !== 'completed') {
      return Object.entries(call.input)
        .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
        .join(', ')
        .slice(0, 96)
    }
    return ''
  })()

  return (
    <div className={`overflow-hidden rounded-[22px] border ${cfg.border} ${cfg.bg} text-[12px] shadow-sm transition-all duration-200`}>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-black/5">
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border ${cfg.border} ${cfg.bg} ${cfg.color}`}>
          <span className={`text-[12px] leading-none ${call.status === 'running' ? 'animate-spin' : ''}`}>
            {cfg.icon in ICON_DATA ? <IconifyIcon name={cfg.icon} size={13} color="currentColor" /> : cfg.icon}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {stepLabel && <span className="rounded-full border border-border-subtle/50 bg-surface-0/55 px-2 py-0.5 font-mono text-[9px] text-text-muted/62">{stepLabel}</span>}
            <span className="truncate text-[12.5px] font-semibold text-text-primary">{call.toolName}</span>
            {typeBadge && !open && <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] ${typeBadge.cls}`}>{typeBadge.label}</span>}
            {errorInfo && !open && <span className="rounded-full border border-danger/18 bg-danger/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-danger">{errorInfo.label}</span>}
          </div>
          {collapsedSummary && (
            <div className="mt-1 truncate text-[11px] leading-5 text-text-muted/76 font-[JetBrains_Mono,monospace]">
              {collapsedSummary}
            </div>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${cfg.border} ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
          {elapsed > 0 && <span className="text-[10px] text-text-muted/58">{formatDuration(elapsed)}</span>}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-text-muted/40 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-border-subtle/45 bg-surface-0/34 px-4 pb-4 pt-3 space-y-3 animate-fade-in">
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/45">Arguments</div>
            <pre className="max-h-40 overflow-auto rounded-2xl border border-border-subtle/45 bg-surface-0/68 px-3 py-2.5 text-[11px] text-text-muted font-[JetBrains_Mono,monospace]">{JSON.stringify(call.input, null, 2)}</pre>
          </div>

          {truncatedOutput && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/45">Result</div>
                {typeBadge && <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] ${typeBadge.cls}`}>{typeBadge.label}</span>}
                {call.outputEnvelope?.storedExternally && <span className="rounded-full border border-amber-500/18 bg-amber-500/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-amber-400">REF</span>}
                {call.outputEnvelope?.outputChars !== undefined && (
                  <span className="text-[10px] text-text-muted/45">{call.outputEnvelope.outputChars.toLocaleString()} chars</span>
                )}
                {call.output && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void navigator.clipboard.writeText(call.output ?? '')
                      }}
                      title="Copy full output to clipboard"
                      className="rounded-full border border-border-subtle/50 bg-surface-0/55 px-2.5 py-1 text-[10px] font-medium text-text-muted transition-colors hover:border-accent/18 hover:bg-accent/10 hover:text-accent"
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
                          } catch {
                            // Download may fail in restricted environments.
                          }
                        }}
                        title="Download full output as .txt"
                        className="rounded-full border border-border-subtle/50 bg-surface-0/55 px-2.5 py-1 text-[10px] font-medium text-text-muted transition-colors hover:border-accent/18 hover:bg-accent/10 hover:text-accent"
                      >
                        Download
                      </button>
                    )}
                  </div>
                )}
              </div>
              {call.outputEnvelope?.dataRef && (
                <div className="mb-2 rounded-2xl border border-border-subtle/45 bg-surface-2/60 px-3 py-2 text-[11px] text-text-muted">
                  Full output: {call.outputEnvelope.dataRef}
                </div>
              )}
              {call.outputEnvelope?.warnings?.length ? (
                <div className="mb-2 rounded-2xl border border-warning/20 bg-warning/10 px-3 py-2 text-[11px] text-warning">
                  {call.outputEnvelope.warnings.join(' ')}
                </div>
              ) : null}
              <pre className={`max-h-56 overflow-auto whitespace-pre-wrap rounded-2xl border border-border-subtle/45 bg-surface-0/68 px-3 py-2.5 text-[11px] font-[JetBrains_Mono,monospace] ${call.status === 'error' ? 'text-danger' : 'text-success/82'}`}>{truncatedOutput}</pre>
            </div>
          )}
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
    <div className="mb-4 flex justify-start animate-fade-in">
      <div className="w-full max-w-[52rem] rounded-md border border-danger/18 bg-danger/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-danger/10 text-[13px] font-semibold text-danger">!</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-semibold text-danger">{error.title}</span>
              <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger">{t('chat.requestFailed', 'Request failed')}</span>
            </div>
            <p className="mt-1.5 text-[13px] leading-6 text-text-secondary">{error.detail}</p>
            <p className="mt-2 text-[12px] leading-5 text-text-muted"><IconifyIcon name="ui-lightbulb" size={13} color="currentColor" className="inline-block" /> {error.hint}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-danger/10 pt-3">
              {onRetry && <button type="button" onClick={onRetry} className="rounded-md bg-accent/10 px-3 py-1.5 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/16">↻ {t('chat.retry', 'Retry')}</button>}
              <CopyButton text={message.content} className="rounded-md bg-surface-0/45 px-2.5 py-1.5 text-[11px] text-text-muted transition-colors hover:bg-accent/10 hover:text-accent" />
              <button type="button" onClick={() => setShowDetail((value) => !value)} className="rounded-md bg-surface-0/45 px-2.5 py-1.5 text-[11px] text-text-muted transition-colors hover:bg-surface-3/45 hover:text-text-secondary">{showDetail ? t('chat.hideDetail', 'Hide detail') : t('chat.showDetail', 'Show detail')}</button>
            </div>

            {showDetail && <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-md border border-border-subtle/35 bg-surface-0/45 p-3 text-[10px] text-text-muted font-[JetBrains_Mono,monospace]">{message.content}</pre>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Thinking Indicator ────────────────────────────────────────────

function ThinkingIndicator() {
  const { t } = useI18n()

  return (
    <div className="space-y-4 py-1">
      <div className="inline-flex items-center gap-2 rounded-full border border-accent/18 bg-accent/8 px-3 py-1.5 text-[11px] text-text-secondary">
        <span className="flex gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-accent/70 animate-bounce" />
          <span className="h-1.5 w-1.5 rounded-full bg-accent/70 animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-accent/70 animate-bounce [animation-delay:300ms]" />
        </span>
        <span>{t('chat.thinking', 'Thinking…')}</span>
      </div>
      <div className="space-y-2.5 animate-pulse">
        <div className="h-3 w-[86%] rounded-full bg-surface-3/55" />
        <div className="h-3 w-[68%] rounded-full bg-surface-3/45" />
        <div className="h-3 w-[46%] rounded-full bg-surface-3/35" />
      </div>
    </div>
  )
}

// ─── Image Lightbox ────────────────────────────────────────────────

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const { t } = useI18n()
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    closeRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label={`${t('chat.imagePreview', 'Image preview')}: ${alt}`}
    >
      <button
        type="button"
        ref={closeRef}
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
        title={t('chat.closePreview', 'Close preview')}
        aria-label={t('chat.closePreview', 'Close preview')}
      >
        <IconifyIcon name="ui-close" size={14} color="currentColor" />
      </button>
      <figure className="flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" />
        <figcaption className="text-white/70 text-xs bg-black/50 px-3 py-1 rounded-full">{alt}</figcaption>
      </figure>
    </div>
  )
}

// ─── Audio Player ──────────────────────────────────────────────────

function AudioPlayer({ data, mimeType, name }: { data: string; mimeType: string; name: string }) {
  const src = `data:${mimeType};base64,${data}`
  return (
    <div className="flex max-w-md items-center gap-3 rounded-[22px] border border-border-subtle/55 bg-surface-0/72 px-3.5 py-3 shadow-sm">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-accent/18 bg-accent/10 text-accent">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate text-[12px] font-semibold text-text-primary">{name}</div>
        <audio controls src={src} className="mt-1 h-8 w-full min-w-0" preload="metadata" />
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
    <div className="max-w-[24rem] overflow-hidden rounded-[22px] border border-border-subtle/55 bg-surface-0/72 shadow-sm">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-2/55">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-accent/18 bg-accent/10 text-accent">
          <span className="text-[12px] text-accent font-bold uppercase">{ext || <IconifyIcon name="ui-file" size={12} color="currentColor" />}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate text-[13px] font-semibold text-text-primary">{attachment.name}</div>
          <div className="text-[11px] text-text-muted">{formatFileSize(attachment.size)}</div>
        </div>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-text-muted/60 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      {expanded && (
        <div className="border-t border-border-subtle/50 bg-surface-2/50 px-3 py-2.5">
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-[14px] bg-surface-0/48 px-3 py-2 text-[11px] leading-relaxed text-text-secondary font-[JetBrains_Mono,monospace]">{preview}</pre>
        </div>
      )}
    </div>
  )
}

// ─── Message Bubble ────────────────────────────────────────────────

export function MessageBubble({
  message,
  onRetry,
  onDelete,
  onRegenerate,
  onFeedback,
  onEdit,
  onTogglePin,
  onBranch,
}: {
  message: Message
  onRetry?: () => void
  onDelete?: () => void
  onRegenerate?: () => void
  onFeedback?: (feedback: 'positive' | 'negative' | undefined) => void
  onEdit?: (content: string) => void
  onTogglePin?: () => void
  onBranch?: () => void
}) {
  const { t, locale } = useI18n()
  const isUser = message.role === 'user'
  const bubbleStyle = useAppStore((s) => s.bubbleStyle)
  const [lightboxSrc, setLightboxSrc] = useState<{ src: string; alt: string } | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)

  if (message.isError) return <ErrorBubble message={message} onRetry={onRetry} />

  const showThinking = !isUser && message.isStreaming && !message.content && !message.toolCalls?.length
  const imageAttachments = message.attachments?.filter((a) => a.type === 'image') ?? []
  const fileAttachments = message.attachments?.filter((a) => a.type === 'file') ?? []
  const audioAttachments = message.attachments?.filter((a) => a.type === 'audio') ?? []

  const userBubbleCls = {
    default: 'border border-accent/24 bg-accent/12 text-text-primary shadow-sm',
    minimal: 'border border-accent/14 bg-accent/6 text-text-primary',
    bordered: 'border-2 border-accent/24 bg-surface-0/82 text-text-primary',
    glassmorphism: 'border border-accent/18 bg-white/10 text-text-primary backdrop-blur-xl shadow-lg',
  }[bubbleStyle]

  const aiBubbleCls = {
    default: 'border border-border-subtle/55 bg-surface-1/74 text-text-primary shadow-sm',
    minimal: 'border border-transparent bg-transparent text-text-primary',
    bordered: 'border-2 border-border-subtle/60 bg-surface-0/76 text-text-primary',
    glassmorphism: 'border border-border-subtle/45 bg-surface-0/58 text-text-primary backdrop-blur-xl shadow-lg',
  }[bubbleStyle]

  const renderAttachments = () => {
    const hasAttachments = imageAttachments.length || fileAttachments.length || audioAttachments.length
    if (!hasAttachments) return null
    return (
      <div className="mt-4 flex flex-col gap-3">
        {imageAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {imageAttachments.map((att) => (
              <img key={att.id} src={`data:${att.mimeType};base64,${att.data}`} alt={att.name} width={200} height={200}
                className="max-h-56 max-w-56 cursor-pointer rounded-[20px] border border-border-subtle/55 object-contain shadow-sm transition-all hover:brightness-95"
                onClick={() => setLightboxSrc({ src: `data:${att.mimeType};base64,${att.data}`, alt: att.name })}
                title={`${att.name} (${formatFileSize(att.size)}) — ${t('chat.openPreview', 'Open preview')}`} />
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

  const assistantBody = contentParts.length > 0
    ? (() => {
      const toolParts = contentParts.filter((part) => part.type === 'tool-call')
      const totalSteps = toolParts.length
      let stepIndex = 0

      return contentParts.map((part, index) => {
        if (part.type === 'text') {
          return <div key={index} className="markdown-body"><MarkdownContent content={part.text} /></div>
        }

        const call = toolCalls.find((toolCall) => toolCall.id === part.toolCallId)
        if (!call) return null
        const label = totalSteps > 1 ? `${++stepIndex}/${totalSteps}` : undefined

        return (
          <div key={index} className="my-3">
            <ToolCallRow call={call} stepLabel={label} />
          </div>
        )
      })
    })()
    : (
      <>
        {message.content && <div className="markdown-body"><MarkdownContent content={message.content} /></div>}
        {toolCalls.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-border-subtle/45 pt-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/45">{t('chat.toolCalls', 'Tool Calls')}</div>
            {toolCalls.map((call, index) => (
              <ToolCallRow
                key={call.id}
                call={call}
                stepLabel={toolCalls.length > 1 ? `${index + 1}/${toolCalls.length}` : undefined}
              />
            ))}
          </div>
        )}
      </>
    )

  return (
    <>
      {lightboxSrc && <ImageLightbox src={lightboxSrc.src} alt={lightboxSrc.alt} onClose={() => setLightboxSrc(null)} />}
      <div className={`group mb-5 flex items-start gap-3 animate-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-subtle/45 bg-surface-0/72 text-accent shadow-sm"><IconifyIcon name="ui-sparkles" size={15} color="currentColor" /></div>
        )}
        <div className="max-w-[90%] min-w-0 sm:max-w-[84%]">
          <div className={`relative overflow-hidden rounded-2xl ${isUser ? userBubbleCls : aiBubbleCls}`}>
            <div className="relative z-10 px-4 py-3.5 sm:px-5">
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${isUser ? 'border-accent/18 bg-accent/10 text-accent' : 'border-border-subtle/50 bg-surface-2/70 text-text-muted/72'}`}>
                  {isUser ? t('chat.you', 'You') : message.modelUsed ?? t('chat.assistant', 'Assistant')}
                </span>
                <span className="text-[10px] text-text-muted/48">{formatRelativeTime(message.timestamp, locale)}</span>
              </div>

              {showThinking ? (
                <ThinkingIndicator />
              ) : isUser ? (
                <div className="space-y-3 text-[14.5px] leading-7">
                  {editing ? (
                    <div className="space-y-2">
                      <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        className="min-h-28 w-full resize-y rounded-2xl border border-accent/20 bg-surface-0/80 px-3 py-2 text-[13px] leading-6 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                      />
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => { setDraft(message.content); setEditing(false) }} className="rounded-full border border-border-subtle/50 px-3 py-1 text-[11px] text-text-muted">{t('common.cancel', 'Cancel')}</button>
                        <button type="button" onClick={() => { onEdit?.(draft); setEditing(false) }} className="rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-white">{t('common.save', 'Save')}</button>
                      </div>
                    </div>
                  ) : (
                    message.content && <div className="whitespace-pre-wrap">{message.content}</div>
                  )}
                  {renderAttachments()}
                </div>
              ) : (
                <div className="space-y-3 text-[14.5px] leading-7">
                  {assistantBody}
                  {renderAttachments()}
                </div>
              )}

              {!isUser && message.isStreaming && message.content && <span className="mt-1 inline-block h-3.5 w-1.5 rounded-sm bg-accent align-middle animate-pulse-soft" />}

              {!isUser && !message.isStreaming && message.tokenUsage && (
                <div className="mt-4 border-t border-border-subtle/45 pt-3">
                  <span className="text-[10px] font-medium text-text-muted/42">{t('chat.tokens', 'Tokens')}: {message.tokenUsage.promptTokens} in / {message.tokenUsage.completionTokens} out / {message.tokenUsage.totalTokens} total</span>
                </div>
              )}
              {!isUser && !message.isStreaming && message.runtime && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border-subtle/45 pt-3 text-[10px] text-text-muted/50">
                  <span className="rounded-full bg-surface-2/70 px-2 py-0.5">run {message.runtime.runId}</span>
                  {message.runtime.agentName && <span className="rounded-full bg-surface-2/70 px-2 py-0.5">{message.runtime.agentName}</span>}
                  {message.runtime.toolNames?.length ? <span className="rounded-full bg-surface-2/70 px-2 py-0.5">{message.runtime.toolNames.length} tools</span> : null}
                  {message.contextSummary && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-300">context pruned</span>}
                </div>
              )}
              {message.citations?.length ? (
                <div className="mt-3 space-y-2 border-t border-border-subtle/45 pt-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/45">{t('chat.sources', 'Sources')}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {message.citations.map((citation) => (
                      <a
                        key={citation.id}
                        href={citation.uri || undefined}
                        target={citation.uri?.startsWith('http') ? '_blank' : undefined}
                        rel="noreferrer"
                        className="rounded-2xl border border-border-subtle/50 bg-surface-0/55 px-3 py-2 text-[11px] text-text-secondary hover:border-accent/18 hover:bg-accent/8"
                      >
                        <span className="block font-semibold text-text-primary">{citation.title}</span>
                        <span className="mt-1 block line-clamp-2 text-text-muted">{citation.snippet || citation.kind}</span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className={`mt-2 flex min-h-8 flex-wrap items-center gap-1.5 px-1 text-[11px] opacity-80 transition-opacity group-hover:opacity-100 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {isUser && message.content && !message.isStreaming && (
              <>
                <CopyButton text={message.content} className="rounded-full border border-border-subtle/50 bg-surface-0/55 px-3 py-1.5 text-[11px] text-text-muted transition-colors hover:border-accent/18 hover:bg-accent/10 hover:text-accent" />
                {onEdit && <button type="button" onClick={() => setEditing(true)} title={t('common.edit', 'Edit')} aria-label={t('common.edit', 'Edit')} className="rounded-full border border-border-subtle/50 bg-surface-0/55 px-3 py-1.5 text-[11px] text-text-muted transition-colors hover:border-accent/18 hover:bg-accent/10 hover:text-accent">✎</button>}
              </>
            )}
            {onTogglePin && !message.isStreaming && <button type="button" onClick={onTogglePin} title={message.pinned ? t('chat.unpinMessage', 'Unpin message') : t('chat.pinMessage', 'Pin message')} aria-label={message.pinned ? t('chat.unpinMessage', 'Unpin message') : t('chat.pinMessage', 'Pin message')} className={`rounded-full border px-3 py-1.5 text-[11px] transition-colors ${message.pinned ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-border-subtle/50 bg-surface-0/55 text-text-muted hover:border-amber-500/20 hover:bg-amber-500/10 hover:text-amber-300'}`}>★</button>}
            {onBranch && !message.isStreaming && <button type="button" onClick={onBranch} title={t('chat.branchConversation', 'Branch conversation')} aria-label={t('chat.branchConversation', 'Branch conversation')} className="rounded-full border border-border-subtle/50 bg-surface-0/55 px-3 py-1.5 text-[11px] text-text-muted transition-colors hover:border-accent/18 hover:bg-accent/10 hover:text-accent">⑂</button>}
            {!isUser && message.content && !message.isStreaming && (
              <>
                <CopyButton text={message.content} className="rounded-full border border-border-subtle/50 bg-surface-0/55 px-3 py-1.5 text-[11px] text-text-muted transition-colors hover:border-accent/18 hover:bg-accent/10 hover:text-accent" />
                {onRegenerate && <button type="button" onClick={onRegenerate} title={t('chat.regenerate', 'Regenerate')} aria-label={t('chat.regenerate', 'Regenerate')} className="rounded-full border border-border-subtle/50 bg-surface-0/55 px-3 py-1.5 text-[11px] text-text-muted transition-colors hover:border-accent/18 hover:bg-accent/10 hover:text-accent">↻</button>}
                {isSpeechSynthesisAvailable() && <button type="button" onClick={() => speak(message.content, loadVoiceSettings()).catch(() => {})} title={t('chat.readAloud', 'Read aloud')} aria-label={t('chat.readAloud', 'Read aloud')} className="flex h-8 w-8 items-center justify-center rounded-full border border-border-subtle/50 bg-surface-0/55 text-text-muted transition-colors hover:border-border hover:bg-surface-2/70 hover:text-text-secondary"><IconifyIcon name="ui-speaker" size={15} color="currentColor" /></button>}
              </>
            )}

            {!isUser && !message.isStreaming && onFeedback && (
              <>
                <button type="button" onClick={() => onFeedback(message.feedback === 'positive' ? undefined : 'positive')} title={t('chat.goodResponse', 'Good response')} aria-label={t('chat.goodResponse', 'Good response')} className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${message.feedback === 'positive' ? 'border-success/18 bg-success/10 text-success' : 'border-border-subtle/50 bg-surface-0/55 text-text-muted hover:border-success/18 hover:bg-success/10 hover:text-success'}`}><IconifyIcon name="ui-thumbs-up" size={15} color="currentColor" /></button>
                <button type="button" onClick={() => onFeedback(message.feedback === 'negative' ? undefined : 'negative')} title={t('chat.badResponse', 'Bad response')} aria-label={t('chat.badResponse', 'Bad response')} className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${message.feedback === 'negative' ? 'border-danger/18 bg-danger/10 text-danger' : 'border-border-subtle/50 bg-surface-0/55 text-text-muted hover:border-danger/18 hover:bg-danger/10 hover:text-danger'}`}><IconifyIcon name="ui-thumbs-down" size={15} color="currentColor" /></button>
              </>
            )}

            {onDelete && !message.isStreaming && <button type="button" onClick={onDelete} title={t('chat.deleteMessage', 'Delete message')} aria-label={t('chat.deleteMessage', 'Delete message')} className="flex h-8 w-8 items-center justify-center rounded-full border border-border-subtle/50 bg-surface-0/55 text-text-muted transition-colors hover:border-danger/18 hover:bg-danger/10 hover:text-danger"><IconifyIcon name="ui-trash" size={15} color="currentColor" /></button>}
          </div>
        </div>

        {isUser && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/16 bg-accent/10 text-accent/76 shadow-sm"><IconifyIcon name="ui-user" size={15} color="currentColor" /></div>}
      </div>
    </>
  )
}
