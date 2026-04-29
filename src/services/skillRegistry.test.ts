import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSkillPrompts, deleteSkillFromDisk, loadLocalSkills, parseSkillMarkdown, saveSkillToDisk, serializeSkillToMarkdown } from './skillRegistry'

describe('skillRegistry', () => {
  beforeEach(() => {
    vi.mocked(window.electron.invoke).mockReset()
  })

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

  it('uses a fallback slug when saving skills with punctuation-only names', async () => {
    vi.mocked(window.electron.invoke).mockResolvedValue({ success: true })

    const skill = parseSkillMarkdown('---\nname: !!!\ndescription: test\n---\n\nbody', '/skills/new/SKILL.md', 'local')
    if (!skill) throw new Error('Expected parsed skill')

    await expect(saveSkillToDisk('/workspace/skills', skill)).resolves.toBe(true)
    expect(window.electron.invoke).toHaveBeenCalledWith('system:ensureDirectory', '/workspace/skills/skill')
    expect(window.electron.invoke).toHaveBeenCalledWith('fs:writeFile', '/workspace/skills/skill/SKILL.md', expect.any(String))
  })

  it('deletes directory-backed skills with fs:deleteDir', async () => {
    vi.mocked(window.electron.invoke).mockResolvedValue({ success: true })

    await expect(deleteSkillFromDisk('/workspace/skills/review/SKILL.md')).resolves.toBe(true)
    expect(window.electron.invoke).toHaveBeenCalledWith('fs:deleteDir', '/workspace/skills/review')
  })

  it('discovers bundled files and reference files for folder skills', async () => {
    vi.mocked(window.electron.invoke).mockImplementation(async (channel, filePath) => {
      if (channel === 'fs:listDir' && filePath === '/workspace/skills') {
        return [{ name: 'creator', isDirectory: true, path: '/workspace/skills/creator' }]
      }
      if (channel === 'fs:listDir' && filePath === '/workspace/skills/creator') {
        return [
          { name: 'SKILL.md', isDirectory: false, path: '/workspace/skills/creator/SKILL.md' },
          { name: 'references', isDirectory: true, path: '/workspace/skills/creator/references' },
          { name: 'scripts', isDirectory: true, path: '/workspace/skills/creator/scripts' },
        ]
      }
      if (channel === 'fs:listDir' && filePath === '/workspace/skills/creator/references') {
        return [{ name: 'schemas.md', isDirectory: false, path: '/workspace/skills/creator/references/schemas.md' }]
      }
      if (channel === 'fs:listDir' && filePath === '/workspace/skills/creator/scripts') {
        return [{ name: 'aggregate.py', isDirectory: false, path: '/workspace/skills/creator/scripts/aggregate.py' }]
      }
      if (channel === 'fs:readFile' && filePath === '/workspace/skills/creator/SKILL.md') {
        return '---\nname: skill-creator\ndescription: Creates skills\n---\n\nUse bundled resources.'
      }
      return { error: `unexpected ${channel}:${filePath}` }
    })

    const skills = await loadLocalSkills('/workspace')

    expect(skills).toHaveLength(1)
    expect(skills[0].bundledResources).toEqual([
      { path: 'references', type: 'directory' },
      { path: 'references/schemas.md', type: 'file' },
      { path: 'scripts', type: 'directory' },
      { path: 'scripts/aggregate.py', type: 'file' },
    ])
    expect(skills[0].referenceFiles).toEqual([
      { path: '/workspace/skills/creator/references/schemas.md', label: 'references/schemas.md' },
    ])
  })

  it('adds reference content and bundled resource manifest to skill prompts', async () => {
    vi.mocked(window.electron.invoke).mockImplementation(async (channel, filePath) => {
      if (channel === 'fs:readFile' && filePath === '/workspace/skills/creator/references/schemas.md') {
        return '# Schema docs'
      }
      return { error: `unexpected ${channel}:${filePath}` }
    })

    const skill = parseSkillMarkdown(
      '---\nname: skill-creator\ndescription: Creates skills\n---\n\nUse bundled resources.',
      '/workspace/skills/creator/SKILL.md',
      'local',
    )
    if (!skill) throw new Error('Expected parsed skill')
    skill.skillRoot = '/workspace/skills/creator'
    skill.referenceFiles = [{ path: 'references/schemas.md', label: 'schemas' }]
    skill.bundledResources = [
      { path: 'references/schemas.md', type: 'file' },
      { path: 'scripts/aggregate.py', type: 'file' },
    ]

    const prompt = await buildSkillPrompts([skill.id], [skill])

    expect(prompt).toContain('### schemas\n\n# Schema docs')
    expect(prompt).toContain('Skill root: /workspace/skills/creator')
    expect(prompt).toContain('- scripts/aggregate.py')
  })
})
