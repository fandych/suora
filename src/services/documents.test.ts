import { describe, expect, it, vi } from 'vitest'
import type { DocumentItem, DocumentNode } from '@/types'
import { buildDocumentGraph, extractDocumentReferenceTargets, extractDocumentTags, queryDocumentGraph } from './documentGraph'
import { toGraphifyExport } from './graphifyAdapter'
import { createDocument, createDocumentGroup, extractMarkdownImageReferences, extractMarkdownReferences, getDocumentDisplayName, isMarkdownDocumentTitle, findReferencedDocuments, searchDocuments } from './documents'

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

  it('detects markdown and other text document names', () => {
    expect(getDocumentDisplayName('Brief')).toBe('Brief.md')
    expect(getDocumentDisplayName('script.py')).toBe('script.py')
    expect(isMarkdownDocumentTitle('Brief')).toBe(true)
    expect(isMarkdownDocumentTitle('notes.markdown')).toBe(true)
    expect(isMarkdownDocumentTitle('deploy.sh')).toBe(false)
  })

  it('creates script documents without forcing a markdown template', () => {
    const group = createDocumentGroup('Scripts')
    const script = createDocument(group.id, null, 'deploy.sh')

    expect(script.title).toBe('deploy.sh')
    expect(script.markdown).toBe('')
  })

  it('extracts wiki and markdown document references', () => {
    expect(extractMarkdownReferences('Read [[Architecture]] and [Roadmap](#doc:roadmap-id).')).toEqual([
      'Architecture',
      'Roadmap',
      'roadmap-id',
    ])
  })

  it('extracts markdown image asset references', () => {
    expect(extractMarkdownImageReferences('![Logo](./assets/logo.png "App Logo") and ![Remote](https://example.com/a.png).')).toEqual([
      { type: 'image', alt: 'Logo', source: './assets/logo.png', title: 'App Logo' },
      { type: 'image', alt: 'Remote', source: 'https://example.com/a.png', title: undefined },
    ])
  })

  it('resolves references by title or id within available documents', () => {
    const docs = [
      { id: 'a', type: 'document', title: 'Architecture', markdown: '', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 1 },
      { id: 'roadmap-id', type: 'document', title: 'Roadmap', markdown: '', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 1 },
      { id: 'brief-id', type: 'document', title: 'Brief.md', markdown: '', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 1 },
    ] satisfies DocumentItem[]

    expect(findReferencedDocuments('[[Architecture.md]], [[Brief]], and [Roadmap](#doc:roadmap-id)', docs).map((doc) => doc.id)).toEqual(['a', 'roadmap-id', 'brief-id'])
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

  it('keeps exact title matches ahead of fresher noise in large document corpora', () => {
    const nodes = [
      { id: 'exact', type: 'document', title: '琥珀计划总览', markdown: '验收日期：2026-06-15', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 10 },
      { id: 'body-hit', type: 'document', title: '周报', markdown: '这里顺带提到琥珀计划，但正文重点不是它。', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 999 },
      ...Array.from({ length: 120 }, (_, index) => ({
        id: `noise-${index}`,
        type: 'document' as const,
        title: `噪音文档 ${index}`,
        markdown: `无关内容 ${index}`,
        groupId: 'g',
        parentId: null,
        createdAt: 1,
        updatedAt: 500 + index,
      })),
    ] satisfies DocumentNode[]

    const results = searchDocuments(nodes, 'g', '琥珀计划')

    expect(results.map((result) => result.node.id)).toEqual(['exact', 'body-hit'])
    expect(results[0].excerpt).toContain('验收日期')
  })

  it('extracts graph reference targets and tags from markdown', () => {
    const markdown = `---
tags: [research, ai]
---

Read [[Architecture]] and [Plan](#doc:plan-id). #daily`

    expect(extractDocumentReferenceTargets(markdown)).toEqual([
      { label: 'Architecture', target: 'Architecture' },
      { label: 'Plan', target: 'plan-id' },
    ])
    expect(extractDocumentTags(markdown)).toEqual(['ai', 'daily', 'research'])
  })

  it('builds a scoped knowledge graph with folders, references, tags, external links, and orphans', () => {
    const groups = [{ id: 'g', name: 'Research', color: '#12A8A0', createdAt: 1, updatedAt: 1 }]
    const nodes = [
      { id: 'folder', type: 'folder', title: 'Folder', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 1 },
      { id: 'a', type: 'document', title: 'Architecture', markdown: 'See [Plan](#doc:plan-id). #systems https://example.com', groupId: 'g', parentId: 'folder', createdAt: 1, updatedAt: 3 },
      { id: 'plan-id', type: 'document', title: 'Plan', markdown: 'Next steps', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 2 },
      { id: 'orphan', type: 'document', title: 'Orphan', markdown: 'Standalone note', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 2 },
    ] satisfies DocumentNode[]

    const graph = buildDocumentGraph(groups, nodes, { groupId: 'g' })

    expect(graph.nodes.some((node) => node.type === 'folder' && node.folderId === 'folder')).toBe(true)
    expect(graph.edges.some((edge) => edge.type === 'contains' && edge.source === 'doc-graph:folder' && edge.target === 'doc-graph:a')).toBe(true)
    expect(graph.edges.some((edge) => edge.type === 'references' && edge.source === 'doc-graph:a' && edge.target === 'doc-graph:plan-id')).toBe(true)
    expect(graph.edges.some((edge) => edge.type === 'tagged' && edge.label === '#systems')).toBe(true)
    expect(graph.edges.some((edge) => edge.type === 'external-link' && edge.metadata.url === 'https://example.com')).toBe(true)
    expect(graph.backlinksByDocumentId['plan-id']).toEqual(['a'])
    expect(graph.orphanDocumentIds).toEqual(['orphan'])
  })

  it('exports document graph data through a graphify-compatible adapter', () => {
    const graph = buildDocumentGraph(
      [{ id: 'g', name: 'Research', color: '#12A8A0', createdAt: 1, updatedAt: 1 }],
      [{ id: 'a', type: 'document', title: 'Architecture', markdown: '#systems', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 1 }],
      { groupId: 'g' },
    )

    const exported = toGraphifyExport(graph, '2026-04-29T00:00:00.000Z')

    expect(exported.graphifyCompatible).toBe(true)
    expect(exported.metadata.source).toBe('suora-documents')
    expect(exported.nodes.find((node) => node.id === 'doc-graph:a')?.attributes.documentId).toBe('a')
    expect(exported.edges.some((edge) => edge.type === 'tagged')).toBe(true)
  })

  it('expands graph queries through references and shared tags', () => {
    const groups = [{ id: 'g', name: 'Research', color: '#12A8A0', createdAt: 1, updatedAt: 1 }]
    const nodes = [
      { id: 'overview', type: 'document', title: '琥珀计划总览', markdown: '见 [预算](#doc:budget)。 #amber', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 3 },
      { id: 'budget', type: 'document', title: '预算明细', markdown: '预算 42000 元。 #amber', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 2 },
      { id: 'release', type: 'document', title: '发布计划', markdown: '桌面应用上线杭州。 #amber', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 4 },
      { id: 'noise', type: 'document', title: '无关说明', markdown: '纯噪音内容', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 5 },
    ] satisfies DocumentNode[]

    const graph = buildDocumentGraph(groups, nodes, { groupId: 'g' })
    const result = queryDocumentGraph(graph, nodes, { query: '琥珀计划', groupId: 'g' })

    expect(result.seeds.map((doc) => doc.id)).toContain('overview')
    expect(result.relatedDocuments.map((doc) => doc.id)).toContain('budget')
    expect(result.relatedDocuments.map((doc) => doc.id)).toContain('release')
    expect(result.relatedDocuments.find((doc) => doc.id === 'budget')?.reasons.join(' ')).toContain('references')
    expect(result.tags).toContain('amber')
  })
})
