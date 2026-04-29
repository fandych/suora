/**
 * Skill Registry — loads, parses, and manages SKILL.md files from multiple sources.
 *
 * Architecture aligned with:
 * - Claude Code: prompt-based skills with YAML frontmatter
 * - skills.sh: open agent skills ecosystem (GitHub repos)
 * - Open Agent Skills spec (agentskills.io)
 *
 * Skills are SKILL.md files with:
 *   ---
 *   name: my-skill
 *   description: What this skill does
 *   ---
 *   Markdown instructions for the agent...
 *
 * No tool specification needed — agents decide which tools to use autonomously.
 */

import type { Skill, SkillSource, SkillFrontmatter, SkillExecutionContext, SkillBundledResource, SkillReferenceFile } from '@/types'
import { logger } from '@/services/logger'
import { safeParse } from '@/utils/safeJson'
import { safePathSegment } from '@/utils/pathSegments'

export type ElectronBridge = { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> }
type DirEntry = { name: string; isDirectory: boolean; path: string; size?: number }

const MAX_BUNDLED_RESOURCE_ENTRIES = 300
const REFERENCE_FILE_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.json', '.yaml', '.yml', '.csv'])

function getElectron(): ElectronBridge | undefined {
  return (window as unknown as { electron?: ElectronBridge }).electron
}

type SkillMetaValue = string | string[] | boolean | number

function stripInlineComment(value: string): string {
  let quote: '"' | '\'' | null = null
  let escaped = false

  for (let i = 0; i < value.length; i++) {
    const char = value[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (quote) {
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === quote) quote = null
      continue
    }

    if (char === '"' || char === '\'') {
      quote = char
      continue
    }

    if (char === '#' && (i === 0 || /\s/.test(value[i - 1]))) {
      return value.slice(0, i).trimEnd()
    }
  }

  return value
}

function parseQuotedString(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value)
    } catch {
      return value.slice(1, -1)
    }
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'")
  }

  return value
}

function splitInlineArrayItems(value: string): string[] {
  const items: string[] = []
  let current = ''
  let quote: '"' | '\'' | null = null
  let escaped = false

  for (const char of value) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\' && quote === '"') {
      current += char
      escaped = true
      continue
    }

    if (quote) {
      if (char === quote) quote = null
      current += char
      continue
    }

    if (char === '"' || char === '\'') {
      quote = char
      current += char
      continue
    }

    if (char === ',') {
      const item = current.trim()
      if (item) items.push(parseQuotedString(stripInlineComment(item).trim()))
      current = ''
      continue
    }

    current += char
  }

  const lastItem = current.trim()
  if (lastItem) items.push(parseQuotedString(stripInlineComment(lastItem).trim()))
  return items
}

function parseScalarValue(rawValue: string): SkillMetaValue {
  const value = stripInlineComment(rawValue).trim()

  if (!value) return ''

  if (value.startsWith('[') && value.endsWith(']')) {
    return splitInlineArrayItems(value.slice(1, -1))
  }

  if (value === 'true') return true
  if (value === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)

  return parseQuotedString(value)
}

function collectIndentedBlock(lines: string[], startIndex: number, baseIndent: number): { lines: string[]; nextIndex: number } {
  const blockLines: string[] = []
  let nextIndex = startIndex
  let minIndent = Number.POSITIVE_INFINITY

  for (; nextIndex < lines.length; nextIndex++) {
    const line = lines[nextIndex]
    if (!line.trim()) {
      blockLines.push('')
      continue
    }

    const indent = line.match(/^\s*/)?.[0].length ?? 0
    if (indent <= baseIndent) break

    minIndent = Math.min(minIndent, indent)
    blockLines.push(line)
  }

  if (!blockLines.length || minIndent === Number.POSITIVE_INFINITY) {
    return { lines: [], nextIndex }
  }

  return {
    lines: blockLines.map((line) => line.trim() ? line.slice(minIndent) : ''),
    nextIndex,
  }
}

function parseYamlFrontmatter(yamlBlock: string): Record<string, SkillMetaValue> {
  const meta: Record<string, SkillMetaValue> = {}
  const lines = yamlBlock.split(/\r?\n/)

  for (let i = 0; i < lines.length;) {
    const line = lines[i]
    if (!line.trim() || line.trimStart().startsWith('#')) {
      i++
      continue
    }

    const kv = line.match(/^([ \t]*)([\w-]+):(?:\s*(.*))?$/)
    if (!kv) {
      i++
      continue
    }

    const baseIndent = kv[1].length
    const key = kv[2].trim()
    const rawValue = (kv[3] ?? '').trim()

    if (rawValue === '|' || rawValue === '>') {
      const block = collectIndentedBlock(lines, i + 1, baseIndent)
      meta[key] = rawValue === '>'
        ? block.lines.map((entry) => entry.trim()).filter(Boolean).join(' ')
        : block.lines.join('\n').replace(/\n+$/, '')
      i = block.nextIndex
      continue
    }

    if (!rawValue) {
      const block = collectIndentedBlock(lines, i + 1, baseIndent)
      const listItems = block.lines
        .filter((entry) => entry.trim())
        .map((entry) => entry.trim())

      if (listItems.length > 0 && listItems.every((entry) => entry.startsWith('- '))) {
        meta[key] = listItems.map((entry) => parseQuotedString(stripInlineComment(entry.slice(2)).trim()))
        i = block.nextIndex
        continue
      }

      meta[key] = ''
      i++
      continue
    }

    meta[key] = parseScalarValue(rawValue)
    i++
  }

  return meta
}

function formatInlineYamlString(value: string): string {
  if (!value) return '""'

  const needsQuotes = /[:#\[\]\{\},]|^\s|\s$|^(true|false|null|yes|no|on|off|-?\d+(\.\d+)?)$/i.test(value)
  return needsQuotes ? JSON.stringify(value) : value
}

function pushYamlStringField(lines: string[], key: string, value?: string): void {
  if (!value) return

  if (value.includes('\n')) {
    lines.push(`${key}: |`)
    for (const line of value.split('\n')) {
      lines.push(`  ${line}`)
    }
    return
  }

  lines.push(`${key}: ${formatInlineYamlString(value)}`)
}

function pushYamlArrayField(lines: string[], key: string, values?: string[]): void {
  if (!values?.length) return

  lines.push(`${key}:`)
  for (const value of values) {
    lines.push(`  - ${formatInlineYamlString(value)}`)
  }
}

// ─── SKILL.md Parser ───────────────────────────────────────────────

/**
 * Parse a SKILL.md file into a Skill object.
 *
 * Format:
 * ```md
 * ---
 * name: my-skill
 * description: What this skill does
 * whenToUse: When the user asks about X
 * allowedTools: [read_file, write_file]
 * version: 1.0.0
 * author: Me
 * icon: lucide:code
 * category: Development
 * context: inline
 * ---
 *
 * ## Instructions
 * Markdown body becomes the skill's prompt content.
 * ```
 */
export function parseSkillMarkdown(
  raw: string,
  filePath: string,
  source: SkillSource,
): Skill | null {
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/)
  if (!fmMatch) return null

  const yamlBlock = fmMatch[1]
  const markdownBody = fmMatch[2].trim()
  const meta = parseYamlFrontmatter(yamlBlock)

  // Required fields
  const name = typeof meta.name === 'string'
    ? meta.name
    : filePath.split(/[/\\]/).pop()?.replace(/\.md$/, '') || 'unnamed'

  const description = typeof meta.description === 'string'
    ? meta.description
    : ''

  if (!name || !description) {
    logger.warn(`[skillRegistry] Skill at ${filePath} missing required name or description`)
    return null
  }

  const id = generateSkillId(name, source, filePath)

  const frontmatter: SkillFrontmatter = {
    name,
    description,
    allowedTools: Array.isArray(meta['allowed-tools'] ?? meta.allowedTools)
      ? (meta['allowed-tools'] ?? meta.allowedTools) as string[]
      : undefined,
    whenToUse: typeof (meta['when_to_use'] ?? meta.whenToUse) === 'string'
      ? (meta['when_to_use'] ?? meta.whenToUse) as string
      : undefined,
    argumentHint: typeof (meta['argument-hint'] ?? meta.argumentHint) === 'string'
      ? (meta['argument-hint'] ?? meta.argumentHint) as string
      : undefined,
    arguments: Array.isArray(meta.arguments) ? meta.arguments as string[] : undefined,
    version: typeof meta.version === 'string' ? meta.version : undefined,
    userInvocable: typeof (meta['user-invocable'] ?? meta.userInvocable) === 'boolean'
      ? (meta['user-invocable'] ?? meta.userInvocable) as boolean
      : true,
    context: (meta.context === 'fork' ? 'fork' : 'inline') as SkillExecutionContext,
    agent: typeof meta.agent === 'string' ? meta.agent : undefined,
    icon: typeof meta.icon === 'string' ? meta.icon : undefined,
    category: typeof meta.category === 'string' ? meta.category : undefined,
    author: typeof meta.author === 'string' ? meta.author : undefined,
  }

  return {
    id,
    name,
    description,
    enabled: meta.enabled !== false,
    source,
    content: markdownBody,
    frontmatter,
    allowedTools: frontmatter.allowedTools,
    whenToUse: frontmatter.whenToUse,
    context: frontmatter.context ?? 'inline',
    filePath,
    skillRoot: filePath.replace(/[/\\][^/\\]+$/, ''),
    icon: frontmatter.icon,
    category: frontmatter.category,
    author: frontmatter.author,
    version: frontmatter.version,
  }
}

/**
 * Generate a stable skill ID from its name, source, and file path.
 */
function generateSkillId(name: string, source: SkillSource, filePath: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  // Use path hash for uniqueness when same name exists in different sources
  const pathHash = simpleHash(filePath).toString(36)
  return `${source}-${slug}-${pathHash}`
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32bit integer
  }
  return Math.abs(hash)
}

function normalizeResourcePath(pathValue: string): string {
  return pathValue.replace(/\\/g, '/').replace(/^\/+/, '')
}

function joinSkillResourcePath(skillRoot: string, resourcePath: string): string {
  return `${skillRoot.replace(/[\\/]+$/, '')}/${normalizeResourcePath(resourcePath)}`
}

function isAbsolutePath(pathValue: string): boolean {
  return pathValue.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(pathValue)
}

function getFileExtension(filePath: string): string {
  const name = filePath.split('/').pop() ?? ''
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index).toLowerCase() : ''
}

function isRootSkillMarkdown(relativePath: string): boolean {
  return normalizeResourcePath(relativePath).toLowerCase() === 'skill.md'
}

function isReferenceResource(resource: SkillBundledResource): boolean {
  if (resource.type !== 'file') return false
  const normalized = normalizeResourcePath(resource.path).toLowerCase()
  return normalized.startsWith('references/') && REFERENCE_FILE_EXTENSIONS.has(getFileExtension(normalized))
}

function buildReferenceFilesFromResources(
  skillRoot: string,
  resources: SkillBundledResource[],
): SkillReferenceFile[] {
  return resources
    .filter(isReferenceResource)
    .map((resource) => ({
      path: joinSkillResourcePath(skillRoot, resource.path),
      label: resource.path,
    }))
}

async function collectBundledResources(
  electron: ElectronBridge,
  currentDir: string,
  relativeBase = '',
  remainingEntries = { count: MAX_BUNDLED_RESOURCE_ENTRIES },
): Promise<SkillBundledResource[]> {
  if (remainingEntries.count <= 0) return []

  const entries = (await electron.invoke('fs:listDir', currentDir)) as DirEntry[] | { error: string }
  if (!Array.isArray(entries)) {
    if (entries?.error) {
      logger.warn(`[skillRegistry] Failed to list bundled resources in ${currentDir}`, { error: entries.error })
    }
    return []
  }

  const resources: SkillBundledResource[] = []
  for (const entry of entries) {
    if (remainingEntries.count <= 0) break

    const relativePath = normalizeResourcePath(`${relativeBase}${entry.name}`)
    if (isRootSkillMarkdown(relativePath)) continue

    resources.push({
      path: relativePath,
      type: entry.isDirectory ? 'directory' : 'file',
      ...(typeof entry.size === 'number' ? { size: entry.size } : {}),
    })
    remainingEntries.count--

    if (entry.isDirectory) {
      const nested = await collectBundledResources(
        electron,
        entry.path,
        `${relativePath}/`,
        remainingEntries,
      )
      resources.push(...nested)
    }
  }

  return resources
}

export async function attachBundledResources(
  electron: ElectronBridge,
  skill: Skill,
  skillRoot: string,
): Promise<Skill> {
  const bundledResources = await collectBundledResources(electron, skillRoot)
  const referenceFiles = buildReferenceFilesFromResources(skillRoot, bundledResources)

  return {
    ...skill,
    skillRoot,
    bundledResources,
    referenceFiles: [
      ...(skill.referenceFiles ?? []),
      ...referenceFiles,
    ],
  }
}

// ─── Skill Loading from Directories ────────────────────────────────

/**
 * Load all SKILL.md files from a directory.
 * Supports both flat files and subdirectory-based skills:
 *   skills/my-skill/SKILL.md
 *   skills/my-skill.md
 */
async function loadSkillsFromDirectory(
  electron: ElectronBridge,
  dir: string,
  source: SkillSource,
): Promise<Skill[]> {
  try {
    const entries = (await electron.invoke('fs:listDir', dir)) as
      | DirEntry[]
      | { error: string }

    if (!Array.isArray(entries)) return []

    const skills: Skill[] = []

    for (const entry of entries) {
      // Subdirectory: look for SKILL.md inside
      if (entry.isDirectory) {
        const skillMdPath = `${entry.path}/SKILL.md`
        try {
          const raw = await electron.invoke('fs:readFile', skillMdPath)
          if (typeof raw === 'string') {
            const skill = parseSkillMarkdown(raw, skillMdPath, source)
            if (skill) {
              skills.push(await attachBundledResources(electron, skill, entry.path))
            }
          }
        } catch {
          // Try lowercase
          const skillMdPathLower = `${entry.path}/skill.md`
          try {
            const raw = await electron.invoke('fs:readFile', skillMdPathLower)
            if (typeof raw === 'string') {
              const skill = parseSkillMarkdown(raw, skillMdPathLower, source)
              if (skill) {
                skills.push(await attachBundledResources(electron, skill, entry.path))
              }
            }
          } catch {
            // Not a skill directory
          }
        }
        continue
      }

      // Flat .md file
      if (entry.name.endsWith('.md')) {
        try {
          const raw = await electron.invoke('fs:readFile', entry.path)
          if (typeof raw === 'string') {
            const skill = parseSkillMarkdown(raw, entry.path, source)
            if (skill) skills.push(skill)
          }
        } catch (err) {
          logger.warn(`[skillRegistry] Failed to parse: ${entry.path}`, {
            error: err instanceof Error ? err.message : String(err),
          })
        }
        continue
      }

      // Legacy JSON format support (backward compatibility)
      if (entry.name.endsWith('.json')) {
        try {
          const raw = await electron.invoke('fs:readFile', entry.path)
          if (typeof raw === 'string') {
            const legacy = safeParse<Record<string, unknown>>(raw)
            const skill = migrateLegacySkill(legacy, entry.path, source)
            if (skill) skills.push(skill)
          }
        } catch {
          // Skip corrupt files
        }
      }
    }

    return skills
  } catch {
    return []
  }
}

/**
 * Migrate a legacy JSON skill to the new format.
 */
function migrateLegacySkill(
  legacy: Record<string, unknown>,
  filePath: string,
  source: SkillSource,
): Skill | null {
  const name = typeof legacy.name === 'string' ? legacy.name : ''
  const description = typeof legacy.description === 'string' ? legacy.description : ''
  if (!name) return null

  const id = typeof legacy.id === 'string'
    ? legacy.id
    : generateSkillId(name, source, filePath)

  return {
    id,
    name,
    description,
    enabled: legacy.enabled !== false,
    source,
    content: typeof legacy.prompt === 'string' ? legacy.prompt : '',
    frontmatter: { name, description },
    context: 'inline',
    filePath,
    icon: typeof legacy.icon === 'string' ? legacy.icon : undefined,
    category: typeof legacy.category === 'string' ? legacy.category : undefined,
    author: typeof legacy.author === 'string' ? legacy.author : undefined,
    version: typeof legacy.version === 'string' ? legacy.version : undefined,
  }
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Load all local skills from the workspace skills/ directory.
 */
export async function loadLocalSkills(workspacePath: string): Promise<Skill[]> {
  const electron = getElectron()
  if (!electron || !workspacePath) return []
  return loadSkillsFromDirectory(electron, `${workspacePath}/skills`, 'local')
}

/**
 * Load skills from project-level directories:
 * - .agents/skills/
 * - .claude/skills/
 * - .suora/skills/
 */
export async function loadProjectSkills(workspacePath: string): Promise<Skill[]> {
  const electron = getElectron()
  if (!electron || !workspacePath) return []

  const dirs = [
    `${workspacePath}/.agents/skills`,
    `${workspacePath}/.claude/skills`,
    `${workspacePath}/.suora/skills`,
  ]

  const results = await Promise.all(
    dirs.map((dir) => loadSkillsFromDirectory(electron, dir, 'project'))
  )

  return results.flat()
}

/**
 * Load skills from user-level global directory (~/.suora/skills/).
 */
export async function loadUserSkills(): Promise<Skill[]> {
  const electron = getElectron()
  if (!electron) return []

  try {
    const homePath = (await electron.invoke('system:homePath')) as string
    if (!homePath) return []
    return loadSkillsFromDirectory(electron, `${homePath}/.suora/skills`, 'user')
  } catch {
    return []
  }
}

/**
 * Load all skills from all sources (local + project + user).
 */
export async function loadAllSkills(workspacePath: string): Promise<Skill[]> {
  const [local, project, user] = await Promise.all([
    loadLocalSkills(workspacePath),
    loadProjectSkills(workspacePath),
    loadUserSkills(),
  ])

  // Deduplicate by name (project skills take precedence over user skills)
  const seen = new Map<string, Skill>()
  for (const skill of [...user, ...project, ...local]) {
    seen.set(skill.name.toLowerCase(), skill)
  }

  return Array.from(seen.values())
}

/**
 * Save a skill to disk as a SKILL.md file.
 */
export async function saveSkillToDisk(
  dirPath: string,
  skill: Skill,
): Promise<boolean> {
  const electron = getElectron()
  if (!electron) return false

  try {
    // Create directory
    const slug = safePathSegment(skill.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-'), 'skill')
    const skillDir = `${dirPath}/${slug}`
    const ensureResult = await electron.invoke('system:ensureDirectory', skillDir) as { error?: string }
    if (ensureResult?.error) return false

    // Build SKILL.md content
    const md = serializeSkillToMarkdown(skill)

    const result = (await electron.invoke(
      'fs:writeFile',
      `${skillDir}/SKILL.md`,
      md,
    )) as { success?: boolean; error?: string }

    return result?.success === true && !result.error
  } catch (err) {
    logger.error('[skillRegistry] Failed to save skill', {
      error: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}

/**
 * Delete a skill from disk.
 */
export async function deleteSkillFromDisk(filePath: string): Promise<boolean> {
  const electron = getElectron()
  if (!electron || !filePath) return false

  try {
    // If it's a SKILL.md inside a directory, delete the whole directory
    const isInSubdir = filePath.endsWith('/SKILL.md') || filePath.endsWith('\\SKILL.md')
    const pathToDelete = isInSubdir ? filePath.replace(/[/\\]SKILL\.md$/, '') : filePath

    const channel = isInSubdir ? 'fs:deleteDir' : 'fs:deleteFile'
    const result = (await electron.invoke(channel, pathToDelete)) as { success?: boolean }
    return result?.success ?? false
  } catch {
    return false
  }
}

/**
 * Create a new blank skill template.
 */
export function createBlankSkill(name: string, source: SkillSource = 'local'): Skill {
  const id = generateSkillId(name, source, `new-${Date.now()}`)
  return {
    id,
    name,
    description: '',
    enabled: true,
    source,
    content: `# ${name}\n\nDescribe the instructions for this skill here.\n\n## When to Use\n\nDescribe when this skill should be activated.\n\n## Steps\n\n1. First, do this\n2. Then, do that`,
    frontmatter: {
      name,
      description: '',
    },
    context: 'inline',
  }
}

/**
 * Serialize a Skill object back to SKILL.md format.
 */
export function serializeSkillToMarkdown(skill: Skill): string {
  const lines: string[] = ['---']

  pushYamlStringField(lines, 'name', skill.name)
  pushYamlStringField(lines, 'description', skill.description)
  pushYamlArrayField(lines, 'allowed-tools', skill.allowedTools)
  pushYamlStringField(lines, 'when_to_use', skill.whenToUse)
  pushYamlStringField(lines, 'version', skill.version)
  pushYamlStringField(lines, 'author', skill.author)
  pushYamlStringField(lines, 'icon', skill.icon)
  pushYamlStringField(lines, 'category', skill.category)
  if (skill.context && skill.context !== 'inline') lines.push(`context: ${skill.context}`)
  pushYamlStringField(lines, 'argument-hint', skill.frontmatter.argumentHint)
  pushYamlArrayField(lines, 'arguments', skill.frontmatter.arguments)
  if (skill.frontmatter.userInvocable === false) lines.push(`user-invocable: false`)

  lines.push('---')
  lines.push('')
  lines.push(skill.content || '')

  return lines.join('\n')
}

/**
 * Generate the system prompt contribution for assigned skills.
 * Each enabled skill's content is wrapped in a section and injected.
 */
export async function buildSkillPrompts(
  skillIds: string[],
  allSkills: Skill[],
): Promise<string> {
  const parts: string[] = []

  for (const skillId of skillIds) {
    const skill = allSkills.find((s) => s.id === skillId)
    if (!skill?.enabled) continue
    if (!skill.content?.trim()) continue

    const lines: string[] = []
    lines.push(skill.content.trim())

    // Load reference files
    if (skill.referenceFiles?.length) {
      const electron = getElectron()
      if (electron) {
        for (const ref of skill.referenceFiles) {
          try {
            const refPath = isAbsolutePath(ref.path)
              ? ref.path
              : skill.skillRoot
                ? joinSkillResourcePath(skill.skillRoot, ref.path)
                : ref.path
            const content = await electron.invoke('fs:readFile', refPath) as string | { error: string }
            if (typeof content === 'string' && content.trim()) {
              const label = ref.label || ref.path.split(/[/\\]/).pop() || 'Reference'
              lines.push(`### ${label}\n\n${content.trim()}`)
            }
          } catch {
            logger.warn(`[skillRegistry] Failed to read reference: ${ref.path}`)
          }
        }
      }
    }

    if (skill.bundledResources?.length) {
      const manifest = skill.bundledResources
        .slice(0, 80)
        .map((resource) => `- ${resource.path}${resource.type === 'directory' ? '/' : ''}`)
        .join('\n')
      const rootHint = skill.skillRoot ? `Skill root: ${skill.skillRoot}\n` : ''
      lines.push(`### Bundled resources\n\n${rootHint}Use these files and folders as needed; read only the resources relevant to the task.\n${manifest}`)
    }

    parts.push(`<skill name="${skill.name}">\n${lines.join('\n\n')}\n</skill>`)
  }

  if (parts.length === 0) return ''
  return `\n\n${parts.join('\n\n')}`
}
