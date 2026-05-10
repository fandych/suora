import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { Agent, DocumentGroup, DocumentNode, Model, Skill } from '@/types'
import { buildToolHints, builtinToolDefs, getSkillSystemPrompts, setLiveStoreAccessor, setLiveStoreWriter } from './tools'

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

  it('resolves session-scoped todo tools from live store state without cached persistence', async () => {
    const toolOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.todo_list.execute>>[1]
    const invoke = vi.fn().mockResolvedValue({
      data: JSON.stringify([
        {
          id: 'todo-1',
          title: 'Review timer run',
          status: 'pending',
          priority: 'high',
          createdAt: '2026-05-10T00:00:00.000Z',
          updatedAt: '2026-05-10T00:00:00.000Z',
        },
      ]),
    })

    setLiveStoreAccessor(() => ({
      workspacePath: '/workspace',
      activeSessionId: 'session-live',
    }))

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { invoke },
    })

    try {
      const output = await builtinToolDefs.todo_list.execute?.({ status: 'all' }, toolOptions)

      expect(output).toContain('Review timer run')
      expect(invoke).toHaveBeenCalledWith('db:loadPersistedStore', 'session-todos:session-live')
    } finally {
      Reflect.deleteProperty(window, 'electron')
    }
  })

  it('creates saved pipelines through the pipeline_add tool and syncs live store state', async () => {
    const toolOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.pipeline_add.execute>>[1]
    const agent: Agent = {
      id: 'agent-1',
      name: 'Writer',
      systemPrompt: 'Write clearly',
      modelId: 'model-1',
      skills: [],
      enabled: true,
      memories: [],
      autoLearn: false,
    }
    const model: Model = {
      id: 'model-1',
      name: 'GPT Test',
      provider: 'openai',
      providerType: 'openai',
      modelId: 'gpt-4.1',
      enabled: true,
      isDefault: true,
    }
    const liveState: Record<string, unknown> = {
      workspacePath: '/workspace',
      agents: [agent],
      models: [model],
      agentPipelines: [],
      selectedAgentPipelineId: null,
    }
    const invoke = vi.fn(async (channel: string) => {
      if (channel === 'db:saveEntity') return { success: true }
      if (channel === 'db:listEntities') return { success: true, data: [] }
      return undefined
    })

    setLiveStoreAccessor(() => liveState)
    setLiveStoreWriter((updater) => {
      updater(liveState)
    })

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { invoke },
    })

    try {
      const output = await builtinToolDefs.pipeline_add.execute?.({
        name: 'Launch Flow',
        description: 'Draft, review, and publish release notes.',
        steps: [
          { agent_id: 'agent-1', task: 'Draft release notes' },
          { agent_id: 'agent-1', task: 'Review the draft', retry_count: 1 },
        ],
        variables: [{ name: 'topic', default_value: 'release' }],
      }, toolOptions)

      const parsed = JSON.parse(String(output)) as {
        message: string
        storeSynced: boolean
        pipeline: { id: string; name: string; steps: Array<{ task: string }> }
      }

      expect(parsed.message).toContain('Created pipeline')
      expect(parsed.storeSynced).toBe(true)
      expect(parsed.pipeline.name).toBe('Launch Flow')
      expect(parsed.pipeline.steps).toHaveLength(2)
      expect(invoke).toHaveBeenCalledWith('db:saveEntity', 'pipelines', parsed.pipeline.id, expect.objectContaining({ name: 'Launch Flow' }))
      expect(liveState.agentPipelines).toEqual([
        expect.objectContaining({ id: parsed.pipeline.id, name: 'Launch Flow' }),
      ])
      expect(liveState.selectedAgentPipelineId).toBe(parsed.pipeline.id)
    } finally {
      Reflect.deleteProperty(window, 'electron')
    }
  })

  it('accepts JSON-string pipeline variables for pipeline_update tool calls', async () => {
    const toolOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.pipeline_update.execute>>[1]
    const agent: Agent = {
      id: 'agent-1',
      name: 'Writer',
      systemPrompt: 'Write clearly',
      modelId: 'model-1',
      skills: [],
      enabled: true,
      memories: [],
      autoLearn: false,
    }
    const model: Model = {
      id: 'model-1',
      name: 'GPT Test',
      provider: 'openai',
      providerType: 'openai',
      modelId: 'gpt-4.1',
      enabled: true,
      isDefault: true,
    }
    const existingPipeline = {
      id: 'pipeline-1',
      name: 'Launch Flow',
      description: 'Draft, review, and publish release notes.',
      createdAt: 1,
      updatedAt: 1,
      variables: [{ name: 'topic', defaultValue: 'release' }],
      steps: [
        { agentId: 'agent-1', task: 'Draft release notes for {{vars.topic}}' },
      ],
    }
    const liveState: Record<string, unknown> = {
      workspacePath: '/workspace',
      agents: [agent],
      models: [model],
      agentPipelines: [existingPipeline],
      selectedAgentPipelineId: 'pipeline-1',
    }
    const invoke = vi.fn(async (channel: string, _entity: string, id: string, value?: unknown) => {
      if (channel === 'db:saveEntity') return { success: true }
      if (channel === 'db:listEntities') return { success: true, data: [existingPipeline] }
      if (channel === 'db:getEntity') return { success: true, data: value ?? null, id }
      return undefined
    })

    setLiveStoreAccessor(() => liveState)
    setLiveStoreWriter((updater) => {
      updater(liveState)
    })

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { invoke },
    })

    try {
      const pipelineUpdateInputSchema = builtinToolDefs.pipeline_update.inputSchema as z.ZodTypeAny
      const parsed = pipelineUpdateInputSchema.safeParse({
        pipeline_id: 'pipeline-1',
        variables: JSON.stringify([{ name: 'audience', label: 'Audience', default_value: 'release' }]),
        steps: [
          { agent_id: 'agent-1', task: 'Draft release notes for {{vars.audience}}' },
        ],
      })

      expect(parsed.success).toBe(true)
      if (!parsed.success) return

      const output = await builtinToolDefs.pipeline_update.execute?.(parsed.data, toolOptions)
      const result = JSON.parse(String(output)) as {
        message: string
        storeSynced: boolean
        pipeline: {
          id: string
          variables: Array<{ name: string; defaultValue: string | null }>
          steps: Array<{ task: string }>
        }
      }

      expect(result.message).toContain('Updated pipeline')
      expect(result.storeSynced).toBe(true)
      expect(result.pipeline.variables).toEqual([
        expect.objectContaining({ name: 'audience', defaultValue: 'release' }),
      ])
      expect(result.pipeline.steps[0]?.task).toContain('{{vars.audience}}')
      expect(invoke).toHaveBeenCalledWith('db:saveEntity', 'pipelines', 'pipeline-1', expect.objectContaining({
        variables: [expect.objectContaining({ name: 'audience', defaultValue: 'release' })],
      }))
    } finally {
      Reflect.deleteProperty(window, 'electron')
    }
  })

  it('includes enabled Claude-style shared local skills in runtime prompts even when not assigned to the agent', async () => {
    const sharedSkill: Skill = {
      id: 'claude-shared-skill',
      name: 'Shared Claude Skill',
      description: 'Shared local skill',
      enabled: true,
      source: 'claude-dir',
      content: 'Use the shared Claude skill instructions.',
      frontmatter: { name: 'Shared Claude Skill', description: 'Shared local skill' },
      context: 'inline',
    }

    const prompts = await getSkillSystemPrompts([], [sharedSkill])

    expect(prompts).toContain('Shared Claude Skill')
    expect(prompts).toContain('Use the shared Claude skill instructions.')
  })

  it('does not auto-include regular unassigned local skills in runtime prompts', async () => {
    const localSkill: Skill = {
      id: 'local-skill',
      name: 'Workspace Local Skill',
      description: 'Regular local skill',
      enabled: true,
      source: 'local',
      content: 'This should require explicit agent assignment.',
      frontmatter: { name: 'Workspace Local Skill', description: 'Regular local skill' },
      context: 'inline',
    }

    const prompts = await getSkillSystemPrompts([], [localSkill])

    expect(prompts).toBe('')
  })
})