import { useRef, useState } from 'react'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { MarkdownContent } from '@/components/chat/ChatMarkdown'
import { useI18n } from '@/hooks/useI18n'

interface SystemPromptMarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}

type MarkdownSnippet = 'heading' | 'bullet' | 'check' | 'quote' | 'code'

function applySnippet(value: string, start: number, end: number, snippet: MarkdownSnippet) {
  const selected = value.slice(start, end)
  const before = value.slice(0, start)
  const after = value.slice(end)
  const fallback = selected || 'instruction'

  let replacement = fallback
  switch (snippet) {
    case 'heading':
      replacement = `## ${fallback}`
      break
    case 'bullet':
      replacement = fallback
        .split('\n')
        .map((line) => `- ${line || 'item'}`)
        .join('\n')
      break
    case 'check':
      replacement = fallback
        .split('\n')
        .map((line) => `- [ ] ${line || 'task'}`)
        .join('\n')
      break
    case 'quote':
      replacement = fallback
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')
      break
    case 'code':
      replacement = `\`\`\`text\n${fallback}\n\`\`\``
      break
  }

  return {
    value: `${before}${replacement}${after}`,
    selectionStart: before.length,
    selectionEnd: before.length + replacement.length,
  }
}

export function SystemPromptMarkdownEditor({ value, onChange, placeholder, rows = 12 }: SystemPromptMarkdownEditorProps) {
  const { t } = useI18n()
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const insertSnippet = (snippet: MarkdownSnippet) => {
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? value.length
    const end = textarea?.selectionEnd ?? value.length
    const next = applySnippet(value, start, end, snippet)
    onChange(next.value)
    const restoreSelection = () => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(next.selectionStart, next.selectionEnd)
    }
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(restoreSelection)
    } else {
      window.setTimeout(restoreSelection, 0)
    }
  }

  const tools: Array<{ snippet: MarkdownSnippet; label: string; icon?: string; text?: string }> = [
    { snippet: 'heading', label: t('agents.markdownHeading', 'Heading'), icon: 'ui-memo' },
    { snippet: 'bullet', label: t('agents.markdownBulletList', 'Bullet list'), icon: 'ui-logs' },
    { snippet: 'check', label: t('agents.markdownChecklist', 'Checklist'), icon: 'ui-check' },
    { snippet: 'quote', label: t('agents.markdownQuote', 'Quote'), icon: 'ui-sign' },
    { snippet: 'code', label: t('agents.markdownCodeBlock', 'Code block'), text: '</>' },
  ]

  return (
    <div className="overflow-hidden rounded-3xl border border-border-subtle/60 bg-surface-2/72">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle/55 bg-surface-3/35 px-3 py-2">
        <div className="inline-flex rounded-2xl border border-border-subtle bg-surface-0/65 p-1 text-[11px]">
          <button
            type="button"
            onClick={() => setMode('write')}
            className={`rounded-xl px-3 py-1.5 transition-colors ${mode === 'write' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary'}`}
          >
            {t('agents.markdownWrite', 'Write')}
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`rounded-xl px-3 py-1.5 transition-colors ${mode === 'preview' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary'}`}
          >
            {t('skills.preview', 'Preview')}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {tools.map((tool) => (
            <button
              key={tool.snippet}
              type="button"
              title={tool.label}
              aria-label={tool.label}
              onClick={() => insertSnippet(tool.snippet)}
              disabled={mode !== 'write'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-surface-2 hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
            >
              {tool.text ? <span className="text-[10px] font-bold">{tool.text}</span> : <IconifyIcon name={tool.icon ?? 'ui-memo'} size={14} color="currentColor" />}
            </button>
          ))}
        </div>
      </div>

      {mode === 'write' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full resize-y bg-transparent px-4 py-4 font-mono text-sm leading-7 text-text-primary placeholder-text-muted focus:outline-none"
        />
      ) : (
        <div className="max-h-120 min-h-64 overflow-auto px-4 py-4 text-sm text-text-primary">
          {value.trim() ? (
            <div className="markdown-body">
              <MarkdownContent content={value} />
            </div>
          ) : (
            <div className="flex min-h-52 items-center justify-center rounded-2xl border border-dashed border-border-subtle text-xs text-text-muted">
              {t('skills.nothingToPreview', 'Nothing to preview.')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}