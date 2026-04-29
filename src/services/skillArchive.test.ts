import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Skill } from '@/types'
import { buildSkillFromFolderFiles, exportSkillToZipBlob } from './skillArchive'

describe('skillArchive', () => {
  beforeEach(() => {
    vi.mocked(window.electron.invoke).mockReset()
  })

  it('builds a folder-backed skill import bundle from webkitRelativePath files', async () => {
    const files = [
      new File(['---\nname: folder-skill\ndescription: Folder skill\n---\n\nUse resources.'], 'SKILL.md', { type: 'text/markdown' }),
      new File(['# Docs'], 'docs.md', { type: 'text/markdown' }),
    ] as Array<File & { webkitRelativePath?: string }>
    files[0].webkitRelativePath = 'folder-skill/SKILL.md'
    files[1].webkitRelativePath = 'folder-skill/references/docs.md'

    const list = Object.assign(files, {
      item: (index: number) => files[index] ?? null,
    }) as unknown as FileList

    const bundle = await buildSkillFromFolderFiles(list)

    expect(bundle?.skillMarkdown).toContain('name: folder-skill')
    expect(bundle?.resources).toEqual([
      { path: 'references/docs.md', content: '# Docs', size: 6 },
    ])
  })

  it('exports SKILL.md and bundled files in a zip blob', async () => {
    vi.mocked(window.electron.invoke).mockImplementation(async (channel, filePath) => {
      if (channel === 'fs:readFile' && filePath === '/workspace/skills/folder/references/docs.md') return '# Docs'
      return { error: `unexpected ${channel}:${filePath}` }
    })

    const skill = {
      id: 'skill-1',
      name: 'folder-skill',
      description: 'Folder skill',
      enabled: true,
      source: 'local',
      content: 'Use resources.',
      context: 'inline',
      frontmatter: { name: 'folder-skill', description: 'Folder skill' },
      skillRoot: '/workspace/skills/folder',
      bundledResources: [{ path: 'references/docs.md', type: 'file' }],
    } as Skill

    const blob = await exportSkillToZipBlob(skill)
    const bytes = new Uint8Array(await blob.arrayBuffer())

    expect(blob.type).toBe('application/zip')
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04])
    expect(new TextDecoder().decode(bytes)).toContain('references/docs.md')
  })
})
