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
const UNDEFINED_SENTINEL = Object.freeze({ [TAG]: 'UndefinedSentinel' })

const TYPED_ARRAY_CTORS = {
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
  BigInt64Array,
  BigUint64Array,
} as const
const BIGINT_TYPED_ARRAY_NAMES = new Set<TypedArrayName>(['BigInt64Array', 'BigUint64Array'])

type TypedArrayName = keyof typeof TYPED_ARRAY_CTORS
type TypedArrayValue = InstanceType<NonNullable<(typeof TYPED_ARRAY_CTORS)[TypedArrayName]>>

function isTypedArray(value: unknown): value is TypedArrayValue {
  return ArrayBuffer.isView(value) && !(value instanceof DataView)
}

function reviveBigInt(value: unknown): bigint | undefined {
  if (typeof value !== 'string') return undefined
  try {
    return BigInt(value)
  } catch {
    return undefined
  }
}

function isJsonByteArraySample(values: unknown[]): boolean {
  const sampleSize = Math.min(values.length, 32)
  for (let index = 0; index < sampleSize; index += 1) {
    const entry = values[index]
    if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 0 || entry > 255) return false
  }
  return true
}

function restoreUndefined(value: unknown): unknown {
  if (value === UNDEFINED_SENTINEL) return undefined
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = restoreUndefined(value[index])
    }
    return value
  }
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  for (const key of Object.keys(value)) {
    record[key] = restoreUndefined(record[key])
  }
  return value
}

// NOTE: JSON.stringify calls each value's `toJSON()` *before* passing it to the
// replacer, so by the time we see a Date it's already been converted to an ISO
// string. We recover the original value via `this[key]`, which still points at
// the pre-toJSON reference.
export function safeJsonReplacer(this: unknown, key: string, value: unknown): unknown {
  const original = (this && typeof this === 'object')
    ? (this as Record<string, unknown>)[key]
    : value
  if (typeof value === 'undefined') {
    return { [TAG]: 'Undefined' }
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return { [TAG]: 'Number', value: String(value) }
  }
  if (original instanceof Date) {
    return { [TAG]: 'Date', value: original.toISOString() }
  }
  if (original instanceof URL) {
    return { [TAG]: 'URL', value: original.toString() }
  }
  if (value instanceof RegExp) {
    return { [TAG]: 'RegExp', source: value.source, flags: value.flags }
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
  if (value instanceof ArrayBuffer) {
    return { [TAG]: 'ArrayBuffer', values: Array.from(new Uint8Array(value)) }
  }
  if (value instanceof DataView) {
    return { [TAG]: 'DataView', values: Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)) }
  }
  if (isTypedArray(value)) {
    return {
      [TAG]: 'TypedArray',
      name: value.constructor.name,
      values: Array.from(value as Iterable<number | bigint>, (entry) =>
        typeof entry === 'bigint' ? entry.toString() : entry
      ),
    }
  }
  return value
}

export function safeJsonReviver(_key: string, value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const tagged = value as Record<string, unknown>
  const kind = tagged[TAG]
  if (typeof kind !== 'string') return value
  switch (kind) {
    case 'Undefined':
      return UNDEFINED_SENTINEL
    case 'Number': {
      if (tagged.value === 'NaN') return Number.NaN
      if (tagged.value === 'Infinity') return Infinity
      if (tagged.value === '-Infinity') return -Infinity
      return value
    }
    case 'Date': {
      const iso = tagged.value
      if (typeof iso !== 'string') return value
      const d = new Date(iso)
      return Number.isNaN(d.getTime()) ? value : d
    }
    case 'URL': {
      if (typeof tagged.value !== 'string') return value
      try {
        return new URL(tagged.value)
      } catch {
        return value
      }
    }
    case 'RegExp': {
      if (typeof tagged.source !== 'string' || typeof tagged.flags !== 'string') return value
      try {
        return new RegExp(tagged.source, tagged.flags)
      } catch {
        return value
      }
    }
    case 'Map': {
      const entries = tagged.entries
      if (!Array.isArray(entries)) return value
      try {
        return new Map(entries as [unknown, unknown][])
      } catch {
        return value
      }
    }
    case 'Set': {
      const values = tagged.values
      return Array.isArray(values) ? new Set(values) : value
    }
    case 'BigInt': {
      return reviveBigInt(tagged.value) ?? value
    }
    case 'Error': {
      const err = new Error(String(tagged.message ?? 'Unknown'))
      if (typeof tagged.name === 'string') err.name = tagged.name
      if (typeof tagged.stack === 'string') err.stack = tagged.stack
      return err
    }
    case 'ArrayBuffer': {
      const values = tagged.values
      if (!Array.isArray(values) || !isJsonByteArraySample(values)) return value
      return Uint8Array.from(values as number[]).buffer
    }
    case 'DataView': {
      const values = tagged.values
      if (!Array.isArray(values) || !isJsonByteArraySample(values)) return value
      const bytes = Uint8Array.from(values as number[])
      return new DataView(bytes.buffer)
    }
    case 'TypedArray': {
      if (typeof tagged.name !== 'string' || !(tagged.name in TYPED_ARRAY_CTORS) || !Array.isArray(tagged.values)) return value
      const ctor = TYPED_ARRAY_CTORS[tagged.name as TypedArrayName]
      if (!ctor) return value
      const values = tagged.values
      if (BIGINT_TYPED_ARRAY_NAMES.has(tagged.name as TypedArrayName)) {
        const bigints = values.map(reviveBigInt)
        if (bigints.some((entry) => entry === undefined)) return value
        return new (ctor as BigInt64ArrayConstructor | BigUint64ArrayConstructor)(bigints as bigint[])
      }
      if (!values.every((entry) => typeof entry === 'number' && Number.isFinite(entry))) return value
      return new (ctor as
        | Int8ArrayConstructor
        | Uint8ArrayConstructor
        | Uint8ClampedArrayConstructor
        | Int16ArrayConstructor
        | Uint16ArrayConstructor
        | Int32ArrayConstructor
        | Uint32ArrayConstructor
        | Float32ArrayConstructor
        | Float64ArrayConstructor
      )(values as number[])
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
  return JSON.stringify(value, safeJsonReplacer, space)
}

/**
 * Inverse of `safeStringify`. Throws on malformed JSON — wrap with `tryParse`
 * when reading untrusted/legacy input.
 */
export function safeParse<T = unknown>(json: string): T {
  return restoreUndefined(JSON.parse(json, safeJsonReviver)) as T
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
