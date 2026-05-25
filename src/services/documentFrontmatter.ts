/**
 * Document Frontmatter
 *
 * Rich YAML frontmatter parsing and serialization for structured document metadata.
 * Inspired by llm_wiki's page frontmatter model (type, tags, sources, related, etc.).
 */

export interface DocumentFrontmatter {
  title?: string
  type?: string
  tags?: string[]
  created?: string
  updated?: string
  description?: string
  sources?: string[]
  related?: string[]
  [key: string]: unknown
}

const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---/

/**
 * Parse YAML frontmatter from a markdown document.
 * Returns an object with recognized fields and any extra keys.
 */
export function parseDocumentFrontmatter(markdown: string): DocumentFrontmatter | null {
  const match = FRONTMATTER_PATTERN.exec(markdown)
  if (!match) return null

  const yaml = match[1]
  const result: DocumentFrontmatter = {}

  for (const line of yaml.split('\n')) {
    const kvMatch = /^(\w[\w-]*):\s*(.*)$/.exec(line)
    if (!kvMatch) continue

    const [, key, rawValue] = kvMatch
    const value = rawValue.trim()

    if (value.startsWith('[') && value.endsWith(']')) {
      // Inline array: [item1, item2]
      result[key] = value
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
    } else if (value.startsWith('"') && value.endsWith('"')) {
      result[key] = value.slice(1, -1)
    } else if (value.startsWith("'") && value.endsWith("'")) {
      result[key] = value.slice(1, -1)
    } else if (value === '' || value === '[]') {
      // Check for block array on subsequent lines
      result[key] = value === '[]' ? [] : ''
    } else {
      result[key] = value
    }
  }

  // Handle block-style arrays (- item)
  const blockArrayPattern = /^(\w[\w-]*):\s*\n((?:\s*-\s*.+\n?)+)/gm
  let blockMatch: RegExpExecArray | null
  while ((blockMatch = blockArrayPattern.exec(yaml)) !== null) {
    const key = blockMatch[1]
    const items = blockMatch[2]
      .split('\n')
      .map((line) => line.replace(/^\s*-\s*/, '').trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
    if (items.length > 0) {
      result[key] = items
    }
  }

  return result
}

/**
 * Extract the body content after frontmatter.
 */
export function getDocumentBody(markdown: string): string {
  const match = FRONTMATTER_PATTERN.exec(markdown)
  if (!match) return markdown
  return markdown.slice(match[0].length).replace(/^\n+/, '')
}

/**
 * Serialize frontmatter fields to a YAML frontmatter string.
 */
export function serializeDocumentFrontmatter(frontmatter: DocumentFrontmatter): string {
  const lines: string[] = ['---']

  const orderedKeys = ['type', 'title', 'description', 'tags', 'created', 'updated', 'sources', 'related']
  const extraKeys = Object.keys(frontmatter).filter((key) => !orderedKeys.includes(key))
  const allKeys = [...orderedKeys, ...extraKeys]

  for (const key of allKeys) {
    const value = frontmatter[key]
    if (value === undefined || value === null) continue

    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`)
      } else {
        lines.push(`${key}: [${value.map((v) => `"${v}"`).join(', ')}]`)
      }
    } else if (typeof value === 'string') {
      if (value.includes('"') || value.includes('\n')) {
        lines.push(`${key}: '${value}'`)
      } else {
        lines.push(`${key}: "${value}"`)
      }
    } else {
      lines.push(`${key}: ${String(value)}`)
    }
  }

  lines.push('---')
  return lines.join('\n')
}

/**
 * Update or insert frontmatter in a markdown document.
 * Merges new fields with existing frontmatter if present.
 */
export function updateDocumentFrontmatter(markdown: string, updates: Partial<DocumentFrontmatter>): string {
  const existing = parseDocumentFrontmatter(markdown)
  const body = getDocumentBody(markdown)

  const merged: DocumentFrontmatter = { ...existing, ...updates }

  // Remove undefined values
  for (const key of Object.keys(merged)) {
    if (merged[key] === undefined) delete merged[key]
  }

  const frontmatterStr = serializeDocumentFrontmatter(merged)
  return `${frontmatterStr}\n\n${body}`
}
