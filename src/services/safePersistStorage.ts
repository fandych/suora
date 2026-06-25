import { safeParse, safeStringify } from '@/utils/safeJson'
import type { PersistStorage, StorageValue } from 'zustand/middleware'

const PERSIST_SERIALIZE_DEBOUNCE_MS = 200

export interface StringStateStorage<R = unknown> {
  getItem: (name: string) => string | null | Promise<string | null>
  setItem: (name: string, value: string) => R
  removeItem: (name: string) => R
}

export function createSafePersistStorage<S, R = unknown>(storage: StringStateStorage<R>): PersistStorage<S, Promise<void>> {
  const pendingValues = new Map<string, StorageValue<S>>()
  const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const pendingWaiters = new Map<string, Array<{ resolve: () => void; reject: (error: unknown) => void }>>()

  const settlePendingWrite = (name: string, error?: unknown) => {
    const waiters = pendingWaiters.get(name)
    pendingWaiters.delete(name)
    if (!waiters?.length) return

    for (const waiter of waiters) {
      if (error === undefined) {
        waiter.resolve()
      } else {
        waiter.reject(error)
      }
    }
  }

  const flushPendingWrite = async (name: string): Promise<void> => {
    const timer = pendingTimers.get(name)
    if (timer) {
      clearTimeout(timer)
      pendingTimers.delete(name)
    }

    const value = pendingValues.get(name)
    if (!value) {
      settlePendingWrite(name)
      return
    }

    pendingValues.delete(name)

    try {
      await Promise.resolve(storage.setItem(name, safeStringify(value)))
      settlePendingWrite(name)
    } catch (error) {
      settlePendingWrite(name, error)
      throw error
    }
  }

  return {
    getItem: async (name: string): Promise<StorageValue<S> | null> => {
      const pendingValue = pendingValues.get(name)
      if (pendingValue) return pendingValue

      const value = await storage.getItem(name)
      return value === null ? null : safeParse<StorageValue<S>>(value)
    },
    setItem: (name: string, value: StorageValue<S>): Promise<void> => {
      pendingValues.set(name, value)

      const existingTimer = pendingTimers.get(name)
      if (existingTimer) clearTimeout(existingTimer)

      const writePromise = new Promise<void>((resolve, reject) => {
        const existingWaiters = pendingWaiters.get(name)
        if (existingWaiters) {
          existingWaiters.push({ resolve, reject })
        } else {
          pendingWaiters.set(name, [{ resolve, reject }])
        }
      })

      const nextTimer = setTimeout(() => {
        void flushPendingWrite(name)
      }, PERSIST_SERIALIZE_DEBOUNCE_MS)
      pendingTimers.set(name, nextTimer)

      return writePromise
    },
    removeItem: async (name: string): Promise<void> => {
      const existingTimer = pendingTimers.get(name)
      if (existingTimer) {
        clearTimeout(existingTimer)
        pendingTimers.delete(name)
      }
      pendingValues.delete(name)
      settlePendingWrite(name)
      await Promise.resolve(storage.removeItem(name))
    },
  }
}
