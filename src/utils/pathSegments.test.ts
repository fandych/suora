import { describe, expect, it } from 'vitest'
import { safePathSegment } from './pathSegments'

describe('safePathSegment', () => {
  it('removes path traversal and separators from file-name segments', () => {
    expect(safePathSegment('../session-1')).toBe('session-1')
    expect(safePathSegment('..\\agent-1')).toBe('agent-1')
    expect(safePathSegment('valid.id_1')).toBe('valid.id_1')
  })

  it('falls back when a value cannot produce a safe segment', () => {
    expect(safePathSegment('...', 'fallback')).toBe('fallback')
    expect(safePathSegment('///', 'fallback')).toBe('fallback')
  })
})