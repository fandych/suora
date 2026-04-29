import type { DocumentGroup, DocumentItem, DocumentNode } from '@/types'

const GROUP_COLORS = ['#12A8A0', '#4D7CFF', '#D9A441', '#35B98F', '#E45F68', '#9B7CFF']

export interface DocumentSearchResult {
  node: DocumentItem
  score: number
  excerpt: string
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
  return {
    id: createDocumentId('doc'),
    groupId,
    parentId,
    type: 'document',
    title,
    markdown: `# ${title}\n\nStart writing in Markdown. Use [[Document Title]] to reference another note.`,
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
  }

  return Array.from(refs).filter(Boolean)
}

export function findReferencedDocuments(markdown: string, documents: DocumentItem[]): DocumentItem[] {
  const refs = extractMarkdownReferences(markdown).map((ref) => ref.toLowerCase())
  if (refs.length === 0) return []
  return documents.filter((doc) => refs.includes(doc.title.toLowerCase()) || refs.includes(doc.id.toLowerCase()))
}

export function searchDocuments(nodes: DocumentNode[], groupId: string | null, query: string): DocumentSearchResult[] {
  const q = query.trim().toLowerCase()
  const docs = nodes.filter((node): node is DocumentItem => node.type === 'document' && (!groupId || node.groupId === groupId))
  if (!q) return docs.sort((a, b) => b.updatedAt - a.updatedAt).map((node) => ({ node, score: 0, excerpt: node.markdown.slice(0, 120) }))

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
