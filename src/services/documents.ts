import type { DocumentGroup, DocumentItem, DocumentNode } from '@/types'

const GROUP_COLORS = ['#12A8A0', '#4D7CFF', '#D9A441', '#35B98F', '#E45F68', '#9B7CFF']

export interface DocumentSearchResult {
  node: DocumentItem
  score: number
  excerpt: string
}

export interface DocumentAssetReference {
  type: 'image'
  alt: string
  source: string
  title?: string
}

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx'])
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
    if (refSet.has(doc.title.toLowerCase()) || refSet.has(doc.id.toLowerCase())) {
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

export function searchDocuments(nodes: DocumentNode[], groupId: string | null, query: string): DocumentSearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const docs = nodes.filter((node): node is DocumentItem => node.type === 'document' && (!groupId || node.groupId === groupId))

  return docs
    .map((node) => {
      const title = node.title.toLowerCase()
      const body = node.markdown.toLowerCase()
      const titleIndex = title.indexOf(q)
      const bodyIndex = body.indexOf(q)
      if (titleIndex === -1 && bodyIndex === -1) return null
      const sourceIndex = bodyIndex === -1 ? 0 : bodyIndex
      const excerptStart = Math.max(0, sourceIndex - 48)
      const excerpt = node.markdown.slice(excerptStart, excerptStart + 160).replace(/\s+/g, ' ').trim()
      return {
        node,
        score: (titleIndex === 0 ? 100 : titleIndex > -1 ? 70 : 0) + (bodyIndex > -1 ? 20 : 0),
        excerpt,
      }
    })
    .filter((result): result is DocumentSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || b.node.updatedAt - a.node.updatedAt)
}
