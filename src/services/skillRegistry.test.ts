import { describe, expect, it } from 'vitest'
import { parseSkillMarkdown, serializeSkillToMarkdown } from './skillRegistry'

describe('skillRegistry', () => {
  it('parses block scalars and dash lists from skill frontmatter', () => {
    const raw = `---
name: review-skill
description: "Handles: code review"
allowed-tools:
  - read_file
  - write_file
when_to_use: |
  When the user asks for a review.
  Include code risks and regressions.
argument-hint: >
  Ask for the target
  repository path.
user-invocable: false
---

## Instructions
Review the code carefully.
`

    const skill = parseSkillMarkdown(raw, '/skills/review/SKILL.md', 'project')

    expect(skill?.allowedTools).toEqual(['read_file', 'write_file'])
    expect(skill?.whenToUse).toBe('When the user asks for a review.\nInclude code risks and regressions.')
    expect(skill?.frontmatter.argumentHint).toBe('Ask for the target repository path.')
    expect(skill?.frontmatter.userInvocable).toBe(false)
  })

  it('serializes multiline fields into valid YAML block scalars', () => {
    const raw = `---
name: planning-skill
description: Planning helper
when_to_use: |
  First line.
  Second line.
allowed-tools:
  - read_file
  - grep_search
---

Plan carefully.
`

    const skill = parseSkillMarkdown(raw, '/skills/planning/SKILL.md', 'project')
    expect(skill).not.toBeNull()
    if (!skill) throw new Error('Expected parsed skill')

    const serialized = serializeSkillToMarkdown(skill)
    expect(serialized).toContain('when_to_use: |')
    expect(serialized).toContain('allowed-tools:')

    const reparsed = parseSkillMarkdown(serialized, '/skills/planning/SKILL.md', 'project')
    expect(reparsed?.whenToUse).toBe('First line.\nSecond line.')
    expect(reparsed?.allowedTools).toEqual(['read_file', 'grep_search'])
  })
})