import { describe, expect, it } from 'vitest'
import { createSafePersistStorage, type StringStateStorage } from './safePersistStorage'

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
    const storage = createSafePersistStorage(createMemoryStorage())
    const createdAt = new Date('2026-04-29T04:05:17.939Z')

    storage.setItem('suora-store', {
      state: {
        createdAt,
        maybeMissing: undefined,
        list: [1, undefined, 3],
        metadata: new Map([['kind', 'test']]),
        tags: new Set(['a', 'b']),
      },
      version: 18,
    })

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
})
