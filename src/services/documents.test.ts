import { describe, expect, it, vi } from 'vitest'
import type { DocumentItem, DocumentNode } from '@/types'
import { createDocument, createDocumentGroup, extractMarkdownReferences, findReferencedDocuments, searchDocuments } from './documents'

describe('documents service', () => {
  it('creates document groups and markdown documents with stable defaults', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    vi.spyOn(Math, 'random').mockReturnValue(0.123456)

    const group = createDocumentGroup('Research')
    const doc = createDocument(group.id, null, 'Brief')

    expect(group).toMatchObject({ name: 'Research', createdAt: 1000, updatedAt: 1000 })
    expect(doc).toMatchObject({
      groupId: group.id,
      parentId: null,
      type: 'document',
      title: 'Brief',
      createdAt: 1000,
      updatedAt: 1000,
    })
    expect(doc.markdown).toContain('# Brief')

    vi.restoreAllMocks()
  })

  it('extracts wiki and markdown document references', () => {
    expect(extractMarkdownReferences('Read [[Architecture]] and [Roadmap](#doc:roadmap-id).')).toEqual([
      'Architecture',
      'Roadmap',
    ])
  })

  it('resolves references by title or id within available documents', () => {
    const docs = [
      { id: 'a', type: 'document', title: 'Architecture', markdown: '', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 1 },
      { id: 'roadmap-id', type: 'document', title: 'Roadmap', markdown: '', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 1 },
    ] satisfies DocumentItem[]

    expect(findReferencedDocuments('[[Architecture]] and [Roadmap](#doc:roadmap-id)', docs).map((doc) => doc.id)).toEqual(['a', 'roadmap-id'])
  })

  it('progressively searches title and markdown body scoped to a group', () => {
    const nodes = [
      { id: 'folder', type: 'folder', title: 'Folder', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 1 },
      { id: 'a', type: 'document', title: 'Architecture Notes', markdown: 'System overview', groupId: 'g', parentId: 'folder', createdAt: 1, updatedAt: 3 },
      { id: 'b', type: 'document', title: 'Daily', markdown: 'Architecture follow-up', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 2 },
      { id: 'c', type: 'document', title: 'Other Architecture', markdown: 'Outside scope', groupId: 'other', parentId: null, createdAt: 1, updatedAt: 4 },
    ] satisfies DocumentNode[]

    const results = searchDocuments(nodes, 'g', 'arch')

    expect(results.map((result) => result.node.id)).toEqual(['a', 'b'])
    expect(results[1].excerpt).toContain('Architecture follow-up')
  })
})
