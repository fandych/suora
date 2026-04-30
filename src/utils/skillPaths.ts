/**
 * Utilities for validating and classifying paths within a folder-backed Skill.
 *
 * A Skill's bundled resources live under a small, fixed set of top-level
 * folders. Anything else is considered unsafe / disallowed.  See
 * `SkillBundledResource` in `src/types/index.ts`.
 */

/**
 * Canonical top-level folders permitted inside a Skill resource tree.
 *
 * - `scripts/`   — executable helper scripts the agent can run
 * - `references/` — reference material the agent reads (docs, prompts, …)
 * - `assets/`    — static assets bundled with the skill (images, …)
 * - `other/`     — free-form bucket for anything that does not fit above
 */
export const SKILL_TOP_LEVEL_FOLDERS = ['scripts', 'references', 'assets', 'other'] as const

export type SkillTopLevelFolder = typeof SKILL_TOP_LEVEL_FOLDERS[number]

const SKILL_TOP_LEVEL_SET: ReadonlySet<string> = new Set(SKILL_TOP_LEVEL_FOLDERS)

/** Normalize a slash-separated, optionally-Windows path to a clean POSIX path. */
export function normalizeSkillResourcePath(pathValue: string): string {
  return pathValue
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .join('/')
}

/** Returns true when the segment is one of the four allowed top-level folders. */
export function isSkillTopLevelFolder(segment: string): segment is SkillTopLevelFolder {
  return SKILL_TOP_LEVEL_SET.has(segment)
}

/**
 * Validate that a path is safe to use within a Skill resource tree:
 *  - non-empty after normalization
 *  - not absolute (Unix or Windows)
 *  - contains no `..` segments
 *  - first segment is one of the canonical top-level folders
 */
export function isSafeSkillResourcePath(pathValue: string): boolean {
  if (!pathValue) return false
  if (pathValue.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(pathValue)) return false
  const normalized = normalizeSkillResourcePath(pathValue)
  if (!normalized) return false
  const segments = normalized.split('/')
  if (segments.includes('..') || segments.includes('.')) return false
  if (!isSkillTopLevelFolder(segments[0])) return false
  return true
}

// ─── File kind classification ─────────────────────────────────────────────

export type SkillFileKind = 'markdown' | 'script' | 'data' | 'image' | 'binary'

interface SkillFileKindInfo {
  /** Whether the file content can be edited as plain text in the editor. */
  editable: boolean
  /** Iconify icon name to render in the tree. */
  icon: string
  /** Default content snippet inserted when creating a new file of this kind. */
  defaultContent: string
}

const FILE_KIND_INFO: Record<SkillFileKind, SkillFileKindInfo> = {
  markdown: { editable: true, icon: 'lucide:file-text', defaultContent: '' },
  script: { editable: true, icon: 'lucide:file-terminal', defaultContent: '' },
  data: { editable: true, icon: 'lucide:file-code', defaultContent: '' },
  image: { editable: false, icon: 'lucide:image', defaultContent: '' },
  binary: { editable: false, icon: 'lucide:file', defaultContent: '' },
}

const MARKDOWN_EXT = new Set(['md', 'mdx', 'txt', 'markdown'])
const SCRIPT_EXT = new Set(['sh', 'bash', 'zsh', 'py', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'rb', 'pl'])
const DATA_EXT = new Set(['json', 'yaml', 'yml', 'toml', 'csv', 'tsv', 'xml', 'ini', 'env', 'conf'])
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'])

/** Lower-cased extension without the leading dot, or empty string if none. */
export function getSkillResourceExtension(pathValue: string): string {
  const normalized = normalizeSkillResourcePath(pathValue)
  const last = normalized.split('/').pop() ?? ''
  const dotIndex = last.lastIndexOf('.')
  if (dotIndex <= 0) return ''
  return last.slice(dotIndex + 1).toLowerCase()
}

/** Classify a resource path into one of the {@link SkillFileKind} buckets. */
export function classifySkillFileKind(pathValue: string): SkillFileKind {
  const ext = getSkillResourceExtension(pathValue)
  if (!ext) return 'markdown' // extension-less files (README, LICENSE, …) treated as text
  if (MARKDOWN_EXT.has(ext)) return 'markdown'
  if (SCRIPT_EXT.has(ext)) return 'script'
  if (DATA_EXT.has(ext)) return 'data'
  if (IMAGE_EXT.has(ext)) return 'image'
  return 'binary'
}

/** Return whether the file at `pathValue` is editable as plain text. */
export function isEditableSkillFile(pathValue: string): boolean {
  return FILE_KIND_INFO[classifySkillFileKind(pathValue)].editable
}

/** Return the icon name to use for `pathValue` (does not consider folder type). */
export function getSkillFileIcon(pathValue: string, executable = false): string {
  const kind = classifySkillFileKind(pathValue)
  if (executable && kind !== 'image') return 'lucide:file-terminal'
  return FILE_KIND_INFO[kind].icon
}

/**
 * Returns true when a file at this resource path should default to being marked
 * executable (currently: anything under `scripts/`).
 */
export function isSkillResourceExecutable(pathValue: string): boolean {
  return normalizeSkillResourcePath(pathValue).toLowerCase().startsWith('scripts/')
}

/**
 * Suggested default file name when the user creates a new file inside the
 * given parent folder. Returns the bare file name (no parent path).
 */
export function getDefaultSkillFileName(parentPath: string): string {
  const top = normalizeSkillResourcePath(parentPath).split('/')[0]
  switch (top) {
    case 'scripts':
      return 'helper.sh'
    case 'references':
      return 'notes.md'
    case 'assets':
      return 'asset.txt'
    default:
      return 'file.md'
  }
}
