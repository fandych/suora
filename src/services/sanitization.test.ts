import { describe, expect, it } from 'vitest'
import { sanitizeSensitiveText, sanitizeToolError } from './sanitization'

describe('sanitization', () => {
  it('redacts common secrets and absolute paths', () => {
    const output = sanitizeSensitiveText(
      'Bearer abcdefghijklmnopqrstuvwxyz123456 api_key=secretvalue123456 C:\\Users\\Fandy\\project\\file.ts /home/fandy/.env',
    )

    expect(output).toContain('Bearer ***REDACTED***')
    expect(output).toContain('api_key=***REDACTED***')
    expect(output).toContain('<...>/file.ts')
    expect(output).toContain('<...>/.env')
    expect(output).not.toContain('Fandy')
  })

  it('clamps very long tool errors', () => {
    const output = sanitizeToolError('x'.repeat(50), 12)

    expect(output).toBe('xxxxxxxxxxxx ...[+38 chars]')
  })
})
