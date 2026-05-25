import type { DocumentGroup, DocumentItem, DocumentNode } from '@/types'

const GROUP_COLORS = ['#12A8A0', '#4D7CFF', '#D9A441', '#35B98F', '#E45F68', '#9B7CFF']

export interface DocumentSearchResult {
  node: DocumentItem
  score: number
  excerpt: string
  path: string
  matchedFields: DocumentSearchField[]
  titleMatch: boolean
}

export type DocumentSearchField = 'title' | 'path' | 'heading' | 'tag' | 'body'

export interface DocumentSearchIndexEntry {
  node: DocumentItem
  path: string
  title: string
  headings: string[]
  tags: string[]
  body: string
  tokens: Set<string>
  normalized: Record<DocumentSearchField, string>
}

export interface DocumentSearchIndex {
  entries: DocumentSearchIndexEntry[]
  documentCount: number
}

export interface DocumentAssetReference {
  type: 'image'
  alt: string
  source: string
  title?: string
}

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx'])
const DOCUMENT_SEARCH_STOP_WORDS = new Set([
  '的',
  '是',
  '了',
  '什么',
  '在',
  '有',
  '和',
  '与',
  '对',
  '从',
  'the',
  'is',
  'a',
  'an',
  'what',
  'how',
  'are',
  'was',
  'were',
  'do',
  'does',
  'did',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'it',
  'its',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'this',
  'that',
  'these',
  'those',
])
const TEXT_DOCUMENT_EXTENSIONS = new Set([
  ...MARKDOWN_EXTENSIONS,
  '.txt',
  '.text',
  '.log',
  '.csv',
  '.tsv',
  '.json',
  '.jsonl',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.env',
  '.gitignore',
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
  '.bat',
  '.cmd',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.kts',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.cs',
  '.php',
  '.swift',
  '.sql',
  '.html',
  '.css',
  '.scss',
  '.xml',
  '.svg',
])

export function getDocumentExtension(title: string): string {
  const normalized = title.trim()
  const basename = normalized.split(/[\\/]/).pop() ?? normalized
  if (!basename) return ''
  const isDotfileWithoutExtension = basename.startsWith('.') && !basename.slice(1).includes('.')
  if (isDotfileWithoutExtension) return basename.toLowerCase()
  const index = basename.lastIndexOf('.')
  return index > 0 ? basename.slice(index).toLowerCase() : ''
}

export function isMarkdownDocumentTitle(title: string): boolean {
  const extension = getDocumentExtension(title)
  return extension === '' || MARKDOWN_EXTENSIONS.has(extension)
}

export function isSupportedTextDocumentTitle(title: string): boolean {
  const extension = getDocumentExtension(title)
  return extension === '' || TEXT_DOCUMENT_EXTENSIONS.has(extension)
}

export function getDocumentDisplayName(title: string): string {
  return getDocumentExtension(title) ? title : `${title}.md`
}

export function getDocumentKindLabel(title: string): string {
  const extension = getDocumentExtension(title)
  if (!extension || MARKDOWN_EXTENSIONS.has(extension)) return 'Markdown'
  if (!TEXT_DOCUMENT_EXTENSIONS.has(extension)) return 'File'
  return extension.slice(1).toUpperCase()
}

function getMarkdownHeadingTitle(title: string): string {
  return getDocumentDisplayName(title).replace(/\.(md|markdown|mdx)$/i, '')
}

function isDocumentNode(node: DocumentNode): node is DocumentItem {
  return node.type === 'document'
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function hasCjk(value: string): boolean {
  return /[\u3400-\u4dbf\u4e00-\u9fff]/.test(value)
}

export function tokenizeDocumentSearchQuery(query: string): string[] {
  const rawTokens = normalizeSearchText(query)
    .split(/[\s,，。！？、；：""''（）()\-_/\\·~～…]+/)
    .filter((token) => token.length > 1)
    .filter((token) => !DOCUMENT_SEARCH_STOP_WORDS.has(token))

  const tokens: string[] = []
  for (const token of rawTokens) {
    if (hasCjk(token) && token.length > 2) {
      const chars = [...token]
      for (let index = 0; index < chars.length - 1; index += 1) {
        tokens.push(chars[index] + chars[index + 1])
      }
      for (const char of chars) {
        if (!DOCUMENT_SEARCH_STOP_WORDS.has(char)) tokens.push(char)
      }
    }
    tokens.push(token)
  }

  return Array.from(new Set(tokens))
}

function extractDocumentSearchHeadings(markdown: string): string[] {
  const headings: string[] = []
  for (const line of markdown.split('\n')) {
    const match = /^(#{1,6})\s+(.+)$/.exec(line.trim())
    if (match) headings.push(match[2].trim())
  }
  return headings
}

function extractDocumentSearchTags(markdown: string): string[] {
  const tags = new Set<string>()
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(markdown)

  if (frontmatter) {
    const tagList = /^tags:\s*\[([^\]]+)\]/im.exec(frontmatter[1])
    if (tagList) {
      tagList[1].split(',').forEach((tag) => {
        const normalized = tag.trim().replace(/^['"]|['"]$/g, '')
        if (normalized) tags.add(normalized)
      })
    }

    const tagBlock = /^tags:\s*\n((?:\s*-\s*.+\n?)+)/im.exec(frontmatter[1])
    if (tagBlock) {
      tagBlock[1].split('\n').forEach((line) => {
        const normalized = line.replace(/^\s*-\s*/, '').trim().replace(/^['"]|['"]$/g, '')
        if (normalized) tags.add(normalized)
      })
    }
  }

  for (const match of markdown.matchAll(/(?:^|\s)#([\p{L}\p{N}_/-]{2,})/gu)) {
    tags.add(match[1])
  }

  return Array.from(tags)
}

function buildSearchPath(node: DocumentNode, nodeById: Map<string, DocumentNode>): string {
  const parts = [node.type === 'document' ? getDocumentDisplayName(node.title) : node.title]
  const visited = new Set<string>()
  let parentId = node.parentId

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId)
    const parent = nodeById.get(parentId)
    if (!parent) break
    parts.unshift(parent.type === 'document' ? getDocumentDisplayName(parent.title) : parent.title)
    parentId = parent.parentId
  }

  return parts.join(' / ')
}

function fieldContainsToken(fieldValue: string, token: string): boolean {
  return fieldValue.includes(token)
}

function compactExcerpt(markdown: string, query: string, tokens: string[], maxLength = 180): string {
  const normalized = markdown.toLowerCase()
  const phraseIndex = query ? normalized.indexOf(query) : -1
  const tokenIndex = phraseIndex >= 0
    ? phraseIndex
    : tokens
      .map((token) => normalized.indexOf(token))
      .filter((index) => index >= 0)
      .sort((first, second) => first - second)[0] ?? 0
  const excerptStart = Math.max(0, tokenIndex - 56)
  const prefix = excerptStart > 0 ? '…' : ''
  const excerpt = markdown.slice(excerptStart, excerptStart + maxLength).replace(/\s+/g, ' ').trim()
  return `${prefix}${excerpt}`
}

export function buildDocumentSearchIndex(nodes: DocumentNode[], groupId: string | null = null): DocumentSearchIndex {
  const nodeById = new Map<string, DocumentNode>(nodes.map((node) => [node.id, node]))
  const documents = nodes.filter((node): node is DocumentItem => isDocumentNode(node) && (!groupId || node.groupId === groupId))

  const entries = documents.map((node) => {
    const path = buildSearchPath(node, nodeById)
    const headings = extractDocumentSearchHeadings(node.markdown)
    const tags = extractDocumentSearchTags(node.markdown)
    const normalized = {
      title: normalizeSearchText(getDocumentDisplayName(node.title)),
      path: normalizeSearchText(path),
      heading: normalizeSearchText(headings.join(' ')),
      tag: normalizeSearchText(tags.join(' ')),
      body: normalizeSearchText(node.markdown),
    }
    const tokens = new Set(tokenizeDocumentSearchQuery(Object.values(normalized).join(' ')))

    return {
      node,
      path,
      title: getDocumentDisplayName(node.title),
      headings,
      tags,
      body: node.markdown,
      tokens,
      normalized,
    }
  })

  return {
    entries,
    documentCount: entries.length,
  }
}

export function createDocumentId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createDocumentGroup(name = 'New Document Group'): DocumentGroup {
  const now = Date.now()
  return {
    id: createDocumentId('doc-group'),
    name,
    color: GROUP_COLORS[now % GROUP_COLORS.length],
    createdAt: now,
    updatedAt: now,
  }
}

export function createDocument(groupId: string, parentId: string | null, title = 'Untitled Document'): DocumentItem {
  const now = Date.now()
  const isMarkdown = isMarkdownDocumentTitle(title)
  return {
    id: createDocumentId('doc'),
    groupId,
    parentId,
    type: 'document',
    title,
    markdown: isMarkdown
      ? `# ${getMarkdownHeadingTitle(title)}\n\nStart writing in Markdown. Use [[Document Title]] to reference another note. Images can be referenced with ![alt](./image.png).`
      : '',
    createdAt: now,
    updatedAt: now,
  }
}

export function extractMarkdownReferences(markdown: string): string[] {
  const refs = new Set<string>()
  const wikiPattern = /\[\[([^\]\n]+)\]\]/g
  const markdownPattern = /\[([^\]\n]+)\]\(#doc:([^)]+)\)/g

  let match: RegExpExecArray | null
  while ((match = wikiPattern.exec(markdown)) !== null) {
    refs.add(match[1].trim())
  }
  while ((match = markdownPattern.exec(markdown)) !== null) {
    refs.add(match[1].trim())
    refs.add(match[2].trim())
  }

  return Array.from(refs).filter(Boolean)
}

export function findReferencedDocuments(markdown: string, documents: DocumentItem[]): DocumentItem[] {
  const refs = extractMarkdownReferences(markdown)
  if (refs.length === 0) return []

  const refSet = new Set(refs.map((ref) => ref.toLowerCase()))
  const matched = new Map<string, DocumentItem>()

  for (const doc of documents) {
    if (matched.has(doc.id)) continue
    const title = doc.title.toLowerCase()
    const displayName = getDocumentDisplayName(doc.title).toLowerCase()
    const stemName = displayName.replace(/\.(md|markdown|mdx)$/i, '')
    if (refSet.has(title) || refSet.has(displayName) || refSet.has(stemName) || refSet.has(doc.id.toLowerCase())) {
      matched.set(doc.id, doc)
    }
  }

  return Array.from(matched.values())
}

export function extractMarkdownImageReferences(markdown: string): DocumentAssetReference[] {
  const refs = new Map<string, DocumentAssetReference>()
  const imagePattern = /!\[([^\]\n]*)\]\(\s*([^\s)]+)(?:\s+["']([^"']+)["'])?\s*\)/g

  let match: RegExpExecArray | null
  while ((match = imagePattern.exec(markdown)) !== null) {
    const source = match[2].trim()
    if (!source) continue
    refs.set(source, {
      type: 'image',
      alt: match[1].trim(),
      source,
      title: match[3]?.trim(),
    })
  }

  return Array.from(refs.values())
}

// ── Tiptap JSON → Markdown serializer ──────────────────────────────────────

type TiptapMark = { type: string; attrs?: Record<string, string> }
type TiptapNode = { type: string; text?: string; attrs?: Record<string, unknown>; marks?: TiptapMark[]; content?: TiptapNode[] }

// Mark application order: code first (prevents interference), then formatting, then link last (outermost)
const MARK_ORDER = ['code', 'bold', 'italic', 'strike', 'link'] as const

function serializeMarks(text: string, marks: TiptapMark[]): string {
  const markMap = new Map(marks.map((m) => [m.type, m]))
  let out = text
  for (const type of MARK_ORDER) {
    const mark = markMap.get(type)
    if (!mark) continue
    if (type === 'code') out = `\`${out}\``
    else if (type === 'bold') out = `**${out}**`
    else if (type === 'italic') out = `*${out}*`
    else if (type === 'strike') out = `~~${out}~~`
    else if (type === 'link') out = `[${out}](${mark.attrs?.href ?? ''})`
  }
  return out
}

function serializeNode(node: TiptapNode, listPrefix = ''): string {
  if (node.type === 'text') {
    const raw = node.text ?? ''
    return node.marks?.length ? serializeMarks(raw, node.marks) : raw
  }

  const children = node.content ?? []

  switch (node.type) {
    case 'doc':
      return children.map((child) => serializeNode(child)).join('').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'

    case 'paragraph': {
      const text = children.map((child) => serializeNode(child)).join('')
      return listPrefix ? `${listPrefix}${text}\n` : (text ? `${text}\n\n` : '\n')
    }

    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      const text = children.map((child) => serializeNode(child)).join('')
      return `${'#'.repeat(level)} ${text}\n\n`
    }

    case 'bulletList':
      return children.map((child) => serializeNode(child, '- ')).join('') + '\n'

    case 'orderedList':
      return children.map((child, i) => serializeNode(child, `${i + 1}. `)).join('') + '\n'

    case 'listItem': {
      const first = children[0]
      const rest = children.slice(1)
      const firstText = first ? serializeNode(first, listPrefix) : ''
      const restText = rest.map((child) => serializeNode(child)).join('')
      return firstText + restText
    }

    case 'blockquote': {
      const text = children.map((child) => serializeNode(child)).join('')
      return text.split('\n').filter(Boolean).map((line) => `> ${line}`).join('\n') + '\n\n'
    }

    case 'codeBlock': {
      const lang = (node.attrs?.language as string) ?? ''
      const code = children.filter((child) => child.type === 'text').map((child) => child.text ?? '').join('')
      return `\`\`\`${lang}\n${code}\n\`\`\`\n\n`
    }

    case 'horizontalRule':
      return '---\n\n'

    case 'hardBreak':
      return '\n'

    case 'image': {
      const src = (node.attrs?.src as string) ?? ''
      const alt = (node.attrs?.alt as string) ?? ''
      const title = (node.attrs?.title as string) ?? ''
      return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`
    }

    case 'mathBlock': {
      const content = (node.attrs?.content as string) ?? ''
      return `$$\n${content}\n$$\n\n`
    }

    case 'inlineMath': {
      const content = (node.attrs?.content as string) ?? ''
      return `$${content}$`
    }

    case 'mermaidBlock': {
      const code = (node.attrs?.code as string) ?? ''
      return `\`\`\`mermaid\n${code}\n\`\`\`\n\n`
    }

    default:
      return children.map((child) => serializeNode(child)).join('')
  }
}

export function tiptapJsonToMarkdown(json: TiptapNode): string {
  return serializeNode(json)
}

// ──────────────────────────────────────────────────────────────────────────────

export function searchDocumentIndex(index: DocumentSearchIndex, query: string): DocumentSearchResult[] {
  const q = normalizeSearchText(query)
  if (!q) return []

  const queryTokens = tokenizeDocumentSearchQuery(q)

  return index.entries
    .map((entry) => {
      let score = 0
      const matchedFields = new Set<DocumentSearchField>()
      const titlePhraseIndex = entry.normalized.title.indexOf(q)
      const bodyPhraseIndex = entry.normalized.body.indexOf(q)
      const headingPhraseIndex = entry.normalized.heading.indexOf(q)
      const tagPhraseIndex = entry.normalized.tag.indexOf(q)
      const pathPhraseIndex = entry.normalized.path.indexOf(q)

      if (titlePhraseIndex === 0) {
        score += 220
        matchedFields.add('title')
      } else if (titlePhraseIndex > -1) {
        score += 160
        matchedFields.add('title')
      }

      if (tagPhraseIndex > -1) {
        score += 120
        matchedFields.add('tag')
      }
      if (headingPhraseIndex > -1) {
        score += 100
        matchedFields.add('heading')
      }
      if (pathPhraseIndex > -1) {
        score += 70
        matchedFields.add('path')
      }
      if (bodyPhraseIndex > -1) {
        score += 45
        matchedFields.add('body')
      }

      let tokenHits = 0
      for (const token of queryTokens) {
        if (!entry.tokens.has(token)) continue
        tokenHits += 1
        if (fieldContainsToken(entry.normalized.title, token)) {
          score += 26
          matchedFields.add('title')
        }
        if (fieldContainsToken(entry.normalized.tag, token)) {
          score += 22
          matchedFields.add('tag')
        }
        if (fieldContainsToken(entry.normalized.heading, token)) {
          score += 18
          matchedFields.add('heading')
        }
        if (fieldContainsToken(entry.normalized.path, token)) {
          score += 12
          matchedFields.add('path')
        }
        if (fieldContainsToken(entry.normalized.body, token)) {
          score += 8
          matchedFields.add('body')
        }
      }

      if (score === 0 || matchedFields.size === 0) return null
      if (queryTokens.length > 2 && bodyPhraseIndex === -1 && titlePhraseIndex === -1 && tokenHits < Math.ceil(queryTokens.length / 2)) return null

      return {
        node: entry.node,
        score,
        excerpt: compactExcerpt(entry.body, q, queryTokens),
        path: entry.path,
        matchedFields: Array.from(matchedFields),
        titleMatch: matchedFields.has('title'),
      }
    })
    .filter((result): result is DocumentSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || b.node.updatedAt - a.node.updatedAt || a.node.title.localeCompare(b.node.title))
}

export function searchDocuments(nodes: DocumentNode[], groupId: string | null, query: string): DocumentSearchResult[] {
  return searchDocumentIndex(buildDocumentSearchIndex(nodes, groupId), query)
}
