import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Skill } from '@/types'
import { installSkillFromRegistry, uninstallSkill } from './skillMarketplace'

describe('skillMarketplace', () => {
  beforeEach(() => {
    vi.mocked(window.electron.invoke).mockReset()
  })

  it('deletes skill directories when a skillRoot is present', async () => {
    vi.mocked(window.electron.invoke).mockResolvedValue({ success: true })

    const result = await uninstallSkill({
      id: 'skill-dir',
      name: 'Directory Skill',
      description: 'Stored in a skill directory',
      type: 'custom',
      enabled: true,
      content: 'content',
      source: 'registry',
      context: 'inline',
      frontmatter: { name: 'Directory Skill', description: 'Stored in a skill directory' },
      skillRoot: '/workspace/skills/directory-skill',
      filePath: '/workspace/skills/directory-skill/SKILL.md',
    } as Skill)

    expect(result).toBe(true)
    expect(window.electron.invoke).toHaveBeenCalledWith('fs:deleteDir', '/workspace/skills/directory-skill')
  })

  it('falls back to deleting a single skill file when there is no skillRoot', async () => {
    vi.mocked(window.electron.invoke).mockResolvedValue({ success: true })

    const result = await uninstallSkill({
      id: 'skill-file',
      name: 'Single File Skill',
      description: 'Stored as one markdown file',
      type: 'custom',
      enabled: true,
      content: 'content',
      source: 'registry',
      context: 'inline',
      frontmatter: { name: 'Single File Skill', description: 'Stored as one markdown file' },
      filePath: '/workspace/skills/single-file-skill.md',
    } as Skill)

    expect(result).toBe(true)
    expect(window.electron.invoke).toHaveBeenCalledWith('fs:deleteFile', '/workspace/skills/single-file-skill.md')
  })

  it('installs all files from a GitHub skill directory', async () => {
    vi.mocked(window.electron.invoke).mockImplementation(async (channel, firstArg) => {
      if (channel === 'system:ensureDirectory') return { success: true }
      if (channel === 'fs:writeFile') return { success: true }
      if (channel === 'web:fetch' && firstArg === 'https://api.github.com/repos/anthropics/skills/contents/skills/skill-creator') {
        return {
          content: JSON.stringify([
            { name: 'SKILL.md', path: 'skills/skill-creator/SKILL.md', type: 'file', download_url: 'https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/SKILL.md' },
            { name: 'references', path: 'skills/skill-creator/references', type: 'dir' },
          ]),
        }
      }
      if (channel === 'web:fetch' && firstArg === 'https://api.github.com/repos/anthropics/skills/contents/skills/skill-creator/references') {
        return {
          content: JSON.stringify([
            { name: 'schemas.md', path: 'skills/skill-creator/references/schemas.md', type: 'file', download_url: 'https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/references/schemas.md' },
          ]),
        }
      }
      if (channel === 'web:fetchText' && firstArg === 'https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/SKILL.md') {
        return { content: '---\nname: skill-creator\ndescription: Creates skills\n---\n\nUse references.' }
      }
      if (channel === 'web:fetchText' && firstArg === 'https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/references/schemas.md') {
        return { content: '# Schemas' }
      }
      return { error: `unexpected ${channel}:${firstArg}` }
    })

    const installed = await installSkillFromRegistry({
      id: 'skills-sh/anthropics/skills/skill-creator',
      name: 'skill-creator',
      description: 'Create skills',
      author: 'anthropics',
      version: '1.0.0',
      repository: 'anthropics/skills',
      sourceId: 'skills-sh',
      downloads: 1,
      rating: 5,
      installed: false,
    }, '/workspace/.suora/skills')

    expect(installed?.skillRoot).toBe('/workspace/.suora/skills/skill-creator')
    expect(installed?.bundledResources).toEqual([
      { path: 'references/schemas.md', type: 'file' },
    ])
    expect(installed?.referenceFiles).toEqual([
      { path: '/workspace/.suora/skills/skill-creator/references/schemas.md', label: 'references/schemas.md' },
    ])
    expect(window.electron.invoke).toHaveBeenCalledWith('system:ensureDirectory', '/workspace/.suora/skills/skill-creator/references')
    expect(window.electron.invoke).toHaveBeenCalledWith('fs:writeFile', '/workspace/.suora/skills/skill-creator/references/schemas.md', '# Schemas')
  })
})
