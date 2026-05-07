import { describe, expect, it } from 'vitest'
import { sanitizeReleaseNotesHtml } from './releaseNotes'

describe('sanitizeReleaseNotesHtml', () => {
  it('preserves common release note markup and normalizes GitHub links', () => {
    const output = sanitizeReleaseNotesHtml(`
      <h2>What's Changed</h2>
      <ul>
        <li><a href="/fandych/suora/pull/23" title="PR 23">PR 23</a></li>
      </ul>
    `)

    expect(output).toContain('<h2>What\'s Changed</h2>')
    expect(output).toContain('<ul>')
    expect(output).toContain('href="https://github.com/fandych/suora/pull/23"')
    expect(output).toContain('target="_blank"')
    expect(output).toContain('rel="noreferrer noopener"')
  })

  it('strips unsafe tags and attributes', () => {
    const output = sanitizeReleaseNotesHtml(`
      <p onclick="alert('boom')">Safe text</p>
      <script>alert('boom')</script>
      <img src="x" onerror="alert('boom')" />
      <a href="javascript:alert('boom')">blocked</a>
    `)

    expect(output).toContain('<p>Safe text</p>')
    expect(output).toContain('<a>blocked</a>')
    expect(output).not.toContain('onclick')
    expect(output).not.toContain('javascript:')
    expect(output).not.toContain('<script')
    expect(output).not.toContain('<img')
  })
})