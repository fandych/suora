// Lightweight toast notification service + host component.
// Usage: `toast.error('Failed to save')`, `toast.success('Saved')`, etc.

import { create } from 'zustand'

export type ToastKind = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
  detail?: string
  durationMs: number
}

interface ToastStore {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id'>) => number
  dismiss: (id: number) => void
}

let _nextId = 1
const MAX_TOASTS = 5
const activeTimers = new Map<number, ReturnType<typeof setTimeout>>()

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = _nextId++
    set((state) => {
      let updated = [...state.toasts, { ...t, id }]
      // Evict oldest toasts beyond the limit
      while (updated.length > MAX_TOASTS) {
        const evicted = updated.shift()
        if (evicted) {
          const timer = activeTimers.get(evicted.id)
          if (timer) { clearTimeout(timer); activeTimers.delete(evicted.id) }
        }
      }
      return { toasts: updated }
    })
    if (t.durationMs > 0) {
      const timer = setTimeout(() => {
        activeTimers.delete(id)
        set((state) => ({ toasts: state.toasts.filter((x) => x.id !== id) }))
      }, t.durationMs)
      activeTimers.set(id, timer)
    }
    return id
  },
  dismiss: (id) => {
    const timer = activeTimers.get(id)
    if (timer) { clearTimeout(timer); activeTimers.delete(id) }
    set((state) => ({ toasts: state.toasts.filter((x) => x.id !== id) }))
  },
}))

function push(kind: ToastKind, message: string, detail?: string, durationMs = 4500) {
  return useToastStore.getState().push({ kind, message, detail, durationMs })
}

export const toast = {
  info: (message: string, detail?: string) => push('info', message, detail),
  success: (message: string, detail?: string) => push('success', message, detail),
  warning: (message: string, detail?: string) => push('warning', message, detail, 7000),
  error: (message: string, detail?: string) => push('error', message, detail, 8000),
  dismiss: (id: number) => useToastStore.getState().dismiss(id),
}
