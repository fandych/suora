import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/appStore'
import { IconifyIcon } from '@/components/icons/IconifyIcons'

interface TodoItem {
  id: string
  title: string
  status: 'pending' | 'in-progress' | 'done'
  priority: 'low' | 'medium' | 'high'
}

function electronInvoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const electron = (window as unknown as { electron?: { invoke: (ch: string, ...a: unknown[]) => Promise<unknown> } }).electron
  if (!electron?.invoke) return Promise.reject(new Error('Electron IPC not available'))
  return electron.invoke(channel, ...args)
}

export function TodoProgress() {
  const { workspacePath, activeSessionId, sessions } = useAppStore()
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [expanded, setExpanded] = useState(false)

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const messages = activeSession?.messages ?? []

  const loadTodos = useCallback(async () => {
    if (!workspacePath || !activeSessionId) { setTodos([]); return }
    const key = `session-todos:${activeSessionId.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
    try {
      const result = await electronInvoke('db:loadPersistedStore', key) as { data?: unknown; error?: string }
      if (typeof result?.data === 'string' && result.data.trim()) {
        setTodos(JSON.parse(result.data) as TodoItem[])
      } else {
        setTodos([])
      }
    } catch {
      setTodos([])
    }
  }, [workspacePath, activeSessionId])

  // Reload todos when session or messages change (tool calls may have modified todos)
  useEffect(() => { loadTodos() }, [loadTodos, messages.length])

  // Also poll periodically for freshness
  useEffect(() => {
    const id = setInterval(loadTodos, 3000)
    return () => clearInterval(id)
  }, [loadTodos])

  if (todos.length === 0) return null

  const done = todos.filter((t) => t.status === 'done').length
  const inProgress = todos.filter((t) => t.status === 'in-progress').length
  const pending = todos.filter((t) => t.status === 'pending').length
  const total = todos.length
  const percent = total > 0 ? Math.round((done / total) * 100) : 0

  const priorityIcon = (p: string) => p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '🟢'
  const statusIcon = (s: string) => s === 'done' ? 'ui-check' : s === 'in-progress' ? 'ui-sparkles' : 'ui-clock'
  const statusColor = (s: string) => s === 'done' ? 'text-success' : s === 'in-progress' ? 'text-accent' : 'text-text-muted'

  return (
    <div className="mx-auto mb-4 w-full max-w-352 animate-fade-in">
      <div className="overflow-hidden rounded-[28px] border border-border-subtle/55 bg-surface-0/52 shadow-[0_18px_46px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/42"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-accent/18 bg-accent/10 text-accent">
            <IconifyIcon name="ui-clipboard" size={14} color="currentColor" className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text-muted/52">
                Execution checklist
              </span>
              <span className="text-[12px] font-semibold text-text-primary">
                {done}/{total} completed
              </span>
              {inProgress > 0 && (
                <span className="rounded-full border border-accent/18 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                  {inProgress} in progress
                </span>
              )}
              {pending > 0 && (
                <span className="rounded-full border border-border-subtle/55 bg-surface-2/65 px-2 py-0.5 text-[10px] font-medium text-text-muted">
                  {pending} pending
                </span>
              )}
            </div>
            <progress
              value={percent}
              max={100}
              className={`todo-progress-meter ${percent === 100 ? 'is-complete' : ''}`}
              aria-label={`Todo progress ${percent}%`}
            />
          </div>
          <span className="text-[13px] font-bold tabular-nums text-accent">{percent}%</span>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={`text-text-muted/60 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {expanded && (
          <div className="max-h-72 space-y-2 overflow-y-auto border-t border-border-subtle/45 bg-surface-2/28 px-4 py-3 animate-fade-in">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className={`flex items-center gap-3 rounded-[18px] border px-3 py-2.5 text-[12px] transition-colors ${
                  todo.status === 'done' ? 'opacity-50' : ''
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-0/72 ${statusColor(todo.status)}`}>
                  <IconifyIcon name={statusIcon(todo.status)} size={14} color="currentColor" />
                </span>
                <span className={`flex-1 truncate ${
                  todo.status === 'done' ? 'line-through text-text-muted' : 'text-text-primary'
                }`}>
                  {todo.title}
                </span>
                <span className="shrink-0 text-[10px]">{priorityIcon(todo.priority)}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                  todo.status === 'done' ? 'bg-success/10 text-success' :
                  todo.status === 'in-progress' ? 'bg-accent/10 text-accent' :
                  'bg-surface-3/80 text-text-muted'
                }`}>
                  {todo.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
