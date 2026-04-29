import { safeParse, safeStringify } from '@/utils/safeJson'
import type { PersistStorage, StorageValue } from 'zustand/middleware'

export interface StringStateStorage<R = unknown> {
  getItem: (name: string) => string | null | Promise<string | null>
  setItem: (name: string, value: string) => R
  removeItem: (name: string) => R
}

export function createSafePersistStorage<S, R = unknown>(storage: StringStateStorage<R>): PersistStorage<S, R> {
  return {
    getItem: async (name: string): Promise<StorageValue<S> | null> => {
      const value = await storage.getItem(name)
      return value === null ? null : safeParse<StorageValue<S>>(value)
    },
    setItem: (name: string, value: StorageValue<S>): R => storage.setItem(name, safeStringify(value)),
    removeItem: (name: string): R => storage.removeItem(name),
  }
}
