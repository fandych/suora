import { describe, expect, it } from 'vitest'
import { applyOutputTransform } from './pipelineOutputTransforms'

describe('applyOutputTransform', () => {
  it('returns the raw output unchanged when no transform is set', () => {
    const result = applyOutputTransform({}, '  hello  ')
    expect(result).toEqual({ transformed: '  hello  ', changed: false })
  })

  it('trims surrounding whitespace', () => {
    const result = applyOutputTransform({ outputTransform: 'trim' }, '\n  hello\nworld  \n')
    expect(result.transformed).toBe('hello\nworld')
    expect(result.changed).toBe(true)
  })

  it('returns the first non-empty line', () => {
    const result = applyOutputTransform({ outputTransform: 'first-line' }, '\n\nfirst real line\nsecond line\n')
    expect(result.transformed).toBe('first real line')
    expect(result.changed).toBe(true)
  })

  it('returns the last non-empty line', () => {
    const result = applyOutputTransform({ outputTransform: 'last-line' }, 'a\nb\nc\n\n')
    expect(result.transformed).toBe('c')
  })

  it('extracts a value via json-path', () => {
    const json = JSON.stringify({ data: { items: [{ name: 'alpha' }, { name: 'beta' }] } })
    const result = applyOutputTransform({ outputTransform: 'json-path', outputTransformPath: 'data.items.1.name' }, json)
    expect(result.transformed).toBe('beta')
    expect(result.warning).toBeUndefined()
  })

  it('serialises non-string json-path results back to JSON', () => {
    const json = JSON.stringify({ ids: [1, 2, 3] })
    const result = applyOutputTransform({ outputTransform: 'json-path', outputTransformPath: 'ids' }, json)
    expect(result.transformed).toBe('[1,2,3]')
  })

  it('recovers JSON wrapped in ```json fences', () => {
    const fenced = '```json\n{"answer":42}\n```'
    const result = applyOutputTransform({ outputTransform: 'json-path', outputTransformPath: 'answer' }, fenced)
    expect(result.transformed).toBe('42')
  })

  it('falls back with a warning when json-path is missing', () => {
    const result = applyOutputTransform({ outputTransform: 'json-path' }, '{"a":1}')
    expect(result.transformed).toBe('{"a":1}')
    expect(result.warning).toMatch(/missing outputTransformPath/)
  })

  it('falls back with a warning when JSON cannot be parsed', () => {
    const result = applyOutputTransform({ outputTransform: 'json-path', outputTransformPath: 'a' }, 'not json')
    expect(result.transformed).toBe('not json')
    expect(result.warning).toMatch(/could not parse output as JSON/)
  })

  it('falls back with a warning when the json-path does not resolve', () => {
    const result = applyOutputTransform({ outputTransform: 'json-path', outputTransformPath: 'missing.deep.0' }, '{"a":1}')
    expect(result.transformed).toBe('{"a":1}')
    expect(result.warning).toMatch(/did not resolve/)
  })
})
