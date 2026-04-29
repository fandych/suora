import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Skill } from '@/types'
import { installSkillFromRegistry, previewSkillInstall, uninstallSkill } from './skillMarketplace'

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
      { path: 'references', type: 'directory' },
      expect.objectContaining({ path: 'references/schemas.md', type: 'file', size: 9, hash: expect.any(String) }),
    ])
    expect(installed?.installInfo?.manifestHash).toEqual(expect.any(String))
    expect(installed?.installInfo?.trustedSource).toBe(true)
    expect(installed?.installInfo?.installLog).toContain('Downloaded references/schemas.md')
    expect(installed?.referenceFiles).toEqual([
      { path: '/workspace/.suora/skills/skill-creator/references/schemas.md', label: 'references/schemas.md' },
    ])
    expect(window.electron.invoke).toHaveBeenCalledWith('system:ensureDirectory', '/workspace/.suora/skills/skill-creator/references')
    expect(window.electron.invoke).toHaveBeenCalledWith('fs:writeFile', '/workspace/.suora/skills/skill-creator/references/schemas.md', '# Schemas')
  })

  it('previews registry installation with resources, size, hash, and script warnings', async () => {
    vi.mocked(window.electron.invoke).mockImplementation(async (channel, firstArg) => {
      if (channel === 'web:fetch' && firstArg === 'https://api.github.com/repos/anthropics/skills/contents/skills/skill-creator') {
        return {
          content: JSON.stringify([
            { name: 'SKILL.md', path: 'skills/skill-creator/SKILL.md', type: 'file', size: 64, download_url: 'https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/SKILL.md' },
            { name: 'scripts', path: 'skills/skill-creator/scripts', type: 'dir' },
          ]),
        }
      }
      if (channel === 'web:fetch' && firstArg === 'https://api.github.com/repos/anthropics/skills/contents/skills/skill-creator/scripts') {
        return {
          content: JSON.stringify([
            { name: 'bench.py', path: 'skills/skill-creator/scripts/bench.py', type: 'file', size: 12, download_url: 'https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/scripts/bench.py' },
          ]),
        }
      }
      return { error: `unexpected ${channel}:${firstArg}` }
    })

    const preview = await previewSkillInstall({
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
    })

    expect(preview?.fileCount).toBe(2)
    expect(preview?.directoryCount).toBe(1)
    expect(preview?.totalBytes).toBe(76)
    expect(preview?.trustedSource).toBe(true)
    expect(preview?.manifestHash).toEqual(expect.any(String))
    expect(preview?.warnings).toContain('Executable script detected: scripts/bench.py')
  })

  it('returns null when a bundled file download fails and includes the failing path in the loggable error', async () => {
    vi.mocked(window.electron.invoke).mockImplementation(async (channel, firstArg) => {
      if (channel === 'system:ensureDirectory') return { success: true }
      if (channel === 'web:fetch' && firstArg === 'https://api.github.com/repos/anthropics/skills/contents/skills/skill-creator') {
        return {
          content: JSON.stringify([
            { name: 'SKILL.md', path: 'skills/skill-creator/SKILL.md', type: 'file', download_url: 'https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/SKILL.md' },
          ]),
        }
      }
      if (channel === 'web:fetchText') return { error: 'network failed' }
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

    expect(installed).toBeNull()
  })

  it('returns null when a partial file write fails during installation', async () => {
    vi.mocked(window.electron.invoke).mockImplementation(async (channel, firstArg, secondArg) => {
      if (channel === 'system:ensureDirectory') return { success: true }
      if (channel === 'fs:writeFile' && typeof firstArg === 'string' && firstArg.endsWith('/SKILL.md')) return { success: true }
      if (channel === 'fs:writeFile' && typeof firstArg === 'string' && firstArg.endsWith('/references/schemas.md')) return { error: 'disk full' }
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
      if (channel === 'web:fetchText' && typeof firstArg === 'string' && firstArg.endsWith('/SKILL.md')) {
        return { content: '---\nname: skill-creator\ndescription: Creates skills\n---\n\nUse references.' }
      }
      if (channel === 'web:fetchText' && typeof firstArg === 'string' && firstArg.endsWith('/references/schemas.md')) {
        return { content: '# Schemas' }
      }
      return { error: `unexpected ${channel}:${firstArg}:${secondArg}` }
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

    expect(installed).toBeNull()
    expect(window.electron.invoke).toHaveBeenCalledWith('fs:writeFile', '/workspace/.suora/skills/skill-creator/SKILL.md', expect.any(String))
  })

  it('rejects registry previews for too many files, too large skills, and overly deep directories', async () => {
    const entry = {
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
    }

    vi.mocked(window.electron.invoke).mockResolvedValueOnce({
      content: JSON.stringify(Array.from({ length: 151 }, (_, index) => ({
        name: `file-${index}.md`,
        path: `skills/skill-creator/file-${index}.md`,
        type: 'file',
        size: 1,
      }))),
    })
    await expect(previewSkillInstall(entry)).resolves.toBeNull()

    vi.mocked(window.electron.invoke).mockReset()
    vi.mocked(window.electron.invoke).mockResolvedValueOnce({
      content: JSON.stringify([
        { name: 'SKILL.md', path: 'skills/skill-creator/SKILL.md', type: 'file', size: 4 * 1024 * 1024 + 1 },
      ]),
    })
    await expect(previewSkillInstall(entry)).resolves.toBeNull()

    vi.mocked(window.electron.invoke).mockReset()
    vi.mocked(window.electron.invoke).mockImplementation(async (channel, firstArg) => {
      if (channel !== 'web:fetch') return { error: `unexpected ${channel}:${firstArg}` }
      const path = String(firstArg).split('/contents/')[1]
      const depth = path.split('/').length - 2
      return {
        content: JSON.stringify([
          { name: `d${depth}`, path: `${path}/d${depth}`, type: 'dir' },
        ]),
      }
    })
    await expect(previewSkillInstall(entry)).resolves.toBeNull()
  })
})
