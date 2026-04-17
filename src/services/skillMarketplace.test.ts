import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Skill } from '@/types'
import { uninstallSkill } from './skillMarketplace'

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
})