import { describe, it, expect } from 'vitest'
import { safeStringify, safeParse, tryParse, parseOr } from './safeJson'

describe('safeJson', () => {
  it('round-trips plain JSON values unchanged', () => {
    const input = { a: 1, b: 'x', c: [true, null, 2.5], d: { nested: 'ok' } }
    expect(safeParse(safeStringify(input))).toEqual(input)
  })

  it('preserves Date instances', () => {
    const d = new Date('2026-04-17T12:34:56.000Z')
    const out = safeParse<{ at: Date }>(safeStringify({ at: d }))
    expect(out.at).toBeInstanceOf(Date)
    expect(out.at.toISOString()).toBe(d.toISOString())
  })

  it('preserves Map entries and identity', () => {
    const m = new Map<string, number>([['a', 1], ['b', 2]])
    const out = safeParse<{ m: Map<string, number> }>(safeStringify({ m }))
    expect(out.m).toBeInstanceOf(Map)
    expect(Array.from(out.m.entries())).toEqual([['a', 1], ['b', 2]])
  })

  it('preserves Set contents', () => {
    const s = new Set([1, 2, 3])
    const out = safeParse<{ s: Set<number> }>(safeStringify({ s }))
    expect(out.s).toBeInstanceOf(Set)
    expect(Array.from(out.s)).toEqual([1, 2, 3])
  })

  it('preserves BigInt values', () => {
    const out = safeParse<{ n: bigint }>(safeStringify({ n: 12345678901234567890n }))
    expect(typeof out.n).toBe('bigint')
    expect(out.n).toBe(12345678901234567890n)
  })

  it('preserves undefined object properties and array entries', () => {
    const out = safeParse<{ a?: undefined; list: Array<number | undefined> }>(
      safeStringify({ a: undefined, list: [1, undefined, 3] }),
    )
    expect(Object.prototype.hasOwnProperty.call(out, 'a')).toBe(true)
    expect(out.a).toBeUndefined()
    expect(out.list).toEqual([1, undefined, 3])
  })

  it('restores undefined without mutating previously returned parse results', () => {
    const json = safeStringify({ nested: { value: undefined }, list: [undefined] })
    const first = safeParse<{ nested: { value?: undefined }; list: Array<undefined> }>(json)
    const second = safeParse<{ nested: { value?: undefined }; list: Array<undefined> }>(json)

    expect(first).not.toBe(second)
    expect(first.nested).not.toBe(second.nested)
    expect(Object.prototype.hasOwnProperty.call(first.nested, 'value')).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(second.nested, 'value')).toBe(true)
    expect(first.list).toEqual([undefined])
    expect(second.list).toEqual([undefined])
  })

  it('preserves non-finite numbers', () => {
    const out = safeParse<{ nan: number; inf: number; negInf: number }>(
      safeStringify({ nan: Number.NaN, inf: Infinity, negInf: -Infinity }),
    )
    expect(Number.isNaN(out.nan)).toBe(true)
    expect(out.inf).toBe(Infinity)
    expect(out.negInf).toBe(-Infinity)
  })

  it('preserves RegExp, URL, ArrayBuffer and typed arrays', () => {
    const input = {
      pattern: /suora/gi,
      url: new URL('https://example.com/path?q=1'),
      buffer: Uint8Array.from([1, 2, 3]).buffer,
      bytes: new Uint16Array([4, 5, 6]),
    }
    const out = safeParse<typeof input>(safeStringify(input))
    expect(out.pattern).toBeInstanceOf(RegExp)
    expect(out.pattern.source).toBe('suora')
    expect(out.pattern.flags).toContain('g')
    expect(out.url).toBeInstanceOf(URL)
    expect(out.url.toString()).toBe('https://example.com/path?q=1')
    expect(Array.from(new Uint8Array(out.buffer))).toEqual([1, 2, 3])
    expect(out.bytes).toBeInstanceOf(Uint16Array)
    expect(Array.from(out.bytes)).toEqual([4, 5, 6])
  })

  it('rehydrates Error with name/message/stack', () => {
    const e = new TypeError('boom')
    const out = safeParse<{ err: Error }>(safeStringify({ err: e }))
    expect(out.err).toBeInstanceOf(Error)
    expect(out.err.name).toBe('TypeError')
    expect(out.err.message).toBe('boom')
  })

  it('tryParse returns ok:false on malformed JSON instead of throwing', () => {
    const r = tryParse('{not valid')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.message).toBeTruthy()
  })

  it('parseOr falls back on malformed JSON', () => {
    const r = parseOr<{ x: number }>('{not valid', { x: 7 })
    expect(r).toEqual({ x: 7 })
  })

  it('does not mis-identify objects with a non-string __suora_t tag', () => {
    const obj = { __suora_t: 42, value: 'nope' }
    const out = safeParse(safeStringify(obj))
    expect(out).toEqual(obj)
  })

  it('leaves malformed tagged values unchanged instead of throwing', () => {
    expect(safeParse('{"__suora_t":"BigInt","value":"nope"}')).toEqual({ __suora_t: 'BigInt', value: 'nope' })
    expect(safeParse('{"__suora_t":"Map","entries":[1]}')).toEqual({ __suora_t: 'Map', entries: [1] })
    expect(safeParse('{"__suora_t":"RegExp","source":"(","flags":"g"}')).toEqual({ __suora_t: 'RegExp', source: '(', flags: 'g' })
  })

  it('handles nested rich types', () => {
    const input = {
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      tags: new Set(['a', 'b']),
      meta: new Map<string, Date>([['updated', new Date('2026-02-02T00:00:00.000Z')]]),
    }
    const out = safeParse<typeof input>(safeStringify(input))
    expect(out.createdAt).toBeInstanceOf(Date)
    expect(out.tags).toBeInstanceOf(Set)
    expect(out.meta).toBeInstanceOf(Map)
    expect(out.meta.get('updated')).toBeInstanceOf(Date)
  })
})
