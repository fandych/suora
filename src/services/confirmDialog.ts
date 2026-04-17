// Promise-based confirmation dialog service.
//
// Replaces the blocking native `window.confirm()` with an async, themable,
// localizable modal. Consumers call `confirm({...})` and await a Promise<boolean>.
//
// The underlying state is held in a tiny standalone Zustand store so the dialog
// works from anywhere (components, hooks, services) without prop drilling.

import { create } from 'zustand'

export interface ConfirmOptions {
  title: string
  body: string
  confirmText?: string
  cancelText?: string
  /** When true, the confirm button is rendered in the danger style. */
  danger?: boolean
}

interface ConfirmEntry extends Required<Pick<ConfirmOptions, 'title' | 'body'>> {
  id: number
  confirmText: string
  cancelText: string
  danger: boolean
  resolve: (value: boolean) => void
}

interface ConfirmStore {
  queue: ConfirmEntry[]
  push: (entry: ConfirmEntry) => void
  resolveTop: (value: boolean) => void
}

let _nextId = 1

export const useConfirmStore = create<ConfirmStore>((set, get) => ({
  queue: [],
  push: (entry) => set((state) => ({ queue: [...state.queue, entry] })),
  resolveTop: (value) => {
    const [top, ...rest] = get().queue
    if (!top) return
    top.resolve(value)
    set({ queue: rest })
  },
}))

/**
 * Open a confirmation dialog. Resolves to `true` when the user confirms,
 * `false` when the user cancels / dismisses.
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    useConfirmStore.getState().push({
      id: _nextId++,
      title: options.title,
      body: options.body,
      confirmText: options.confirmText ?? 'Confirm',
      cancelText: options.cancelText ?? 'Cancel',
      danger: options.danger ?? false,
      resolve,
    })
  })
}
