// Vector Memory Service — lightweight in-browser TF-IDF semantic search
// Supports CJK text, cosine similarity, and incremental index updates.

import { readCached } from '@/services/fileStorage'
import { safeParse } from '@/utils/safeJson'

// ─── Types ──────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string
  content: string
}

export interface ScoredMemory {
  id: string
  content: string
  score: number
}

export interface VectorIndex {
  /** document-frequency: how many docs contain each term */
  df: Map<string, number>
  /** per-document TF-IDF vectors (sparse: term → weight) */
  vectors: Map<string, Map<string, number>>
  /** raw content lookup */
  contents: Map<string, string>
  /** total number of documents */
  size: number
}

// ─── Tokenizer (handles CJK + Latin) ───────────────────────────────

// CJK Unified Ideographs ranges + Kana + Hangul
const CJK_REGEX = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\uac00-\ud7af\uff00-\uffef]/g

/**
 * Tokenize text into terms.  Latin words are lowercased and split on
 * whitespace / punctuation.  CJK characters are emitted as bigrams so
 * that single-char matches don't dominate and compound words get
 * partial matching.
 */
export function tokenize(text: string): string[] {
  const tokens: string[] = []

  // Extract CJK bigrams first
  const cjkChars = text.match(CJK_REGEX)
  if (cjkChars && cjkChars.length > 0) {
    // single chars
    for (const ch of cjkChars) tokens.push(ch)
    // bigrams for better compound matching
    for (let i = 0; i < cjkChars.length - 1; i++) {
      tokens.push(cjkChars[i] + cjkChars[i + 1])
    }
  }

  // Latin / numeric tokens
  const latinOnly = text.replace(CJK_REGEX, ' ')
  const words = latinOnly.toLowerCase().split(/[^a-z0-9\u00e0-\u024f]+/).filter(w => w.length > 1)
  tokens.push(...words)

  return tokens
}

// ─── TF-IDF helpers ─────────────────────────────────────────────────

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const t of tokens) {
    tf.set(t, (tf.get(t) || 0) + 1)
  }
  // normalise by max frequency to keep values in [0,1]
  const tfValues = [...tf.values()]
  const max = tfValues.length > 0 ? Math.max(...tfValues, 1) : 1
  for (const [k, v] of tf) {
    tf.set(k, v / max)
  }
  return tf
}

function computeTfIdf(tf: Map<string, number>, df: Map<string, number>, totalDocs: number): Map<string, number> {
  const vec = new Map<string, number>()
  for (const [term, tfVal] of tf) {
    const docFreq = df.get(term) || 1
    const idf = Math.log(1 + totalDocs / docFreq)
    vec.set(term, tfVal * idf)
  }
  return vec
}

// ─── Cosine similarity ─────────────────────────────────────────────

export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0
  let normA = 0
  let normB = 0

  for (const [term, va] of a) {
    normA += va * va
    const vb = b.get(term)
    if (vb !== undefined) dot += va * vb
  }
  for (const vb of b.values()) {
    normB += vb * vb
  }

  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// ─── Index operations ───────────────────────────────────────────────

/**
 * Build a TF-IDF index from a set of memory entries.
 */
export function buildIndex(memories: MemoryEntry[]): VectorIndex {
  const df = new Map<string, number>()
  const contents = new Map<string, string>()
  const tokenCache = new Map<string, Map<string, number>>()

  // First pass: compute document frequencies
  for (const mem of memories) {
    contents.set(mem.id, mem.content)
    const tf = termFrequency(tokenize(mem.content))
    tokenCache.set(mem.id, tf)
    for (const term of tf.keys()) {
      df.set(term, (df.get(term) || 0) + 1)
    }
  }

  // Second pass: compute TF-IDF vectors
  const vectors = new Map<string, Map<string, number>>()
  const totalDocs = memories.length || 1
  for (const mem of memories) {
    const tf = tokenCache.get(mem.id)
    if (tf) {
      vectors.set(mem.id, computeTfIdf(tf, df, totalDocs))
    }
  }

  return { df, vectors, contents, size: memories.length }
}

/**
 * Search the index for the top-K most similar memories to the query.
 */
export function searchSimilar(index: VectorIndex, query: string, topK = 5): ScoredMemory[] {
  if (index.size === 0) return []

  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return []

  const queryTf = termFrequency(queryTokens)
  const queryVec = computeTfIdf(queryTf, index.df, index.size)

  const scored: ScoredMemory[] = []
  for (const [id, docVec] of index.vectors) {
    const score = cosineSimilarity(queryVec, docVec)
    if (score > 0) {
      scored.push({ id, content: index.contents.get(id) || '', score })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK)
}

/**
 * Incrementally add a single entry to an existing index.
 * Recomputes IDF weights for affected terms (lightweight for single additions).
 */
export function addToIndex(index: VectorIndex, entry: MemoryEntry): void {
  if (index.contents.has(entry.id)) return // already present

  index.contents.set(entry.id, entry.content)
  index.size++

  const tokens = tokenize(entry.content)
  const tf = termFrequency(tokens)

  // Update document frequencies
  for (const term of tf.keys()) {
    index.df.set(term, (index.df.get(term) || 0) + 1)
  }

  // Compute the new document's vector
  index.vectors.set(entry.id, computeTfIdf(tf, index.df, index.size))

  // Note: existing document vectors are *not* recomputed here for
  // performance — the IDF drift from one addition is negligible.
  // Call buildIndex() periodically for full accuracy.
}

/**
 * Remove an entry from the index.
 */
export function removeFromIndex(index: VectorIndex, entryId: string): void {
  const docVec = index.vectors.get(entryId)
  if (!docVec) return

  // Decrement DF for each term in the removed document
  for (const term of docVec.keys()) {
    const current = index.df.get(term) || 1
    if (current <= 1) {
      index.df.delete(term)
    } else {
      index.df.set(term, current - 1)
    }
  }

  index.vectors.delete(entryId)
  index.contents.delete(entryId)
  index.size = Math.max(0, index.size - 1)
}

/**
 * Return statistics about the index.
 */
export function getIndexStats(index: VectorIndex): { totalMemories: number; vocabularySize: number; indexSize: number } {
  return {
    totalMemories: index.size,
    vocabularySize: index.df.size,
    indexSize: index.vectors.size,
  }
}

// ─── Singleton module-level index ───────────────────────────────────

let _index: VectorIndex = { df: new Map(), vectors: new Map(), contents: new Map(), size: 0 }

/** Get the singleton index. */
export function getIndex(): VectorIndex {
  return _index
}

/** Replace the singleton index (e.g. after rebuild). */
export function setIndex(idx: VectorIndex): void {
  _index = idx
}

/**
 * Rebuild the singleton index from all memories in the persisted store.
 * Returns the rebuilt index.
 */
export function rebuildIndexFromStore(): VectorIndex {
  const memories = loadAllMemoriesFromStore()
  _index = buildIndex(memories)
  return _index
}

/**
 * Load all memory entries (session + global) from the persisted store.
 * Capped at MAX_INDEX_ENTRIES to prevent unbounded memory growth.
 */
const MAX_INDEX_ENTRIES = 10_000

function loadAllMemoriesFromStore(): MemoryEntry[] {
  try {
    const raw = readCached('suora-store')
    if (!raw) return []

    const parsed = safeParse<{
      state?: {
        agents?: Array<{ memories?: Array<{ id: string; content: string }> }>
        globalMemories?: Array<{ id: string; content: string }>
      }
    }>(raw)

    const entries: MemoryEntry[] = []
    const seen = new Set<string>()

    // Collect from all agents
    if (parsed.state?.agents) {
      for (const agent of parsed.state.agents) {
        if (agent.memories) {
          for (const m of agent.memories) {
            if (entries.length >= MAX_INDEX_ENTRIES) break
            if (!m.content || !seen.has(m.id)) {
              if (!m.content) continue  // skip entries with empty content
              seen.add(m.id)
              entries.push({ id: m.id, content: m.content })
            }
          }
        }
        if (entries.length >= MAX_INDEX_ENTRIES) break
      }
    }

    // Collect global memories
    if (parsed.state?.globalMemories && entries.length < MAX_INDEX_ENTRIES) {
      for (const m of parsed.state.globalMemories) {
        if (entries.length >= MAX_INDEX_ENTRIES) break
        if (!m.content) continue
        if (!seen.has(m.id)) {
          seen.add(m.id)
          entries.push({ id: m.id, content: m.content })
        }
      }
    }

    return entries
  } catch {
    return []
  }
}
