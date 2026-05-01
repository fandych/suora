import { describe, expect, it } from 'vitest'
import { createDocument, createDocumentGroup, createDocumentId } from '@/services/documents'
import type { DocumentNode } from '@/types'
import { buildGraphifyCorpusBundle } from './graphifyCorpus'

describe('graphify corpus export', () => {
  it('builds a reusable corpus bundle with unicode-safe document paths', () => {
    const group = createDocumentGroup('知识库')
    const folderId = createDocumentId('folder')
    const now = Date.now()
    const nodes: DocumentNode[] = [
      {
        id: folderId,
        type: 'folder',
        title: '计划资料',
        groupId: group.id,
        parentId: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        ...createDocument(group.id, folderId, '琥珀计划总览'),
        markdown: '# 琥珀计划总览\n\n验收日期：2026-06-15',
      },
      {
        ...createDocument(group.id, null, '预算明细.md'),
        id: 'budget',
        markdown: '预算：42000 元',
      },
    ]

    const bundle = buildGraphifyCorpusBundle('/workspace', group, nodes, '2026-05-01T00:00:00.000Z')

    expect(bundle.rootDir).toContain('/workspace/.suora/exports/graphify/')
    expect(bundle.files.some((file) => file.path.endsWith('/README.md'))).toBe(true)
    expect(bundle.files.some((file) => file.path.endsWith('/manifest.json'))).toBe(true)
    expect(bundle.files.some((file) => file.path.endsWith('/suora-graph-preview.json'))).toBe(true)
    expect(bundle.files.some((file) => file.path.includes('/docs/计划资料/琥珀计划总览.md'))).toBe(true)
    expect(bundle.files.some((file) => file.path.includes('/docs/预算明细.md'))).toBe(true)
  })
})