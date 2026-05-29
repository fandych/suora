import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { Agent, DocumentGroup, DocumentNode, Model, Skill } from '@/types'
import { delegateToAgent } from '@/services/agentCommunication'
import { buildSystemPrompt, buildToolHints, builtinToolDefs, fetchMarketplaceSkills, getSkillSystemPrompts, getToolsForAgent, setLiveStoreAccessor, setLiveStoreWriter } from './tools'

vi.mock('@/services/agentCommunication', () => ({
  delegateToAgent: vi.fn(async () => 'Delegated response'),
}))

function getDescription(toolName: 'web_search' | 'list_documents' | 'query_document_graph' | 'read_document' | 'write_file' | 'append_file') {
  return (builtinToolDefs[toolName] as { description?: string }).description ?? ''
}

function installShallowLiveStore(initialState: Record<string, unknown>) {
  let liveState = initialState
  setLiveStoreAccessor(() => liveState)
  setLiveStoreWriter((updater) => {
    const nextState = { ...liveState }
    updater(nextState)
    liveState = nextState
  })
  return () => liveState
}

describe('builtin tool guidance', () => {
  beforeEach(() => {
    setLiveStoreAccessor(() => null)
    setLiveStoreWriter(() => false)
    vi.unstubAllGlobals()
    vi.mocked(delegateToAgent).mockClear()
  })

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

  it('hides merged legacy tool aliases from default agent tools while preserving explicit allowlists', () => {
    const defaultTools = getToolsForAgent([], [])
    expect(Object.keys(defaultTools)).toEqual(expect.arrayContaining([
      'todo_manage',
      'event_trigger_manage',
      'env_manage',
      'browser_extract',
    ]))
    expect(defaultTools).not.toHaveProperty('todo_add')
    expect(defaultTools).not.toHaveProperty('event_create_trigger')
    expect(defaultTools).not.toHaveProperty('env_set')
    expect(defaultTools).not.toHaveProperty('browser_extract_text')

    const legacyAllowedTools = getToolsForAgent([], [], { allowedTools: ['todo_add'] })
    expect(Object.keys(legacyAllowedTools)).toEqual(['todo_add'])
  })

  it('exports consolidated management tools as top-level object schemas', () => {
    for (const toolName of ['todo_manage', 'event_trigger_manage', 'env_manage', 'browser_extract']) {
      const jsonSchema = z.toJSONSchema(builtinToolDefs[toolName].inputSchema as z.ZodTypeAny) as { type?: string }
      expect(jsonSchema.type, toolName).toBe('object')
    }
  })

  it('exports every built-in tool with a top-level object schema', () => {
    for (const [toolName, definition] of Object.entries(builtinToolDefs)) {
      const jsonSchema = z.toJSONSchema(definition.inputSchema as z.ZodTypeAny) as { type?: string }
      expect(jsonSchema.type, toolName).toBe('object')
    }
  })

  it('stores classified tool errors as deduplicated session memories', async () => {
    const liveState: Record<string, unknown> = {
      workspacePath: '/workspace',
      activeSessionId: 'session-1',
      sessions: [{ id: 'session-1', memories: [] }],
      agents: [],
      skills: [],
      toolSecurity: {
        sandboxMode: 'strict',
        requireConfirmation: false,
        allowedDirectories: ['/workspace'],
        blockedCommands: [],
      },
    }
    setLiveStoreAccessor(() => liveState)
    setLiveStoreWriter((updater) => {
      updater(liveState)
    })

    const tools = getToolsForAgent([], [], {
      allowedTools: ['read_file'],
      errorContext: {
        sessionId: 'session-1',
        source: 'chat',
      },
    })

    const executeReadFile = tools.read_file.execute as unknown as (input: { path: string }, options: { toolCallId: string; messages: [] }) => Promise<string>

    await expect(executeReadFile({ path: '/outside/file.txt' }, { toolCallId: 'tool-call-1', messages: [] })).resolves.toContain('Path blocked')
    await expect(executeReadFile({ path: '/outside/file.txt' }, { toolCallId: 'tool-call-2', messages: [] })).resolves.toContain('Path blocked')

    const sessions = liveState.sessions as Array<{ memories?: Array<{ content: string; scope: string; targetId?: string; tags?: string[] }> }>
    expect(sessions[0].memories).toHaveLength(1)
    expect(sessions[0].memories?.[0]).toMatchObject({
      scope: 'session',
      targetId: 'session-1',
    })
    expect(sessions[0].memories?.[0].content).toContain('Tool: read_file')
    expect(sessions[0].memories?.[0].content).toContain('Recommended fix:')
    expect(sessions[0].memories?.[0].tags).toEqual(expect.arrayContaining(['tool-error', 'tool:read_file', 'error:path']))
  })

  it('instructs auto-learning agents to store reusable tool failure corrections', () => {
    const prompt = buildSystemPrompt({
      autoLearn: true,
      toolNames: ['run_command', 'memory_store'],
    })

    expect(prompt).toContain('failed tool calls')
    expect(prompt).toContain('type="correction"')
    expect(prompt).toContain('avoid making the same failing call again')
  })

  it('manages environment variables through the consolidated env_manage tool', async () => {
    const toolOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.env_manage.execute>>[1]
    const liveState: Record<string, unknown> = { envVariables: [] }

    setLiveStoreAccessor(() => liveState)
    setLiveStoreWriter((updater) => {
      updater(liveState)
      return true
    })

    await expect(builtinToolDefs.env_manage.execute?.({
      action: 'set',
      key: 'API_TOKEN',
      value: 'secret-value',
      secret: true,
    }, toolOptions)).resolves.toContain('created')

    await expect(builtinToolDefs.env_manage.execute?.({ action: 'list' }, toolOptions)).resolves.toContain('API_TOKEN = ********')
    await expect(builtinToolDefs.env_manage.execute?.({ action: 'get', key: 'API_TOKEN' }, toolOptions)).resolves.toBe('secret-value')
    await expect(builtinToolDefs.env_manage.execute?.({ action: 'delete', key: 'API_TOKEN' }, toolOptions)).resolves.toContain('deleted')
    expect(liveState.envVariables).toEqual([])
  })

  it('updates todos through todo_manage without applying add/list defaults', async () => {
    const toolOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.todo_manage.execute>>[1]
    const invoke = vi.fn(async (channel: string, key: string, value?: string) => {
      if (channel === 'db:loadPersistedStore') {
        return {
          data: JSON.stringify([{
            id: 'todo-1',
            title: 'Original title',
            description: 'Keep this description',
            status: 'pending',
            priority: 'high',
            createdAt: '2026-05-10T00:00:00.000Z',
            updatedAt: '2026-05-10T00:00:00.000Z',
          }]),
        }
      }
      if (channel === 'db:savePersistedStore') {
        return { success: true, key, value }
      }
      return undefined
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
      await expect(builtinToolDefs.todo_manage.execute?.({
        action: 'update',
        id: 'todo-1',
        title: 'Updated title',
      }, toolOptions)).resolves.toContain('Updated todo: Updated title')

      const saved = JSON.parse(String(invoke.mock.calls.find((call) => call[0] === 'db:savePersistedStore')?.[2])) as Array<Record<string, unknown>>
      expect(saved[0]).toMatchObject({
        title: 'Updated title',
        description: 'Keep this description',
        priority: 'high',
        status: 'pending',
      })
    } finally {
      Reflect.deleteProperty(window, 'electron')
    }
  })

  it('rejects schedule event triggers without a cron pattern', async () => {
    const createSchema = builtinToolDefs.event_create_trigger.inputSchema as z.ZodTypeAny
    const manageSchema = builtinToolDefs.event_trigger_manage.inputSchema as z.ZodTypeAny

    expect(createSchema.safeParse({
      name: 'Morning trigger',
      type: 'schedule',
      agent_id: 'agent-1',
      prompt_template: 'Run the morning routine',
    }).success).toBe(false)

    expect(manageSchema.safeParse({
      action: 'create',
      name: 'Morning trigger',
      type: 'schedule',
      agent_id: 'agent-1',
      prompt_template: 'Run the morning routine',
    }).success).toBe(false)

    const toolOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.event_create_trigger.execute>>[1]
    await expect(builtinToolDefs.event_create_trigger.execute?.({
      name: 'Morning trigger',
      type: 'schedule',
      agent_id: 'agent-1',
      prompt_template: 'Run the morning routine',
    }, toolOptions)).resolves.toContain('schedule triggers require pattern')
  })

  it('notifies agents through live store state instead of cached persistence', async () => {
    const toolOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.agent_notify.execute>>[1]
    const liveState: Record<string, unknown> = {
      activeSessionId: 'session-live',
      agents: [{
        id: 'agent-1',
        name: 'Research Analyst',
        enabled: true,
        memories: [],
      }],
    }

    setLiveStoreAccessor(() => liveState)
    setLiveStoreWriter((updater) => {
      updater(liveState)
      return true
    })

    await expect(builtinToolDefs.agent_notify.execute?.({
      agent_name: 'research',
      message: 'Remember the launch context.',
    }, toolOptions)).resolves.toContain('Notification sent')

    expect(liveState.agents).toEqual([
      expect.objectContaining({
        id: 'agent-1',
        memories: [expect.objectContaining({
          content: '[Notification from agent] Remember the launch context.',
          source: 'session-live',
        })],
      }),
    ])
  })

  it('delegates to agents resolved from live store state', async () => {
    const toolOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.agent_delegate.execute>>[1]
    setLiveStoreAccessor(() => ({
      selectedAgent: { id: 'agent-source' },
      agents: [
        { id: 'agent-source', name: 'Assistant', enabled: true },
        { id: 'agent-target', name: 'Research Analyst', enabled: true },
      ],
    }))

    await expect(builtinToolDefs.agent_delegate.execute?.({
      agent_name: 'research',
      task: 'Check the launch notes',
      context: 'Use workspace docs',
    }, toolOptions)).resolves.toBe('Delegated response')

    expect(delegateToAgent).toHaveBeenCalledWith(
      'agent-source',
      'agent-target',
      'Check the launch notes',
      'Use workspace docs',
    )
  })

  it('creates and improves skills through live store state', async () => {
    const createOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.skill_create.execute>>[1]
    const improveOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.skill_improve.execute>>[1]
    const liveState: Record<string, unknown> = { skills: [] }

    setLiveStoreAccessor(() => liveState)
    setLiveStoreWriter((updater) => {
      updater(liveState)
      return true
    })

    await expect(builtinToolDefs.skill_create.execute?.({
      name: 'Launch Skill',
      description: 'Helps with launch planning.',
      prompt: 'Plan launches carefully.',
      reason: 'Needed for launch work',
    }, createOptions)).resolves.toContain('Created new skill')

    const createdSkill = (liveState.skills as Array<Record<string, unknown>>)[0]
    expect(createdSkill).toMatchObject({
      name: 'Launch Skill',
      description: 'Helps with launch planning.',
      prompt: 'Plan launches carefully.',
    })

    await expect(builtinToolDefs.skill_improve.execute?.({
      skill_id: String(createdSkill.id),
      updates: JSON.stringify({ description: 'Improved launch planning skill.', prompt: 'Plan launches with milestones.', ignored: true }),
      reason: 'Tighten instructions',
    }, improveOptions)).resolves.toContain('Improved skill')

    expect((liveState.skills as Array<Record<string, unknown>>)[0]).toMatchObject({
      description: 'Improved launch planning skill.',
      prompt: 'Plan launches with milestones.',
    })
    expect((liveState.skills as Array<Record<string, unknown>>)[0]).not.toHaveProperty('ignored')
  })

  it('reads marketplace settings from live store state', async () => {
    const privateUrl = 'https://example.test/private-skills.json'
    const fetch = vi.fn(async () => new Response(JSON.stringify([
      {
        id: 'private-skill',
        name: 'Private Skill',
        description: 'Loaded from a private registry.',
        enabled: true,
        source: 'registry',
        content: 'Use private instructions.',
      },
    ]), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    setLiveStoreAccessor(() => ({
      marketplace: { source: 'private', privateUrl },
    }))

    const skills = await fetchMarketplaceSkills()

    expect(fetch).toHaveBeenCalledWith(privateUrl, { cache: 'no-store' })
    expect(skills[0]).toMatchObject({ id: 'private-skill', name: 'Private Skill' })
  })

  it('replaces live store collection references when updating nested tool data', async () => {
    const envOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.env_set.execute>>[1]
    const toggleSkillOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.toggle_skill.execute>>[1]
    const memoryStoreOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.memory_store.execute>>[1]
    const memoryDeleteOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.memory_delete.execute>>[1]
    const envVariables = [{ key: 'API_TOKEN', value: 'old', secret: true, createdAt: 1, updatedAt: 1 }]
    const skills = [{ id: 'skill-1', name: 'Launch Skill', enabled: true }]
    const agents = [{
      id: 'agent-1',
      name: 'Assistant',
      enabled: true,
      memories: [{ id: 'memory-old', content: 'Old memory', type: 'knowledge', scope: 'session', createdAt: 1, source: 'session-1' }],
    }]
    const sessions = [{ id: 'session-1', memories: [] }]
    const globalMemories: Array<Record<string, unknown>> = []
    const getState = installShallowLiveStore({
      selectedAgent: { id: 'agent-1' },
      activeSessionId: 'session-1',
      agents,
      sessions,
      skills,
      envVariables,
      globalMemories,
    })

    await expect(builtinToolDefs.env_set.execute?.({
      key: 'API_TOKEN',
      value: 'new',
      secret: false,
    }, envOptions)).resolves.toContain('updated')
    expect(getState().envVariables).not.toBe(envVariables)
    expect(envVariables[0].value).toBe('old')

    await expect(builtinToolDefs.toggle_skill.execute?.({
      skill_id: 'skill-1',
      enabled: false,
    }, toggleSkillOptions)).resolves.toContain('disabled')
    expect(getState().skills).not.toBe(skills)
    expect(skills[0].enabled).toBe(true)

    await expect(builtinToolDefs.memory_store.execute?.({
      content: 'New session memory',
      type: 'knowledge',
      scope: 'session',
    }, memoryStoreOptions)).resolves.toContain('Stored session knowledge memory')
    const sessionsAfterStore = getState().sessions as typeof sessions
    expect(sessionsAfterStore).not.toBe(sessions)
    expect(sessions[0].memories).toHaveLength(0)

    await expect(builtinToolDefs.memory_delete.execute?.({ id: 'memory-old' }, memoryDeleteOptions)).resolves.toContain('Deleted memory')
    expect(getState().agents).not.toBe(agents)
    expect(((getState().agents as typeof agents)[0].memories).map((memory) => memory.id)).not.toContain('memory-old')

    await expect(builtinToolDefs.memory_store.execute?.({
      content: 'New global memory',
      type: 'knowledge',
      scope: 'global',
    }, memoryStoreOptions)).resolves.toContain('Stored global knowledge memory')
    expect(getState().globalMemories).not.toBe(globalMemories)
    expect(globalMemories).toEqual([])
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

  it('creates documents in the selected group and syncs live store state', async () => {
    const toolOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.create_document.execute>>[1]
    const group: DocumentGroup = { id: 'group-1', name: 'Docs', color: '#12A8A0', createdAt: 1, updatedAt: 1 }
    const liveState: Record<string, unknown> = {
      documentGroups: [group],
      documentNodes: [],
      selectedDocumentGroupId: group.id,
      selectedDocumentId: null,
      toolSecurity: {
        allowedDirectories: [],
        blockedCommands: [],
        requireConfirmation: false,
        sandboxMode: 'workspace',
      },
    }

    setLiveStoreAccessor(() => liveState)
    setLiveStoreWriter((updater) => {
      updater(liveState)
      return true
    })

    const output = await builtinToolDefs.create_document.execute?.({
      title: 'Launch Brief',
      markdown: '# Launch Brief\n\nOwner: Ops',
      reason: 'Save the launch summary as a document',
    }, toolOptions)

    expect(output).toContain('Created document "Launch Brief"')
    expect((liveState.documentNodes as DocumentNode[])).toHaveLength(1)
    expect((liveState.documentNodes as DocumentNode[])[0]).toMatchObject({
      type: 'document',
      title: 'Launch Brief',
      groupId: group.id,
      markdown: '# Launch Brief\n\nOwner: Ops',
    })
    expect(liveState.selectedDocumentGroupId).toBe(group.id)
    expect(liveState.selectedDocumentId).toBe((liveState.documentNodes as DocumentNode[])[0]?.id)
  })

  it('creates a default group when none exists before creating a document', async () => {
    const toolOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.create_document.execute>>[1]
    const liveState: Record<string, unknown> = {
      documentGroups: [],
      documentNodes: [],
      selectedDocumentGroupId: null,
      selectedDocumentId: null,
      toolSecurity: {
        allowedDirectories: [],
        blockedCommands: [],
        requireConfirmation: false,
        sandboxMode: 'workspace',
      },
    }

    setLiveStoreAccessor(() => liveState)
    setLiveStoreWriter((updater) => {
      updater(liveState)
      return true
    })

    const output = await builtinToolDefs.create_document.execute?.({
      title: 'First Note',
      reason: 'Create the first workspace note',
    }, toolOptions)

    expect(output).toContain('Created document "First Note"')
    expect((liveState.documentGroups as DocumentGroup[])).toHaveLength(1)
    expect((liveState.documentNodes as DocumentNode[])).toHaveLength(1)
    expect((liveState.documentNodes as DocumentNode[])[0]).toMatchObject({
      type: 'document',
      title: 'First Note',
      groupId: (liveState.documentGroups as DocumentGroup[])[0]?.id,
    })
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

  it('creates saved agents through the agent_add tool and records a version snapshot', async () => {
    const toolOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.agent_add.execute>>[1]
    const skill: Skill = {
      id: 'skill-1',
      name: 'Launch skill',
      description: 'Help with launches.',
      enabled: true,
      source: 'local',
      content: 'Help with launches.',
      frontmatter: { name: 'Launch skill', description: 'Help with launches.' },
      context: 'inline',
    }
    const liveState: Record<string, unknown> = {
      agents: [],
      selectedAgent: null,
      models: [],
      skills: [skill],
      agentVersions: [],
    }

    setLiveStoreAccessor(() => liveState)
    setLiveStoreWriter((updater) => {
      updater(liveState)
      return true
    })

    const output = await builtinToolDefs.agent_add.execute?.({
      name: 'Launch Planner',
      system_prompt: 'Plan launches with explicit milestones.',
      skills: JSON.stringify(['skill-1']),
      allowed_tools: JSON.stringify(['agent_list']),
      auto_learn: true,
    }, toolOptions)

    const parsed = JSON.parse(String(output)) as {
      message: string
      storeSynced: boolean
      agent: { id: string; name: string; skills: string[]; allowedTools: string[]; autoLearn: boolean }
    }

    expect(parsed.message).toContain('Created agent')
    expect(parsed.storeSynced).toBe(true)
    expect(parsed.agent).toMatchObject({
      name: 'Launch Planner',
      skills: ['skill-1'],
      allowedTools: ['agent_list'],
      autoLearn: true,
    })
    expect(liveState.agents).toEqual([
      expect.objectContaining({ id: parsed.agent.id, name: 'Launch Planner' }),
    ])
    expect(liveState.selectedAgent).toEqual(expect.objectContaining({ id: parsed.agent.id, name: 'Launch Planner' }))
    expect(liveState.agentVersions).toEqual([
      expect.objectContaining({ agentId: parsed.agent.id, source: 'manual', snapshot: expect.objectContaining({ name: 'Launch Planner' }) }),
    ])
  })

  it('updates saved agents through the agent_update tool and keeps selectedAgent in sync', async () => {
    const toolOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.agent_update.execute>>[1]
    const existingAgent: Agent = {
      id: 'agent-1',
      name: 'Launch Planner',
      systemPrompt: 'Plan launches with explicit milestones.',
      modelId: '',
      skills: [],
      temperature: 0.7,
      maxTokens: 4096,
      enabled: true,
      greeting: 'Hello',
      responseStyle: 'balanced',
      allowedTools: ['agent_list'],
      disallowedTools: [],
      memories: [],
      autoLearn: false,
    }
    const skill: Skill = {
      id: 'skill-1',
      name: 'Launch skill',
      description: 'Help with launches.',
      enabled: true,
      source: 'local',
      content: 'Help with launches.',
      frontmatter: { name: 'Launch skill', description: 'Help with launches.' },
      context: 'inline',
    }
    const liveState: Record<string, unknown> = {
      agents: [existingAgent],
      selectedAgent: existingAgent,
      models: [],
      skills: [skill],
      agentVersions: [],
    }

    setLiveStoreAccessor(() => liveState)
    setLiveStoreWriter((updater) => {
      updater(liveState)
      return true
    })

    const parsedInput = (builtinToolDefs.agent_update.inputSchema as z.ZodTypeAny).safeParse({
      agent_id: 'agent-1',
      skills: JSON.stringify(['skill-1']),
      allowed_tools: JSON.stringify(['agent_list', 'agent_update']),
      greeting: null,
      auto_learn: true,
    })

    expect(parsedInput.success).toBe(true)
    if (!parsedInput.success) return

    const output = await builtinToolDefs.agent_update.execute?.(parsedInput.data, toolOptions)
    const result = JSON.parse(String(output)) as {
      message: string
      storeSynced: boolean
      agent: { id: string; skills: string[]; allowedTools: string[]; greeting: string | null; autoLearn: boolean }
    }

    expect(result.message).toContain('Updated agent')
    expect(result.storeSynced).toBe(true)
    expect(result.agent).toMatchObject({
      id: 'agent-1',
      skills: ['skill-1'],
      allowedTools: ['agent_list', 'agent_update'],
      greeting: null,
      autoLearn: true,
    })
    expect(liveState.agents).toEqual([
      expect.objectContaining({ id: 'agent-1', skills: ['skill-1'], allowedTools: ['agent_list', 'agent_update'], greeting: undefined, autoLearn: true }),
    ])
    expect(liveState.selectedAgent).toEqual(expect.objectContaining({ id: 'agent-1', skills: ['skill-1'], autoLearn: true }))
    expect(liveState.agentVersions).toEqual([
      expect.objectContaining({ agentId: 'agent-1', source: 'manual', snapshot: expect.objectContaining({ allowedTools: ['agent_list', 'agent_update'] }) }),
    ])
  })

  it('removes saved agents through the agent_remove tool and detaches dependent sessions', async () => {
    const toolOptions = {} as Parameters<NonNullable<typeof builtinToolDefs.agent_remove.execute>>[1]
    const existingAgent: Agent = {
      id: 'agent-1',
      name: 'Launch Planner',
      systemPrompt: 'Plan launches with explicit milestones.',
      modelId: '',
      skills: [],
      enabled: true,
      memories: [],
      autoLearn: false,
    }
    const liveState: Record<string, unknown> = {
      agents: [existingAgent],
      selectedAgent: existingAgent,
      models: [],
      skills: [],
      sessions: [{ id: 'session-1', agentId: 'agent-1' }],
    }

    setLiveStoreAccessor(() => liveState)
    setLiveStoreWriter((updater) => {
      updater(liveState)
      return true
    })

    const output = await builtinToolDefs.agent_remove.execute?.({ agent_id: 'agent-1' }, toolOptions)
    const parsed = JSON.parse(String(output)) as { message: string; agentId: string; storeSynced: boolean }

    expect(parsed.message).toContain('Removed agent')
    expect(parsed.agentId).toBe('agent-1')
    expect(parsed.storeSynced).toBe(true)
    expect(liveState.agents).toEqual([])
    expect(liveState.selectedAgent).toBeNull()
    expect(liveState.sessions).toEqual([{ id: 'session-1', agentId: undefined }])
  })

  it('accepts cron schedules for timer_add and timer_update tool calls', () => {
    const timerAddInputSchema = builtinToolDefs.timer_add.inputSchema as z.ZodTypeAny
    const timerUpdateInputSchema = builtinToolDefs.timer_update.inputSchema as z.ZodTypeAny

    const addParsed = timerAddInputSchema.safeParse({
      name: 'Weekday report reminder',
      type: 'cron',
      schedule: '0 9 * * 1-5',
      action: 'notify',
      prompt: 'Read the daily report',
    })
    const updateParsed = timerUpdateInputSchema.safeParse({
      id: 'timer-1',
      type: 'cron',
      schedule: '30 8 * * 1-5',
    })

    expect(addParsed.success).toBe(true)
    expect(updateParsed.success).toBe(true)
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