import { describe, expect, it, vi } from 'vitest'
import type { DocumentGroup, DocumentNode } from '@/types'
import { buildToolHints, builtinToolDefs, setLiveStoreAccessor } from './tools'

function getDescription(toolName: 'web_search' | 'list_documents' | 'query_document_graph' | 'read_document' | 'write_file' | 'append_file') {
  return (builtinToolDefs[toolName] as { description?: string }).description ?? ''
}

describe('builtin tool guidance', () => {
  it('prioritizes local documents before web search for local knowledge questions', () => {
    expect(getDescription('list_documents')).toContain('Use this first')
    expect(getDescription('list_documents')).toContain('before using web_search')
    expect(getDescription('query_document_graph')).toContain('knowledge graph')
    expect(getDescription('read_document')).toContain('prefer it over web_search')
    expect(getDescription('web_search')).toContain('Do not use this for facts likely stored in the user\'s Suora documents')

    const hints = buildToolHints(['query_document_graph', 'list_documents', 'read_document', 'web_search'])
    expect(hints).toContain('start with query_document_graph')
    expect(hints).toContain('before web_search')
  })

  it('uses relevance-ranked document results instead of pure recency for large corpora', async () => {
    const toolOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.list_documents.execute>>[1]
    const groups: DocumentGroup[] = [{ id: 'g', name: '知识库', color: '#12A8A0', createdAt: 1, updatedAt: 1 }]
    const nodes: DocumentNode[] = [
      { id: 'exact', type: 'document', title: '琥珀计划总览', markdown: '验收日期：2026-06-15；发布渠道：桌面应用。', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 10 },
      { id: 'body-hit', type: 'document', title: '最新周报', markdown: '这里顺带提到琥珀计划，但重点是其他项目。', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 999 },
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
    ]

    setLiveStoreAccessor(() => ({
      documentGroups: groups,
      documentNodes: nodes,
      selectedDocumentId: null,
    }))

    const output = await builtinToolDefs.list_documents.execute?.({ query: '琥珀计划' }, toolOptions)

    expect(output).toContain('琥珀计划总览')
    expect(output?.split('\n\n')[0]).toContain('琥珀计划总览')
    expect(output?.split('\n\n')[1]).toContain('最新周报')
  })

  it('expands local document matches through the built-in document graph', async () => {
    const toolOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.query_document_graph.execute>>[1]
    const groups: DocumentGroup[] = [{ id: 'g', name: '知识库', color: '#12A8A0', createdAt: 1, updatedAt: 1 }]
    const nodes: DocumentNode[] = [
      { id: 'overview', type: 'document', title: '琥珀计划总览', markdown: '关联 [预算](#doc:budget)。 #amber', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 10 },
      { id: 'budget', type: 'document', title: '预算明细', markdown: '项目预算是 42000 元。 #amber', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 11 },
      { id: 'release', type: 'document', title: '发布计划', markdown: '桌面应用首发杭州。 #amber', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 12 },
      { id: 'noise', type: 'document', title: '无关文档', markdown: '与琥珀计划无关。', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 13 },
    ]

    setLiveStoreAccessor(() => ({
      documentGroups: groups,
      documentNodes: nodes,
      selectedDocumentId: null,
    }))

    const output = await builtinToolDefs.query_document_graph.execute?.({ query: '琥珀计划' }, toolOptions)
    const parsed = JSON.parse(String(output)) as {
      seeds: Array<{ id: string }>
      relatedDocuments: Array<{ id: string; reasons: string[] }>
      tags: string[]
    }

    expect(parsed.seeds.map((doc) => doc.id)).toContain('overview')
    expect(parsed.relatedDocuments.map((doc) => doc.id)).toContain('budget')
    expect(parsed.relatedDocuments.find((doc) => doc.id === 'budget')?.reasons.join(' ')).toContain('references')
    expect(parsed.tags).toContain('amber')
  })

  it('guides large file writes toward chunking with append_file', () => {
    expect(getDescription('write_file')).toContain('append_file')
    expect(getDescription('append_file')).toContain('chunked writes')

    const hints = buildToolHints(['write_file', 'append_file'])
    expect(hints).toContain('Large file writes')
    expect(hints).toContain('continue with append_file')
  })

  it('routes append_file through the append IPC channel', async () => {
    const toolOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.append_file.execute>>[1]
    const invoke = vi.fn().mockResolvedValue({ success: true })

    setLiveStoreAccessor(() => ({
      workspacePath: '/workspace',
      toolSecurity: {
        allowedDirectories: [],
        blockedCommands: [],
        requireConfirmation: false,
        sandboxMode: 'workspace',
      },
    }))

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { invoke },
    })

    try {
      const output = await builtinToolDefs.append_file.execute?.({
        path: '/workspace/notes/output.md',
        content: 'chunk-2',
      }, toolOptions)

      expect(output).toContain('Successfully appended 7 characters')
      expect(invoke).toHaveBeenCalledWith('fs:appendFile', '/workspace/notes/output.md', 'chunk-2')
    } finally {
      Reflect.deleteProperty(window, 'electron')
    }
  })
})