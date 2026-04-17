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
    const filePath = `${workspacePath}/sessions/${activeSessionId}/todos.json`
    try {
      const content = await electronInvoke('fs:readFile', filePath)
      if (typeof content === 'string' && content.trim()) {
        setTodos(JSON.parse(content) as TodoItem[])
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
    <div className="mx-auto w-full max-w-3xl mb-4 animate-fade-in">
      <div className="rounded-xl border border-border/60 bg-surface-1/60 backdrop-blur-sm overflow-hidden shadow-sm">
        {/* Summary bar */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/40 transition-colors"
        >
          <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <IconifyIcon name="ui-clipboard" size={14} color="currentColor" className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[12px] font-semibold text-text-primary">
                Todo Progress
              </span>
              <span className="text-[11px] text-text-muted">
                {done}/{total} completed
              </span>
              {inProgress > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                  {inProgress} in progress
                </span>
              )}
              {pending > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-3/80 text-text-muted font-medium">
                  {pending} pending
                </span>
              )}
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full bg-surface-3/80 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${percent}%`,
                  background: percent === 100
                    ? 'var(--t-success)'
                    : 'linear-gradient(90deg, var(--t-accent), var(--t-accent-secondary))',
                }}
              />
            </div>
          </div>
          <span className="text-[12px] font-bold text-accent tabular-nums">{percent}%</span>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={`text-text-muted/60 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Expanded todo list */}
        {expanded && (
          <div className="border-t border-border/40 px-4 py-2 space-y-1 max-h-[240px] overflow-y-auto animate-fade-in">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[12px] transition-colors ${
                  todo.status === 'done' ? 'opacity-50' : ''
                }`}
              >
                <span className={`shrink-0 ${statusColor(todo.status)}`}>
                  <IconifyIcon name={statusIcon(todo.status)} size={14} color="currentColor" />
                </span>
                <span className={`flex-1 truncate ${
                  todo.status === 'done' ? 'line-through text-text-muted' : 'text-text-primary'
                }`}>
                  {todo.title}
                </span>
                <span className="text-[10px] shrink-0">{priorityIcon(todo.priority)}</span>
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
