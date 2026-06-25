import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSafePersistStorage, type StringStateStorage } from './safePersistStorage'

afterEach(() => {
  vi.useRealTimers()
})

function createMemoryStorage(): StringStateStorage {
  const data = new Map<string, string>()
  return {
    getItem: (name) => data.get(name) ?? null,
    setItem: (name, value) => { data.set(name, value) },
    removeItem: (name) => { data.delete(name) },
  }
}

describe('safePersistStorage', () => {
  it('round-trips persisted values through safe JSON', async () => {
    vi.useFakeTimers()

    const storage = createSafePersistStorage(createMemoryStorage())
    const createdAt = new Date('2026-04-29T04:05:17.939Z')

    const writePromise = storage.setItem('suora-store', {
      state: {
        createdAt,
        maybeMissing: undefined,
        list: [1, undefined, 3],
        metadata: new Map([['kind', 'test']]),
        tags: new Set(['a', 'b']),
      },
      version: 18,
    })

    await vi.runAllTimersAsync()
    await writePromise

    const restored = await storage.getItem('suora-store') as {
      state: {
        createdAt: Date
        maybeMissing?: undefined
        list: Array<number | undefined>
        metadata: Map<string, string>
        tags: Set<string>
      }
      version: number
    }

    expect(restored.version).toBe(18)
    expect(restored.state.createdAt).toBeInstanceOf(Date)
    expect(restored.state.createdAt.toISOString()).toBe(createdAt.toISOString())
    expect(Object.prototype.hasOwnProperty.call(restored.state, 'maybeMissing')).toBe(true)
    expect(restored.state.maybeMissing).toBeUndefined()
    expect(restored.state.list).toEqual([1, undefined, 3])
    expect(restored.state.metadata).toBeInstanceOf(Map)
    expect(restored.state.metadata.get('kind')).toBe('test')
    expect(restored.state.tags).toBeInstanceOf(Set)
    expect(Array.from(restored.state.tags)).toEqual(['a', 'b'])
  })

  it('coalesces repeated writes and keeps the latest pending value readable', async () => {
    vi.useFakeTimers()

    let writeCount = 0
    const rawStorage = createMemoryStorage()
    const storage = createSafePersistStorage({
      ...rawStorage,
      setItem: (name, value) => {
        writeCount += 1
        rawStorage.setItem(name, value)
      },
    })

    const firstWrite = storage.setItem('suora-store', { state: { step: 1 }, version: 1 })
    const secondWrite = storage.setItem('suora-store', { state: { step: 2 }, version: 1 })

    await expect(storage.getItem('suora-store')).resolves.toEqual({ state: { step: 2 }, version: 1 })

    await vi.runAllTimersAsync()
    await Promise.all([firstWrite, secondWrite])

    expect(writeCount).toBe(1)
    await expect(storage.getItem('suora-store')).resolves.toEqual({ state: { step: 2 }, version: 1 })
  })
})
