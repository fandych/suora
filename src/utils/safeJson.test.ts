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
