import { describe, it, expect, beforeEach } from 'vitest'
import {
  tokenize,
  cosineSimilarity,
  buildIndex,
  searchSimilar,
  addToIndex,
  removeFromIndex,
  getIndexStats,
  type MemoryEntry,
  type VectorIndex,
} from './vectorMemory'

describe('vectorMemory', () => {
  describe('tokenize', () => {
    it('should tokenize simple English text', () => {
      const tokens = tokenize('Hello world this is a test')
      expect(tokens).toContain('hello')
      expect(tokens).toContain('world')
      expect(tokens).toContain('test')
    })

    it('should filter out single-character Latin words', () => {
      const tokens = tokenize('a b c test')
      expect(tokens).not.toContain('a')
      expect(tokens).not.toContain('b')
      expect(tokens).not.toContain('c')
      expect(tokens).toContain('test')
    })

    it('should handle Chinese text with bigrams', () => {
      const tokens = tokenize('你好世界')
      // Should contain single characters
      expect(tokens).toContain('你')
      expect(tokens).toContain('好')
      expect(tokens).toContain('世')
      expect(tokens).toContain('界')
      // Should contain bigrams
      expect(tokens).toContain('你好')
      expect(tokens).toContain('好世')
      expect(tokens).toContain('世界')
    })

    it('should handle mixed CJK and Latin text', () => {
      const tokens = tokenize('Hello 你好 world 世界')
      expect(tokens).toContain('hello')
      expect(tokens).toContain('world')
      expect(tokens).toContain('你')
      expect(tokens).toContain('好')
      expect(tokens).toContain('你好')
    })

    it('should handle empty string', () => {
      const tokens = tokenize('')
      expect(tokens).toEqual([])
    })

    it('should handle punctuation', () => {
      const tokens = tokenize('Hello, world! How are you?')
      expect(tokens).toContain('hello')
      expect(tokens).toContain('world')
      expect(tokens).toContain('how')
      expect(tokens).toContain('are')
      expect(tokens).toContain('you')
    })

    it('should normalize to lowercase', () => {
      const tokens = tokenize('HELLO World TeSt')
      expect(tokens).toContain('hello')
      expect(tokens).toContain('world')
      expect(tokens).toContain('test')
    })

    it('should handle numbers', () => {
      const tokens = tokenize('test123 456test test789')
      expect(tokens).toContain('test123')
      expect(tokens).toContain('456test')
      expect(tokens).toContain('test789')
    })
  })

  describe('cosineSimilarity', () => {
    it('should return 1.0 for identical vectors', () => {
      const vec = new Map([
        ['a', 1],
        ['b', 2],
        ['c', 3],
      ])
      const similarity = cosineSimilarity(vec, vec)
      expect(similarity).toBeCloseTo(1.0, 5)
    })

    it('should return 0.0 for orthogonal vectors', () => {
      const vec1 = new Map([['a', 1]])
      const vec2 = new Map([['b', 1]])
      const similarity = cosineSimilarity(vec1, vec2)
      expect(similarity).toBe(0)
    })

    it('should return 0.0 for empty vectors', () => {
      const vec1 = new Map()
      const vec2 = new Map([['a', 1]])
      expect(cosineSimilarity(vec1, vec2)).toBe(0)
      expect(cosineSimilarity(vec2, vec1)).toBe(0)
      expect(cosineSimilarity(vec1, vec1)).toBe(0)
    })

    it('should compute correct similarity for partially overlapping vectors', () => {
      const vec1 = new Map([
        ['a', 1],
        ['b', 1],
      ])
      const vec2 = new Map([
        ['a', 1],
        ['c', 1],
      ])
      const similarity = cosineSimilarity(vec1, vec2)
      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThan(1)
    })

    it('should be symmetric', () => {
      const vec1 = new Map([
        ['a', 1],
        ['b', 2],
      ])
      const vec2 = new Map([
        ['a', 2],
        ['c', 1],
      ])
      const sim1 = cosineSimilarity(vec1, vec2)
      const sim2 = cosineSimilarity(vec2, vec1)
      expect(sim1).toBeCloseTo(sim2, 10)
    })
  })

  describe('buildIndex', () => {
    it('should build empty index from empty array', () => {
      const index = buildIndex([])
      expect(index.size).toBe(0)
      expect(index.vectors.size).toBe(0)
      expect(index.contents.size).toBe(0)
      expect(index.df.size).toBe(0)
    })

    it('should build index from single memory', () => {
      const memories: MemoryEntry[] = [
        { id: 'm1', content: 'hello world' },
      ]
      const index = buildIndex(memories)
      expect(index.size).toBe(1)
      expect(index.vectors.has('m1')).toBe(true)
      expect(index.contents.get('m1')).toBe('hello world')
    })

    it('should build index from multiple memories', () => {
      const memories: MemoryEntry[] = [
        { id: 'm1', content: 'hello world' },
        { id: 'm2', content: 'goodbye world' },
        { id: 'm3', content: 'hello there' },
      ]
      const index = buildIndex(memories)
      expect(index.size).toBe(3)
      expect(index.vectors.size).toBe(3)
      expect(index.contents.size).toBe(3)
    })

    it('should compute document frequencies', () => {
      const memories: MemoryEntry[] = [
        { id: 'm1', content: 'hello world' },
        { id: 'm2', content: 'hello there' },
        { id: 'm3', content: 'world peace' },
      ]
      const index = buildIndex(memories)
      // 'hello' appears in 2 docs
      expect(index.df.get('hello')).toBe(2)
      // 'world' appears in 2 docs
      expect(index.df.get('world')).toBe(2)
      // 'there' appears in 1 doc
      expect(index.df.get('there')).toBe(1)
      // 'peace' appears in 1 doc
      expect(index.df.get('peace')).toBe(1)
    })

    it('should create TF-IDF vectors', () => {
      const memories: MemoryEntry[] = [
        { id: 'm1', content: 'hello world' },
      ]
      const index = buildIndex(memories)
      const vec = index.vectors.get('m1')
      expect(vec).toBeDefined()
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(vec!.size).toBeGreaterThan(0)
      // All weights should be positive
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      for (const weight of vec!.values()) {
        expect(weight).toBeGreaterThan(0)
      }
    })
  })

  describe('searchSimilar', () => {
    let index: VectorIndex

    beforeEach(() => {
      const memories: MemoryEntry[] = [
        { id: 'm1', content: 'I love programming in Python' },
        { id: 'm2', content: 'JavaScript is a great language' },
        { id: 'm3', content: 'Python is excellent for data science' },
        { id: 'm4', content: 'I enjoy coding in TypeScript' },
      ]
      index = buildIndex(memories)
    })

    it('should return empty array for empty index', () => {
      const emptyIndex = buildIndex([])
      const results = searchSimilar(emptyIndex, 'test')
      expect(results).toEqual([])
    })

    it('should return empty array for empty query', () => {
      const results = searchSimilar(index, '')
      expect(results).toEqual([])
    })

    it('should find exact match', () => {
      const results = searchSimilar(index, 'Python', 5)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].score).toBeGreaterThan(0)
      // Should find documents containing Python
      const foundIds = results.map(r => r.id)
      expect(foundIds).toContain('m1')
      expect(foundIds).toContain('m3')
    })

    it('should rank by relevance', () => {
      const results = searchSimilar(index, 'Python programming', 5)
      expect(results.length).toBeGreaterThan(0)
      // Results should be sorted by score descending
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
      }
    })

    it('should respect topK parameter', () => {
      const results = searchSimilar(index, 'programming', 2)
      expect(results.length).toBeLessThanOrEqual(2)
    })

    it('should find semantic similarity', () => {
      const results = searchSimilar(index, 'coding', 5)
      // Should find documents about programming/coding
      expect(results.length).toBeGreaterThan(0)
    })

    it('should handle queries with no matches', () => {
      const results = searchSimilar(index, 'xyz123abc')
      expect(results).toEqual([])
    })

    it('should return content in results', () => {
      const results = searchSimilar(index, 'Python', 1)
      expect(results[0]).toHaveProperty('id')
      expect(results[0]).toHaveProperty('content')
      expect(results[0]).toHaveProperty('score')
      expect(results[0].content).toBeTruthy()
    })
  })

  describe('addToIndex', () => {
    it('should add new entry to empty index', () => {
      const index = buildIndex([])
      const entry: MemoryEntry = { id: 'm1', content: 'hello world' }

      addToIndex(index, entry)

      expect(index.size).toBe(1)
      expect(index.vectors.has('m1')).toBe(true)
      expect(index.contents.get('m1')).toBe('hello world')
    })

    it('should add new entry to existing index', () => {
      const index = buildIndex([
        { id: 'm1', content: 'hello world' },
      ])

      const newEntry: MemoryEntry = { id: 'm2', content: 'goodbye world' }
      addToIndex(index, newEntry)

      expect(index.size).toBe(2)
      expect(index.vectors.has('m2')).toBe(true)
    })

    it('should update document frequencies', () => {
      const index = buildIndex([
        { id: 'm1', content: 'hello world' },
      ])

      expect(index.df.get('hello')).toBe(1)

      addToIndex(index, { id: 'm2', content: 'hello there' })

      expect(index.df.get('hello')).toBe(2)
    })

    it('should not add duplicate entries', () => {
      const index = buildIndex([
        { id: 'm1', content: 'hello world' },
      ])

      addToIndex(index, { id: 'm1', content: 'modified content' })

      expect(index.size).toBe(1)
      expect(index.contents.get('m1')).toBe('hello world') // unchanged
    })

    it('should make added entry searchable', () => {
      const index = buildIndex([
        { id: 'm1', content: 'Python programming' },
      ])

      addToIndex(index, { id: 'm2', content: 'JavaScript programming' })

      const results = searchSimilar(index, 'JavaScript', 5)
      const ids = results.map(r => r.id)
      expect(ids).toContain('m2')
    })
  })

  describe('removeFromIndex', () => {
    it('should remove entry from index', () => {
      const index = buildIndex([
        { id: 'm1', content: 'hello world' },
        { id: 'm2', content: 'goodbye world' },
      ])

      removeFromIndex(index, 'm1')

      expect(index.size).toBe(1)
      expect(index.vectors.has('m1')).toBe(false)
      expect(index.contents.has('m1')).toBe(false)
    })

    it('should update document frequencies', () => {
      const index = buildIndex([
        { id: 'm1', content: 'hello world' },
        { id: 'm2', content: 'hello there' },
      ])

      expect(index.df.get('hello')).toBe(2)

      removeFromIndex(index, 'm1')

      expect(index.df.get('hello')).toBe(1)
    })

    it('should remove terms that no longer appear in any document', () => {
      const index = buildIndex([
        { id: 'm1', content: 'hello world' },
        { id: 'm2', content: 'goodbye' },
      ])

      expect(index.df.has('world')).toBe(true)

      removeFromIndex(index, 'm1')

      expect(index.df.has('world')).toBe(false)
    })

    it('should handle removing non-existent entry', () => {
      const index = buildIndex([
        { id: 'm1', content: 'hello world' },
      ])

      removeFromIndex(index, 'non-existent')

      expect(index.size).toBe(1)
    })

    it('should not crash on empty index', () => {
      const index = buildIndex([])

      expect(() => removeFromIndex(index, 'm1')).not.toThrow()
      expect(index.size).toBe(0)
    })

    it('should make removed entry unsearchable', () => {
      const index = buildIndex([
        { id: 'm1', content: 'Python programming' },
        { id: 'm2', content: 'JavaScript programming' },
      ])

      removeFromIndex(index, 'm1')

      const results = searchSimilar(index, 'Python', 5)
      const ids = results.map(r => r.id)
      expect(ids).not.toContain('m1')
    })
  })

  describe('getIndexStats', () => {
    it('should return correct stats for empty index', () => {
      const index = buildIndex([])
      const stats = getIndexStats(index)

      expect(stats).toEqual({
        totalMemories: 0,
        vocabularySize: 0,
        indexSize: 0,
      })
    })

    it('should return correct stats for non-empty index', () => {
      const memories: MemoryEntry[] = [
        { id: 'm1', content: 'hello world' },
        { id: 'm2', content: 'goodbye world' },
        { id: 'm3', content: 'hello there' },
      ]
      const index = buildIndex(memories)
      const stats = getIndexStats(index)

      expect(stats.totalMemories).toBe(3)
      expect(stats.indexSize).toBe(3)
      expect(stats.vocabularySize).toBeGreaterThan(0)
    })

    it('should update stats after adding entry', () => {
      const index = buildIndex([
        { id: 'm1', content: 'hello' },
      ])

      const statsBefore = getIndexStats(index)

      addToIndex(index, { id: 'm2', content: 'world' })

      const statsAfter = getIndexStats(index)

      expect(statsAfter.totalMemories).toBe(statsBefore.totalMemories + 1)
      expect(statsAfter.indexSize).toBe(statsBefore.indexSize + 1)
    })

    it('should update stats after removing entry', () => {
      const index = buildIndex([
        { id: 'm1', content: 'hello' },
        { id: 'm2', content: 'world' },
      ])

      const statsBefore = getIndexStats(index)

      removeFromIndex(index, 'm1')

      const statsAfter = getIndexStats(index)

      expect(statsAfter.totalMemories).toBe(statsBefore.totalMemories - 1)
      expect(statsAfter.indexSize).toBe(statsBefore.indexSize - 1)
    })
  })
})
