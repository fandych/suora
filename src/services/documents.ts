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

export type DocumentHealthIssueKind = 'dead-reference' | 'duplicate-title' | 'missing-tags' | 'orphan'
export type DocumentHealthSeverity = 'high' | 'medium' | 'low'

export interface DocumentHealthIssue {
  id: string
  kind: DocumentHealthIssueKind
  severity: DocumentHealthSeverity
  documentId: string
  title: string
  message: string
  detail: string
  reference?: string
  relatedDocumentIds?: string[]
}

export interface DocumentHealthReport {
  score: number
  documentCount: number
  taggedDocumentCount: number
  referencedDocumentCount: number
  orphanDocumentCount: number
  deadReferenceCount: number
  duplicateTitleCount: number
  issues: DocumentHealthIssue[]
  issueCounts: Record<DocumentHealthIssueKind, number>
}

interface MarkdownReferenceTarget {
  label: string
  target: string
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
const DOCUMENT_SEARCH_SCORE = {
  titlePrefix: 220,
  titlePhrase: 160,
  tagPhrase: 120,
  headingPhrase: 100,
  pathPhrase: 70,
  bodyPhrase: 45,
  titleToken: 26,
  tagToken: 22,
  headingToken: 18,
  pathToken: 12,
  bodyToken: 8,
} as const
const DOCUMENT_HEALTH_SEVERITY_PENALTY: Record<DocumentHealthSeverity, number> = {
  high: 18,
  medium: 10,
  low: 4,
}
const MIN_QUERY_TOKENS_FOR_RELEVANCE_THRESHOLD = 3
const MIN_TOKEN_HIT_RATIO = 0.5
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
      continue
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

function normalizeDocumentTitleKey(title: string): string {
  return getDocumentDisplayName(title).replace(/\.(md|markdown|mdx)$/i, '').toLowerCase().trim()
}

function extractMarkdownReferenceTargets(markdown: string): MarkdownReferenceTarget[] {
  const refs = new Map<string, MarkdownReferenceTarget>()
  const wikiPattern = /\[\[([^\]\n]+)\]\]/g
  const markdownPattern = /\[([^\]\n]+)\]\(#doc:([^)]+)\)/g

  let match: RegExpExecArray | null
  while ((match = wikiPattern.exec(markdown)) !== null) {
    const target = match[1].trim()
    if (target) refs.set(`wiki:${target.toLowerCase()}`, { label: target, target })
  }
  while ((match = markdownPattern.exec(markdown)) !== null) {
    const label = match[1].trim()
    const target = match[2].trim()
    if (target) refs.set(`doc:${target.toLowerCase()}`, { label: label || target, target })
  }

  return Array.from(refs.values())
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

function meetsMinimumRelevanceThreshold(
  queryTokens: string[],
  tokenHits: number,
  hasBodyPhrase: boolean,
  hasTitlePhrase: boolean,
): boolean {
  if (hasBodyPhrase || hasTitlePhrase) return true
  if (queryTokens.length < MIN_QUERY_TOKENS_FOR_RELEVANCE_THRESHOLD) return true
  return tokenHits >= Math.ceil(queryTokens.length * MIN_TOKEN_HIT_RATIO)
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
  const refs = extractMarkdownReferenceTargets(markdown).flatMap((ref) => {
    if (ref.label && ref.label !== ref.target) return [ref.label, ref.target]
    return [ref.target]
  }).filter(Boolean)
  return Array.from(new Set(refs))
}

export function findReferencedDocuments(markdown: string, documents: DocumentItem[]): DocumentItem[] {
  const refs = extractMarkdownReferenceTargets(markdown).map((ref) => ref.target)
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

export function analyzeDocumentHealth(nodes: DocumentNode[], groupId: string | null = null): DocumentHealthReport {
  const documents = nodes
    .filter((node): node is DocumentItem => isDocumentNode(node))
    .filter((doc) => !groupId || doc.groupId === groupId)
  const issues: DocumentHealthIssue[] = []
  const issueCounts: Record<DocumentHealthIssueKind, number> = {
    'dead-reference': 0,
    'duplicate-title': 0,
    'missing-tags': 0,
    orphan: 0,
  }
  const documentsById = new Map<string, DocumentItem>()
  const documentsByTitle = new Map<string, DocumentItem[]>()
  const referencedDocumentIds = new Set<string>()
  const documentsWithTags = new Set<string>()

  for (const doc of documents) {
    documentsById.set(doc.id.toLowerCase(), doc)
    const keys = new Set([
      doc.title.toLowerCase().trim(),
      getDocumentDisplayName(doc.title).toLowerCase().trim(),
      normalizeDocumentTitleKey(doc.title),
    ])
    for (const key of keys) {
      const bucket = documentsByTitle.get(key) ?? []
      bucket.push(doc)
      documentsByTitle.set(key, bucket)
    }
    if (extractDocumentSearchTags(doc.markdown).length > 0) documentsWithTags.add(doc.id)
  }

  const resolveReference = (target: string) => {
    const key = target.toLowerCase().trim()
    return documentsById.get(key) ?? documentsByTitle.get(key)?.[0] ?? documentsByTitle.get(normalizeDocumentTitleKey(target))?.[0] ?? null
  }

  for (const doc of documents) {
    const targets = extractMarkdownReferenceTargets(doc.markdown)
    if (targets.length === 0 && !documentsWithTags.has(doc.id)) {
      issues.push({
        id: `orphan:${doc.id}`,
        kind: 'orphan',
        severity: 'low',
        documentId: doc.id,
        title: doc.title,
        message: 'No outgoing references',
        detail: 'Add [[wikilinks]] or #tags so this note becomes part of the knowledge graph.',
      })
      issueCounts.orphan += 1
    }

    if (!documentsWithTags.has(doc.id)) {
      issues.push({
        id: `missing-tags:${doc.id}`,
        kind: 'missing-tags',
        severity: 'low',
        documentId: doc.id,
        title: doc.title,
        message: 'No tags found',
        detail: 'Add YAML tags or inline #tags to improve graph clustering and discovery.',
      })
      issueCounts['missing-tags'] += 1
    }

    for (const ref of targets) {
      const resolved = resolveReference(ref.target)
      if (resolved && resolved.id !== doc.id) {
        referencedDocumentIds.add(resolved.id)
        continue
      }
      if (!resolved) {
        issues.push({
          id: `dead-reference:${doc.id}:${ref.target.toLowerCase()}`,
          kind: 'dead-reference',
          severity: 'high',
          documentId: doc.id,
          title: doc.title,
          message: `Missing reference: ${ref.target}`,
          detail: 'Create the target note or update this wikilink before exporting/querying the corpus.',
          reference: ref.target,
        })
        issueCounts['dead-reference'] += 1
      }
    }
  }

  const duplicateGroups = new Map<string, DocumentItem[]>()
  for (const doc of documents) {
    const key = normalizeDocumentTitleKey(doc.title)
    const bucket = documentsByTitle.get(key) ?? []
    if (bucket.length > 1) duplicateGroups.set(key, Array.from(new Map(bucket.map((item) => [item.id, item])).values()))
  }

  for (const [key, duplicates] of duplicateGroups) {
    if (duplicates.length < 2) continue
    issueCounts['duplicate-title'] += duplicates.length
    for (const doc of duplicates) {
      issues.push({
        id: `duplicate-title:${key}:${doc.id}`,
        kind: 'duplicate-title',
        severity: 'medium',
        documentId: doc.id,
        title: doc.title,
        message: 'Duplicate document title',
        detail: 'Rename one copy so wikilinks and graph references resolve predictably.',
        relatedDocumentIds: duplicates.filter((item) => item.id !== doc.id).map((item) => item.id),
      })
    }
  }

  const severityPenalty = issues.reduce((total, issue) => total + DOCUMENT_HEALTH_SEVERITY_PENALTY[issue.severity], 0)
  const score = documents.length === 0 ? 100 : Math.max(0, Math.min(100, 100 - Math.round(severityPenalty / Math.max(1, documents.length))))

  return {
    score,
    documentCount: documents.length,
    taggedDocumentCount: documentsWithTags.size,
    referencedDocumentCount: referencedDocumentIds.size,
    orphanDocumentCount: issueCounts.orphan,
    deadReferenceCount: issueCounts['dead-reference'],
    duplicateTitleCount: issueCounts['duplicate-title'],
    issues: issues.sort((a, b) => {
      const severityRank = { high: 0, medium: 1, low: 2 } satisfies Record<DocumentHealthSeverity, number>
      return severityRank[a.severity] - severityRank[b.severity] || a.title.localeCompare(b.title) || a.message.localeCompare(b.message)
    }),
    issueCounts,
  }
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

    case 'table': {
      const rows = children
      if (!rows.length) return ''
      const [header, ...body] = rows
      const headerMd = serializeNode(header, '__tableHeader__')
      const separator = (header.content ?? []).map(() => '| --- ').join('') + '|\n'
      const bodyMd = body.map((row) => serializeNode(row, '__tableRow__')).join('')
      return `${headerMd}${separator}${bodyMd}\n`
    }

    case 'tableRow': {
      const cells = children.map((cell) => {
        const cellText = (cell.content ?? []).map((child) => serializeNode(child)).join('').replace(/\n+$/, '')
        return ` ${cellText} `
      }).join('|')
      return `|${cells}|\n`
    }

    case 'tableHeader':
    case 'tableCell': {
      return children.map((child) => serializeNode(child)).join('').replace(/\n+$/, '')
    }

    case 'taskList':
      return children.map((child) => serializeNode(child, '- ')).join('') + '\n'

    case 'taskItem': {
      const checked = (node.attrs?.checked as boolean) ?? false
      const checkbox = checked ? '[x]' : '[ ]'
      const first = children[0]
      const rest = children.slice(1)
      const firstText = first ? serializeNode(first, `- ${checkbox} `) : ''
      const restText = rest.map((child) => serializeNode(child)).join('')
      return firstText + restText
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
        score += DOCUMENT_SEARCH_SCORE.titlePrefix
        matchedFields.add('title')
      } else if (titlePhraseIndex > -1) {
        score += DOCUMENT_SEARCH_SCORE.titlePhrase
        matchedFields.add('title')
      }

      if (tagPhraseIndex > -1) {
        score += DOCUMENT_SEARCH_SCORE.tagPhrase
        matchedFields.add('tag')
      }
      if (headingPhraseIndex > -1) {
        score += DOCUMENT_SEARCH_SCORE.headingPhrase
        matchedFields.add('heading')
      }
      if (pathPhraseIndex > -1) {
        score += DOCUMENT_SEARCH_SCORE.pathPhrase
        matchedFields.add('path')
      }
      if (bodyPhraseIndex > -1) {
        score += DOCUMENT_SEARCH_SCORE.bodyPhrase
        matchedFields.add('body')
      }

      let tokenHits = 0
      for (const token of queryTokens) {
        if (!entry.tokens.has(token)) continue
        tokenHits += 1
        if (entry.normalized.title.includes(token)) {
          score += DOCUMENT_SEARCH_SCORE.titleToken
          matchedFields.add('title')
        }
        if (entry.normalized.tag.includes(token)) {
          score += DOCUMENT_SEARCH_SCORE.tagToken
          matchedFields.add('tag')
        }
        if (entry.normalized.heading.includes(token)) {
          score += DOCUMENT_SEARCH_SCORE.headingToken
          matchedFields.add('heading')
        }
        if (entry.normalized.path.includes(token)) {
          score += DOCUMENT_SEARCH_SCORE.pathToken
          matchedFields.add('path')
        }
        if (entry.normalized.body.includes(token)) {
          score += DOCUMENT_SEARCH_SCORE.bodyToken
          matchedFields.add('body')
        }
      }

      if (score === 0 || matchedFields.size === 0) return null
      if (!meetsMinimumRelevanceThreshold(queryTokens, tokenHits, bodyPhraseIndex > -1, titlePhraseIndex > -1)) return null

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
