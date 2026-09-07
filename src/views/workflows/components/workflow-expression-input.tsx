import { useMemo, useRef, useState } from "react"

import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import type { WorkflowExpressionSuggestion } from "@/views/workflows/components/workflow-expression-suggestions"

type ExpressionRange = { start: number; end: number; query: string; syntax: "template" | "mustache" | "short" }
type TextControl = HTMLInputElement | HTMLTextAreaElement

type WorkflowExpressionInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  suggestions: WorkflowExpressionSuggestion[]
  multiline?: boolean
  rows?: number
  className?: string
  ariaInvalid?: boolean
}

function findExpressionRange(value: string, cursor: number): ExpressionRange | null {
  const beforeCursor = value.slice(0, cursor)
  const templateStart = beforeCursor.lastIndexOf("${")
  const mustacheStart = beforeCursor.lastIndexOf("{{")
  const start = Math.max(templateStart, mustacheStart)
  if (start >= 0) {
    const syntax = start === templateStart ? "template" : "mustache"
    const closing = value.indexOf(syntax === "template" ? "}" : "}}", start)
    if (closing === -1 || closing >= cursor - (syntax === "template" ? 1 : 2)) {
      const end = closing === -1 ? cursor : closing + (syntax === "template" ? 1 : 2)
      return { start, end, query: value.slice(start + (syntax === "template" ? 2 : 2), cursor).replace(/}\}?\s*$/, "").trim(), syntax }
    }
  }
  const shortMatch = beforeCursor.match(/\$([a-zA-Z_][\w.]*)$/)
  if (!shortMatch || beforeCursor.endsWith("${")) return null
  return { start: cursor - shortMatch[0].length, end: cursor, query: shortMatch[1], syntax: "short" }
}

function formatSuggestion(expression: string, syntax: ExpressionRange["syntax"] | undefined) {
  const path = expression.slice(2, -1)
  if (syntax === "mustache") return `{{ ${path} }}`
  if (syntax === "short") return `$${path}`
  return expression
}

export function WorkflowExpressionInput({ value, onChange, placeholder, suggestions, multiline = false, rows, className, ariaInvalid }: WorkflowExpressionInputProps) {
  const inputRef = useRef<TextControl | null>(null)
  const [cursor, setCursor] = useState(value.length)
  const [focused, setFocused] = useState(false)
  const [forcedOpen, setForcedOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const expressionRange = findExpressionRange(value, cursor)
  const visibleSuggestions = useMemo(() => {
    const query = expressionRange?.query.toLowerCase() ?? ""
    if (forcedOpen && !expressionRange) return suggestions
    if (!expressionRange) return []
    return suggestions.filter((suggestion) => suggestion.expression.slice(2, -1).toLowerCase().startsWith(query))
  }, [expressionRange, forcedOpen, suggestions])
  const open = focused && visibleSuggestions.length > 0 && (Boolean(expressionRange) || forcedOpen)
  const menuId = "workflow-expression-suggestions"

  const syncCursor = (element: TextControl) => {
    const nextCursor = element.selectionStart ?? element.value.length
    setCursor(nextCursor)
    setActiveIndex(0)
  }

  const insertSuggestion = (suggestion: WorkflowExpressionSuggestion) => {
    const range = expressionRange ?? { start: cursor, end: cursor, syntax: "template" as const }
    const expression = formatSuggestion(suggestion.expression, range.syntax)
    const nextValue = `${value.slice(0, range.start)}${expression}${value.slice(range.end)}`
    const nextCursor = range.start + expression.length
    onChange(nextValue)
    setForcedOpen(false)
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(nextCursor, nextCursor)
      setCursor(nextCursor)
    })
  }

  const Control = multiline ? Textarea : Input
  const groups = ["Current result", "Workflow input", "Prior steps", "Variables"] as const
  return (
    <div className="relative">
      <Control
        ref={inputRef as never}
        value={value}
        rows={rows}
        className={className}
        aria-invalid={ariaInvalid}
        aria-autocomplete="list"
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-activedescendant={open ? `${menuId}-${activeIndex}` : undefined}
        onChange={(event) => { onChange(event.target.value); syncCursor(event.target) }}
        onFocus={(event) => { setFocused(true); syncCursor(event.currentTarget) }}
        onClick={(event) => syncCursor(event.currentTarget)}
        onSelect={(event) => syncCursor(event.currentTarget)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === " ") { event.preventDefault(); setForcedOpen(true); setActiveIndex(0); return }
          if (!open) return
          if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, visibleSuggestions.length - 1)) }
          if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)) }
          if ((event.key === "Enter" || event.key === "Tab") && visibleSuggestions[activeIndex]) { event.preventDefault(); insertSuggestion(visibleSuggestions[activeIndex]) }
          if (event.key === "Escape") { event.preventDefault(); setForcedOpen(false) }
        }}
        placeholder={placeholder}
      />
      {open ? <div id={menuId} role="listbox" className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg bg-popover p-1 shadow-md ring-1 ring-foreground/10">
        {groups.map((group) => {
          const groupSuggestions = visibleSuggestions.filter((suggestion) => suggestion.group === group)
          if (groupSuggestions.length === 0) return null
          return <div key={group} className="py-1"><p className="px-2 py-1 text-xs font-medium text-muted-foreground">{group}</p>{groupSuggestions.map((suggestion) => {
            const index = visibleSuggestions.indexOf(suggestion)
            return <button id={`${menuId}-${index}`} key={suggestion.expression} role="option" aria-selected={index === activeIndex} type="button" className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent data-[active=true]:bg-accent" data-active={index === activeIndex || undefined} onMouseDown={(event) => { event.preventDefault(); insertSuggestion(suggestion) }} onMouseEnter={() => setActiveIndex(index)}>
              <span className="font-mono text-xs">{formatSuggestion(suggestion.expression, expressionRange?.syntax)}</span><span className="truncate text-xs text-muted-foreground">{suggestion.description}</span>
            </button>
          })}</div>
        })}
      </div> : null}
    </div>
  )
}
