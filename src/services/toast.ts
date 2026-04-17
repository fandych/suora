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

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = _nextId++
    set((state) => ({ toasts: [...state.toasts, { ...t, id }] }))
    if (t.durationMs > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((x) => x.id !== id) }))
      }, t.durationMs)
    }
    return id
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((x) => x.id !== id) })),
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
