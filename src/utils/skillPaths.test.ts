import { describe, expect, it } from 'vitest'
import {
  SKILL_TOP_LEVEL_FOLDERS,
  classifySkillFileKind,
  getDefaultSkillFileName,
  getSkillFileIcon,
  getSkillResourceExtension,
  isEditableSkillFile,
  isSafeSkillResourcePath,
  isSkillResourceExecutable,
  isSkillTopLevelFolder,
  normalizeSkillResourcePath,
} from './skillPaths'

describe('skillPaths', () => {
  describe('SKILL_TOP_LEVEL_FOLDERS', () => {
    it('exposes exactly the four canonical folders', () => {
      expect([...SKILL_TOP_LEVEL_FOLDERS].sort()).toEqual(['assets', 'other', 'references', 'scripts'])
    })
  })

  describe('isSkillTopLevelFolder', () => {
    it.each(SKILL_TOP_LEVEL_FOLDERS)('accepts %s', (folder) => {
      expect(isSkillTopLevelFolder(folder)).toBe(true)
    })

    it('rejects unknown segments', () => {
      expect(isSkillTopLevelFolder('foo')).toBe(false)
      expect(isSkillTopLevelFolder('Scripts')).toBe(false) // case sensitive
      expect(isSkillTopLevelFolder('')).toBe(false)
    })
  })

  describe('normalizeSkillResourcePath', () => {
    it('converts back-slashes, strips leading slashes and empty segments', () => {
      expect(normalizeSkillResourcePath('\\scripts\\\\foo\\bar.sh')).toBe('scripts/foo/bar.sh')
      expect(normalizeSkillResourcePath('/scripts//bar')).toBe('scripts/bar')
      expect(normalizeSkillResourcePath('scripts/')).toBe('scripts')
    })
  })

  describe('isSafeSkillResourcePath', () => {
    it('accepts paths under each top-level folder', () => {
      expect(isSafeSkillResourcePath('scripts/run.sh')).toBe(true)
      expect(isSafeSkillResourcePath('references/intro.md')).toBe(true)
      expect(isSafeSkillResourcePath('assets/logo.png')).toBe(true)
      expect(isSafeSkillResourcePath('other/data.json')).toBe(true)
      expect(isSafeSkillResourcePath('scripts/sub/dir/run.sh')).toBe(true)
    })

    it('rejects paths whose first segment is not whitelisted', () => {
      expect(isSafeSkillResourcePath('foo/bar.sh')).toBe(false)
      expect(isSafeSkillResourcePath('Scripts/bar.sh')).toBe(false)
      expect(isSafeSkillResourcePath('SKILL.md')).toBe(false)
    })

    it('rejects absolute paths', () => {
      expect(isSafeSkillResourcePath('/scripts/run.sh')).toBe(false)
      expect(isSafeSkillResourcePath('C:\\scripts\\run.sh')).toBe(false)
    })

    it('rejects path-traversal attempts', () => {
      expect(isSafeSkillResourcePath('scripts/../etc/passwd')).toBe(false)
      expect(isSafeSkillResourcePath('scripts/./run.sh')).toBe(false)
    })

    it('rejects empty values', () => {
      expect(isSafeSkillResourcePath('')).toBe(false)
      expect(isSafeSkillResourcePath('   ')).toBe(false)
    })
  })

  describe('getSkillResourceExtension', () => {
    it('returns the lowercased extension', () => {
      expect(getSkillResourceExtension('scripts/run.SH')).toBe('sh')
      expect(getSkillResourceExtension('references/intro.md')).toBe('md')
      expect(getSkillResourceExtension('other/archive.tar.gz')).toBe('gz')
    })

    it('returns empty string when there is no extension', () => {
      expect(getSkillResourceExtension('scripts/Makefile')).toBe('')
      expect(getSkillResourceExtension('references/.hidden')).toBe('')
    })
  })

  describe('classifySkillFileKind', () => {
    it('classifies markdown / text files', () => {
      expect(classifySkillFileKind('references/x.md')).toBe('markdown')
      expect(classifySkillFileKind('references/x.txt')).toBe('markdown')
      expect(classifySkillFileKind('references/README')).toBe('markdown')
    })

    it('classifies scripts', () => {
      expect(classifySkillFileKind('scripts/run.sh')).toBe('script')
      expect(classifySkillFileKind('scripts/helper.py')).toBe('script')
      expect(classifySkillFileKind('scripts/tool.ts')).toBe('script')
    })

    it('classifies data files', () => {
      expect(classifySkillFileKind('other/config.json')).toBe('data')
      expect(classifySkillFileKind('other/config.yaml')).toBe('data')
      expect(classifySkillFileKind('other/data.csv')).toBe('data')
    })

    it('classifies images', () => {
      expect(classifySkillFileKind('assets/logo.png')).toBe('image')
      expect(classifySkillFileKind('assets/diagram.SVG')).toBe('image')
    })

    it('falls back to binary for unknown extensions', () => {
      expect(classifySkillFileKind('assets/data.bin')).toBe('binary')
      expect(classifySkillFileKind('assets/archive.zip')).toBe('binary')
    })
  })

  describe('isEditableSkillFile', () => {
    it('marks text-like kinds as editable and binary/image as not', () => {
      expect(isEditableSkillFile('references/x.md')).toBe(true)
      expect(isEditableSkillFile('scripts/run.sh')).toBe(true)
      expect(isEditableSkillFile('other/config.json')).toBe(true)
      expect(isEditableSkillFile('assets/logo.png')).toBe(false)
      expect(isEditableSkillFile('assets/file.bin')).toBe(false)
    })
  })

  describe('getSkillFileIcon', () => {
    it('returns the kind-specific icon by default', () => {
      expect(getSkillFileIcon('references/x.md')).toBe('lucide:file-text')
      expect(getSkillFileIcon('scripts/run.sh')).toBe('lucide:file-terminal')
      expect(getSkillFileIcon('other/config.json')).toBe('lucide:file-code')
      expect(getSkillFileIcon('assets/logo.png')).toBe('lucide:image')
      expect(getSkillFileIcon('assets/data.bin')).toBe('lucide:file')
    })

    it('overrides text-kind icon when the file is marked executable', () => {
      expect(getSkillFileIcon('other/run', true)).toBe('lucide:file-terminal')
      // images stay as images even if flagged executable
      expect(getSkillFileIcon('assets/logo.png', true)).toBe('lucide:image')
    })
  })

  describe('getDefaultSkillFileName', () => {
    it('returns folder-appropriate defaults', () => {
      expect(getDefaultSkillFileName('scripts')).toBe('helper.sh')
      expect(getDefaultSkillFileName('references')).toBe('notes.md')
      expect(getDefaultSkillFileName('assets')).toBe('asset.txt')
      expect(getDefaultSkillFileName('other')).toBe('file.md')
      // sub-folders pick up their top-level parent's default
      expect(getDefaultSkillFileName('scripts/sub')).toBe('helper.sh')
    })
  })

  describe('isSkillResourceExecutable', () => {
    it('marks files under scripts/ as executable, others as not', () => {
      expect(isSkillResourceExecutable('scripts/run.sh')).toBe(true)
      expect(isSkillResourceExecutable('Scripts/run.sh')).toBe(true) // case-insensitive
      expect(isSkillResourceExecutable('scripts/sub/run.py')).toBe(true)
      expect(isSkillResourceExecutable('references/intro.md')).toBe(false)
      expect(isSkillResourceExecutable('assets/logo.png')).toBe(false)
      expect(isSkillResourceExecutable('other/data.json')).toBe(false)
    })
  })
})
