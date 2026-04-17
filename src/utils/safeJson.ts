// Safe JSON serialization/deserialization with type preservation.
//
// Plain `JSON.stringify` silently drops `Map`, `Set`, and reduces `Date` to a
// string — when that string is then parsed back, type identity is lost. These
// helpers round-trip the common rich types losslessly using a `__type` tag.
//
// Use `safeStringify` / `safeParse` everywhere app state is persisted to disk
// or sent across the IPC boundary. For input you don't control, prefer
// `tryParse`, which never throws.

export type SerializationError = {
  message: string
  cause?: unknown
}

const TAG = '__suora_t'

// NOTE: JSON.stringify calls each value's `toJSON()` *before* passing it to the
// replacer, so by the time we see a Date it's already been converted to an ISO
// string. We recover the original value via `this[key]`, which still points at
// the pre-toJSON reference.
function replacer(this: unknown, key: string, value: unknown): unknown {
  const original = (this && typeof this === 'object')
    ? (this as Record<string, unknown>)[key]
    : value
  if (original instanceof Date) {
    return { [TAG]: 'Date', value: original.toISOString() }
  }
  if (value instanceof Map) {
    return { [TAG]: 'Map', entries: Array.from(value.entries()) }
  }
  if (value instanceof Set) {
    return { [TAG]: 'Set', values: Array.from(value) }
  }
  if (typeof value === 'bigint') {
    return { [TAG]: 'BigInt', value: value.toString() }
  }
  if (value instanceof Error) {
    return { [TAG]: 'Error', name: value.name, message: value.message, stack: value.stack }
  }
  return value
}

function reviver(_key: string, value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const tagged = value as Record<string, unknown>
  const kind = tagged[TAG]
  if (typeof kind !== 'string') return value
  switch (kind) {
    case 'Date': {
      const iso = tagged.value
      if (typeof iso !== 'string') return value
      const d = new Date(iso)
      return Number.isNaN(d.getTime()) ? value : d
    }
    case 'Map': {
      const entries = tagged.entries
      return Array.isArray(entries) ? new Map(entries as [unknown, unknown][]) : value
    }
    case 'Set': {
      const values = tagged.values
      return Array.isArray(values) ? new Set(values) : value
    }
    case 'BigInt': {
      const s = tagged.value
      return typeof s === 'string' ? BigInt(s) : value
    }
    case 'Error': {
      const err = new Error(String(tagged.message ?? 'Unknown'))
      if (typeof tagged.name === 'string') err.name = tagged.name
      if (typeof tagged.stack === 'string') err.stack = tagged.stack
      return err
    }
    default:
      return value
  }
}

/**
 * Serialize a value to JSON while preserving Date, Map, Set, BigInt and Error.
 * Throws on circular references (same as `JSON.stringify`).
 */
export function safeStringify(value: unknown, space?: number): string {
  return JSON.stringify(value, replacer, space)
}

/**
 * Inverse of `safeStringify`. Throws on malformed JSON — wrap with `tryParse`
 * when reading untrusted/legacy input.
 */
export function safeParse<T = unknown>(json: string): T {
  return JSON.parse(json, reviver) as T
}

/**
 * Non-throwing variant. Returns `{ ok: true, value }` on success, or
 * `{ ok: false, error }` on failure. Useful when loading from disk/IPC.
 */
export function tryParse<T = unknown>(
  json: string,
): { ok: true; value: T } | { ok: false; error: SerializationError } {
  try {
    return { ok: true, value: safeParse<T>(json) }
  } catch (err) {
    return {
      ok: false,
      error: {
        message: err instanceof Error ? err.message : String(err),
        cause: err,
      },
    }
  }
}

/**
 * Convenience: parse JSON or return a fallback on failure (no exceptions).
 */
export function parseOr<T>(json: string, fallback: T): T {
  const r = tryParse<T>(json)
  return r.ok ? r.value : fallback
}
