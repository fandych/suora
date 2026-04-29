import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { SUORA_STORAGE_VERSION, getDatabasePath, openSuoraDatabase } from './database'

const tempDirectories: string[] = []

async function makeWorkspace(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'suora-fs-store-'))
  tempDirectories.push(directory)
  return directory
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T
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
    const payload = JSON.stringify({
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

    const reopened = await openSuoraDatabase(workspace)
    const restored = JSON.parse((await reopened.getPersistedStore('suora-store')) ?? '{}') as { state: Record<string, unknown>; version: number }

    expect(restored.version).toBe(18)
    expect(restored.state.sessions).toEqual([{ id: 'session-1', title: 'Chat', createdAt: 1, updatedAt: 2, messages: [{ id: 'msg-1', role: 'user', content: 'Hi', timestamp: 3 }] }])
    expect(restored.state.selectedAgent).toMatchObject({ id: 'agent-1', memories: [{ id: 'memory-1' }] })
    expect(restored.state.agentPipelines).toEqual([{ id: 'pipeline-1', updatedAt: 1 }])

    await reopened.close()
  })

  it('persists generic store payloads in settings metadata', async () => {
    const workspace = await makeWorkspace()
    const appDatabase = await openSuoraDatabase(workspace)
    const payload = JSON.stringify({ state: { value: true }, version: 1 })

    await appDatabase.savePersistedStore('other-store', payload, 1)
    await appDatabase.close()

    const reopened = await openSuoraDatabase(workspace)
    expect(await reopened.getPersistedStore('other-store')).toBe(payload)

    await reopened.deletePersistedStore('other-store')
    expect(await reopened.getPersistedStore('other-store')).toBeNull()

    await reopened.close()
  })
})
