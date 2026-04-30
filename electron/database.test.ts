import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { SUORA_STORAGE_VERSION, getDatabasePath, openSuoraDatabase } from './database'
import { safeParse, safeStringify } from '../src/utils/safeJson'

const tempDirectories: string[] = []

async function makeWorkspace(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'suora-fs-store-'))
  tempDirectories.push(directory)
  return directory
}

async function readJson<T>(filePath: string): Promise<T> {
  return safeParse<T>(await fs.readFile(filePath, 'utf-8'))
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })))
})

describe('SuoraDatabase', () => {
  it('creates the workspace filesystem storage layout', async () => {
    const workspace = await makeWorkspace()
    const appDatabase = await openSuoraDatabase(workspace)

    expect(appDatabase.path).toBe(getDatabasePath(workspace))
    expect(appDatabase.schemaVersion).toBe(SUORA_STORAGE_VERSION)

    await expect(fs.stat(path.join(workspace, 'sessions', 'index.json'))).resolves.toBeTruthy()
    await expect(fs.stat(path.join(workspace, 'timers', 'index.json'))).resolves.toBeTruthy()
    await expect(fs.stat(path.join(workspace, 'pipelines', 'index.json'))).resolves.toBeTruthy()
    await expect(fs.stat(path.join(workspace, 'agents', 'index.json'))).resolves.toBeTruthy()
    await expect(fs.stat(path.join(workspace, 'skills', 'index.json'))).resolves.toBeTruthy()
    await expect(fs.stat(path.join(workspace, 'documents', 'index.json'))).resolves.toBeTruthy()
    await expect(fs.stat(path.join(workspace, 'documents', 'indexes'))).resolves.toBeTruthy()
    await expect(fs.stat(path.join(workspace, 'channels', 'index.json'))).resolves.toBeTruthy()
    await expect(fs.stat(path.join(workspace, 'memories', 'index.json'))).resolves.toBeTruthy()
    await expect(fs.stat(path.join(workspace, 'settings.json'))).resolves.toBeTruthy()
    await expect(fs.stat(path.join(workspace, 'models.json'))).resolves.toBeTruthy()

    await appDatabase.close()
  })

  it('persists settings and JSON entities across reopen', async () => {
    const workspace = await makeWorkspace()
    const appDatabase = await openSuoraDatabase(workspace)

    await appDatabase.saveStateSlice('theme', 'dark')
    await appDatabase.saveJsonEntity('agents', 'agent-1', { id: 'agent-1', name: 'Assistant' })
    await appDatabase.close()

    const reopened = await openSuoraDatabase(workspace)
    const snapshot = await reopened.getSnapshot()

    expect(snapshot.settings).toMatchObject({ theme: 'dark' })
    expect(await reopened.listJsonTable('agents')).toEqual([{ id: 'agent-1', name: 'Assistant' }])

    await reopened.close()
  })

  it('splits Zustand app state into workspace files and rebuilds it on load', async () => {
    const workspace = await makeWorkspace()
    const appDatabase = await openSuoraDatabase(workspace)
    const payload = safeStringify({
      state: {
        sessions: [{ id: 'session-1', title: 'Chat', createdAt: 1, updatedAt: 2, messages: [{ id: 'msg-1', role: 'user', content: 'Hi', timestamp: 3 }] }],
        activeSessionId: 'session-1',
        openSessionTabs: ['session-1'],
        agents: [{ id: 'agent-1', name: 'Assistant', memories: [{ id: 'memory-1' }] }],
        selectedAgent: { id: 'agent-1' },
        providerConfigs: [{ id: 'openai', models: [] }],
        models: [{ id: 'openai:gpt-4.1', provider: 'openai' }],
        selectedModel: { id: 'openai:gpt-4.1', provider: 'openai' },
        globalMemories: [{ id: 'global-memory' }],
        channels: [{ id: 'channel-1' }],
        documentGroups: [{ id: 'document-group-1', name: 'Docs', color: '#12A8A0', createdAt: 1, updatedAt: 1 }],
        documentNodes: [
          { id: 'document-1', groupId: 'document-group-1', parentId: null, type: 'document', title: 'Intro', markdown: '# Intro', createdAt: 1, updatedAt: 1 },
          { id: 'folder-1', groupId: 'document-group-1', parentId: null, type: 'folder', title: 'Specs', createdAt: 2, updatedAt: 2 },
          { id: 'document-2', groupId: 'document-group-1', parentId: 'folder-1', type: 'document', title: 'Roadmap', markdown: '# Roadmap', createdAt: 3, updatedAt: 3 },
        ],
        selectedDocumentGroupId: 'document-group-1',
        selectedDocumentId: 'document-1',
        agentPipelines: [{ id: 'pipeline-1', updatedAt: 1 }],
        theme: 'dark',
      },
      version: 18,
    })

    await appDatabase.savePersistedStore('suora-store', payload, 18)
    await appDatabase.close()

    expect(await readJson(path.join(workspace, 'sessions', 'index.json'))).toMatchObject({
      sessions: [{ id: 'session-1', title: 'Chat', createdAt: 1, updatedAt: 2 }],
      activeSessionId: 'session-1',
    })
    expect(await readJson(path.join(workspace, 'sessions', 'session-1', 'conversation.json'))).toEqual({
      messages: [{ id: 'msg-1', role: 'user', content: 'Hi', timestamp: 3 }],
    })
    expect(await readJson(path.join(workspace, 'agents', 'agent-1', 'memories.json'))).toEqual([{ id: 'memory-1' }])
    expect(await readJson(path.join(workspace, 'models.json'))).toMatchObject({ providerConfigs: [{ id: 'openai', models: [] }] })
    const documentIndex = await readJson<{ groups: Array<Record<string, unknown>>; nodes?: unknown[] }>(path.join(workspace, 'documents', 'index.json'))
    expect(documentIndex).toMatchObject({
      groups: [{ id: 'document-group-1', name: 'Docs', color: '#12A8A0', indexPath: 'documents/indexes/Docs-index.json', createdAt: 1, updatedAt: 1 }],
      selectedGroupId: 'document-group-1',
      selectedDocumentId: 'document-1',
    })
    expect(documentIndex.nodes).toBeUndefined()
    const groupDocumentIndex = await readJson<{ groupId: string; nodes: Array<Record<string, unknown>> }>(path.join(workspace, 'documents', 'indexes', 'Docs-index.json'))
    expect(groupDocumentIndex).toMatchObject({
      groupId: 'document-group-1',
      nodes: [
        { id: 'document-1', groupId: 'document-group-1', parentId: null, type: 'document', title: 'Intro', filePath: 'documents/Docs/Intro.md', createdAt: 1, updatedAt: 1 },
        { id: 'folder-1', groupId: 'document-group-1', parentId: null, type: 'folder', title: 'Specs', path: 'documents/Docs/Specs', createdAt: 2, updatedAt: 2 },
        { id: 'document-2', groupId: 'document-group-1', parentId: 'folder-1', type: 'document', title: 'Roadmap', filePath: 'documents/Docs/Specs/Roadmap.md', createdAt: 3, updatedAt: 3 },
      ],
    })
    expect(groupDocumentIndex.nodes.some((node) => 'markdown' in node)).toBe(false)
    await expect(fs.readFile(path.join(workspace, 'documents', 'Docs', 'Intro.md'), 'utf-8')).resolves.toBe('# Intro')
    await expect(fs.readFile(path.join(workspace, 'documents', 'Docs', 'Specs', 'Roadmap.md'), 'utf-8')).resolves.toBe('# Roadmap')

    const settings = await readJson<Record<string, unknown>>(path.join(workspace, 'settings.json'))
    expect(settings.documentGroups).toBeUndefined()
    expect(settings.documentNodes).toBeUndefined()

    const reopened = await openSuoraDatabase(workspace)
    const restored = safeParse<{ state: Record<string, unknown>; version: number }>((await reopened.getPersistedStore('suora-store')) ?? '{}')

    expect(restored.version).toBe(18)
    expect(restored.state.sessions).toEqual([{ id: 'session-1', title: 'Chat', createdAt: 1, updatedAt: 2, messages: [{ id: 'msg-1', role: 'user', content: 'Hi', timestamp: 3 }] }])
    expect(restored.state.selectedAgent).toMatchObject({ id: 'agent-1', memories: [{ id: 'memory-1' }] })
    expect(restored.state.documentGroups).toEqual([{ id: 'document-group-1', name: 'Docs', color: '#12A8A0', createdAt: 1, updatedAt: 1 }])
    expect(restored.state.documentNodes).toEqual([
      { id: 'document-1', groupId: 'document-group-1', parentId: null, type: 'document', title: 'Intro', filePath: 'documents/Docs/Intro.md', markdown: '# Intro', createdAt: 1, updatedAt: 1 },
      { id: 'folder-1', groupId: 'document-group-1', parentId: null, type: 'folder', title: 'Specs', path: 'documents/Docs/Specs', createdAt: 2, updatedAt: 2 },
      { id: 'document-2', groupId: 'document-group-1', parentId: 'folder-1', type: 'document', title: 'Roadmap', filePath: 'documents/Docs/Specs/Roadmap.md', markdown: '# Roadmap', createdAt: 3, updatedAt: 3 },
    ])
    expect(restored.state.selectedDocumentGroupId).toBe('document-group-1')
    expect(restored.state.selectedDocumentId).toBe('document-1')
    expect(restored.state.agentPipelines).toEqual([{ id: 'pipeline-1', updatedAt: 1 }])

    await reopened.close()
  })

  it('loads legacy document state from settings when documents index is empty', async () => {
    const workspace = await makeWorkspace()
    await fs.mkdir(path.join(workspace, 'documents'), { recursive: true })
    await fs.writeFile(path.join(workspace, 'documents', 'index.json'), JSON.stringify({ groups: [], nodes: [], selectedGroupId: null, selectedDocumentId: null }))
    await fs.writeFile(path.join(workspace, 'settings.json'), JSON.stringify({
      _storeVersion: 18,
      documentGroups: [{ id: 'legacy-group', name: 'Legacy', color: '#12A8A0', createdAt: 1, updatedAt: 1 }],
      documentNodes: [{ id: 'legacy-doc', groupId: 'legacy-group', parentId: null, type: 'document', title: 'Legacy Doc', markdown: '', createdAt: 1, updatedAt: 1 }],
      selectedDocumentGroupId: 'legacy-group',
      selectedDocumentId: 'legacy-doc',
    }))

    const appDatabase = await openSuoraDatabase(workspace)
    const restored = safeParse<{ state: Record<string, unknown>; version: number }>((await appDatabase.getPersistedStore('suora-store')) ?? '{}')

    expect(restored.state.documentGroups).toEqual([{ id: 'legacy-group', name: 'Legacy', color: '#12A8A0', createdAt: 1, updatedAt: 1 }])
    expect(restored.state.documentNodes).toEqual([{ id: 'legacy-doc', groupId: 'legacy-group', parentId: null, type: 'document', title: 'Legacy Doc', markdown: '', createdAt: 1, updatedAt: 1 }])
    expect(restored.state.selectedDocumentGroupId).toBe('legacy-group')
    expect(restored.state.selectedDocumentId).toBe('legacy-doc')

    await appDatabase.close()
  })

  it('creates empty document folders and removes stale renamed markdown files', async () => {
    const workspace = await makeWorkspace()
    const appDatabase = await openSuoraDatabase(workspace)
    const baseState = {
      documentGroups: [{ id: 'document-group-1', name: 'Docs', color: '#12A8A0', createdAt: 1, updatedAt: 1 }],
      selectedDocumentGroupId: 'document-group-1',
      selectedDocumentId: 'document-1',
    }

    await appDatabase.savePersistedStore('suora-store', safeStringify({
      state: {
        ...baseState,
        documentNodes: [
          { id: 'folder-empty', groupId: 'document-group-1', parentId: null, type: 'folder', title: 'Empty', createdAt: 1, updatedAt: 1 },
          { id: 'document-1', groupId: 'document-group-1', parentId: null, type: 'document', title: 'Untitled Document', markdown: '# Draft', createdAt: 1, updatedAt: 1 },
        ],
      },
      version: 18,
    }), 18)

    await expect(fs.stat(path.join(workspace, 'documents', 'Docs', 'Empty'))).resolves.toBeTruthy()
    await expect(fs.readFile(path.join(workspace, 'documents', 'Docs', 'Untitled Document.md'), 'utf-8')).resolves.toBe('# Draft')

    await appDatabase.savePersistedStore('suora-store', safeStringify({
      state: {
        ...baseState,
        documentNodes: [
          { id: 'folder-empty', groupId: 'document-group-1', parentId: null, type: 'folder', title: 'Empty', createdAt: 1, updatedAt: 2 },
          { id: 'document-1', groupId: 'document-group-1', parentId: null, type: 'document', title: 'Roadmap', markdown: '# Roadmap', createdAt: 1, updatedAt: 2 },
        ],
      },
      version: 18,
    }), 18)

    await expect(fs.stat(path.join(workspace, 'documents', 'Docs', 'Untitled Document.md'))).rejects.toThrow()
    await expect(fs.readFile(path.join(workspace, 'documents', 'Docs', 'Roadmap.md'), 'utf-8')).resolves.toBe('# Roadmap')

    await appDatabase.close()
  })

  it('persists generic store payloads in settings metadata', async () => {
    const workspace = await makeWorkspace()
    const appDatabase = await openSuoraDatabase(workspace)
    const payload = safeStringify({ state: { value: true }, version: 1 })

    await appDatabase.savePersistedStore('other-store', payload, 1)
    await appDatabase.close()

    const reopened = await openSuoraDatabase(workspace)
    expect(await reopened.getPersistedStore('other-store')).toBe(payload)

    await reopened.deletePersistedStore('other-store')
    expect(await reopened.getPersistedStore('other-store')).toBeNull()

    await reopened.close()
  })

  it('stores timer and pipeline executions as one file per id', async () => {
    const workspace = await makeWorkspace()
    const appDatabase = await openSuoraDatabase(workspace)

    await appDatabase.saveJsonEntity('timer_executions', 'tx-1', { id: 'tx-1', timerId: 't-1', firedAt: 1 })
    await appDatabase.saveJsonEntity('timer_executions', 'tx-2', { id: 'tx-2', timerId: 't-1', firedAt: 2 })
    await appDatabase.saveJsonEntity('pipeline_executions', 'px-1', { id: 'px-1', pipelineId: 'p-1', startedAt: 10 })

    await expect(fs.stat(path.join(workspace, 'timers', 'executions', 'tx-1.json'))).resolves.toBeTruthy()
    await expect(fs.stat(path.join(workspace, 'timers', 'executions', 'tx-2.json'))).resolves.toBeTruthy()
    await expect(fs.stat(path.join(workspace, 'pipelines', 'executions', 'px-1.json'))).resolves.toBeTruthy()
    // The legacy single-file index should not be created for executions.
    await expect(fs.stat(path.join(workspace, 'timers', 'executions.json'))).rejects.toThrow()
    await expect(fs.stat(path.join(workspace, 'pipelines', 'executions.json'))).rejects.toThrow()

    const timers = await appDatabase.listJsonTable('timer_executions') as Array<{ id: string }>
    expect(timers.map((entry) => entry.id).sort()).toEqual(['tx-1', 'tx-2'])

    await appDatabase.deleteJsonEntity('timer_executions', 'tx-1')
    await expect(fs.stat(path.join(workspace, 'timers', 'executions', 'tx-1.json'))).rejects.toThrow()
    expect((await appDatabase.listJsonTable('timer_executions')).map((entry) => (entry as { id: string }).id)).toEqual(['tx-2'])

    await appDatabase.close()
  })

  it('round-trips rich JSON values through split store and entity files', async () => {
    const workspace = await makeWorkspace()
    const appDatabase = await openSuoraDatabase(workspace)
    const createdAt = new Date('2026-04-29T03:30:00.000Z')
    const payload = safeStringify({
      state: {
        sessions: [{
          id: 'session-rich',
          title: 'Rich',
          createdAt: createdAt.getTime(),
          updatedAt: createdAt.getTime(),
          messages: [{
            id: 'msg-rich',
            role: 'tool',
            content: 'done',
            timestamp: createdAt.getTime(),
            runtime: { startedAt: createdAt, flags: new Set(['a', 'b']) },
          }],
        }],
        agents: [],
        globalMemories: [{ id: 'memory-rich', createdAt, metadata: new Map([['kind', 'test']]) }],
      },
      version: 18,
    })

    await appDatabase.savePersistedStore('suora-store', payload, 18)
    await appDatabase.saveJsonEntity('timer_executions', 'tx-rich', {
      id: 'tx-rich',
      firedAt: createdAt,
      payload: new Map([['attempt', 1]]),
    })

    const reopened = await openSuoraDatabase(workspace)
    const restored = safeParse<{ state: Record<string, unknown> }>((await reopened.getPersistedStore('suora-store')) ?? '{}')
    const sessions = restored.state.sessions as Array<{ messages: Array<{ runtime: { startedAt: Date; flags: Set<string> } }> }>
    const memories = restored.state.globalMemories as Array<{ createdAt: Date; metadata: Map<string, string> }>
    const executions = await reopened.listJsonTable('timer_executions') as Array<{ id: string; firedAt: Date; payload: Map<string, number> }>

    expect(sessions[0].messages[0].runtime.startedAt).toBeInstanceOf(Date)
    expect(sessions[0].messages[0].runtime.flags).toBeInstanceOf(Set)
    expect(Array.from(sessions[0].messages[0].runtime.flags)).toEqual(['a', 'b'])
    expect(memories[0].createdAt).toBeInstanceOf(Date)
    expect(memories[0].metadata).toBeInstanceOf(Map)
    expect(memories[0].metadata.get('kind')).toBe('test')
    expect(executions.find((entry) => entry.id === 'tx-rich')?.firedAt).toBeInstanceOf(Date)
    expect(executions.find((entry) => entry.id === 'tx-rich')?.payload).toBeInstanceOf(Map)

    await reopened.close()
  })

  it('stores MCP server configs in a dedicated mcp folder', async () => {
    const workspace = await makeWorkspace()
    const appDatabase = await openSuoraDatabase(workspace)

    await expect(fs.stat(path.join(workspace, 'mcp', 'index.json'))).resolves.toBeTruthy()

    await appDatabase.saveJsonEntity('mcp_servers', 'mcp-1', { id: 'mcp-1', name: 'Local' })
    expect(await readJson(path.join(workspace, 'mcp', 'index.json'))).toEqual([{ id: 'mcp-1', name: 'Local' }])

    const settings = await readJson<Record<string, unknown>>(path.join(workspace, 'settings.json'))
    expect('mcpServers' in settings).toBe(false)

    await appDatabase.close()
  })

  it('migrates legacy executions.json files and settings.mcpServers on initialize', async () => {
    const workspace = await makeWorkspace()
    // Seed a workspace that mimics the previous layout.
    await fs.mkdir(path.join(workspace, 'timers'), { recursive: true })
    await fs.mkdir(path.join(workspace, 'pipelines'), { recursive: true })
    await fs.writeFile(
      path.join(workspace, 'timers', 'executions.json'),
      JSON.stringify([{ id: 'tx-old', timerId: 't', firedAt: 1 }]),
    )
    await fs.writeFile(
      path.join(workspace, 'pipelines', 'executions.json'),
      JSON.stringify([{ id: 'px-old', pipelineId: 'p', startedAt: 1 }]),
    )
    await fs.writeFile(
      path.join(workspace, 'settings.json'),
      JSON.stringify({ _storeVersion: 0, mcpServers: [{ id: 'mcp-old', name: 'Legacy' }], theme: 'dark' }),
    )

    const appDatabase = await openSuoraDatabase(workspace)

    await expect(fs.stat(path.join(workspace, 'timers', 'executions.json'))).rejects.toThrow()
    await expect(fs.stat(path.join(workspace, 'pipelines', 'executions.json'))).rejects.toThrow()
    expect(await readJson(path.join(workspace, 'timers', 'executions', 'tx-old.json'))).toMatchObject({ id: 'tx-old' })
    expect(await readJson(path.join(workspace, 'pipelines', 'executions', 'px-old.json'))).toMatchObject({ id: 'px-old' })
    expect(await readJson(path.join(workspace, 'mcp', 'index.json'))).toEqual([{ id: 'mcp-old', name: 'Legacy' }])

    const migratedSettings = await readJson<Record<string, unknown>>(path.join(workspace, 'settings.json'))
    expect('mcpServers' in migratedSettings).toBe(false)
    expect(migratedSettings.theme).toBe('dark')

    await appDatabase.close()
  })
})
