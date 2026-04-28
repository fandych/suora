import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { DB_SCHEMA_VERSION } from './dbMigrations'
import { getDatabasePath, openSuoraDatabase } from './database'

const tempDirectories: string[] = []

async function makeWorkspace(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'suora-db-'))
  tempDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })))
})

describe('SuoraDatabase', () => {
  it('creates a workspace SQLite database with the current schema', async () => {
    const workspace = await makeWorkspace()
    const appDatabase = await openSuoraDatabase(workspace)

    expect(appDatabase.path).toBe(getDatabasePath(workspace))
    expect(appDatabase.schemaVersion).toBe(DB_SCHEMA_VERSION)

    await appDatabase.close()
    await expect(fs.stat(getDatabasePath(workspace))).resolves.toBeTruthy()
  })

  it('persists settings and JSON entities across reopen', async () => {
    const workspace = await makeWorkspace()
    const appDatabase = await openSuoraDatabase(workspace)

    await appDatabase.saveStateSlice('theme', 'dark')
    await appDatabase.saveJsonEntity('agents', 'agent-1', { id: 'agent-1', name: 'Assistant' })
    await appDatabase.close()

    const reopened = await openSuoraDatabase(workspace)

    expect(reopened.getStateSlices()).toEqual({ theme: 'dark' })
    expect(reopened.listJsonTable('agents')).toEqual([{ id: 'agent-1', name: 'Assistant' }])

    await reopened.close()
  })

  it('persists app_state payloads across reopen', async () => {
    const workspace = await makeWorkspace()
    const appDatabase = await openSuoraDatabase(workspace)
    const payload = JSON.stringify({ state: { sessions: [{ id: 'session-1' }] }, version: 18 })

    await appDatabase.savePersistedStore('suora-store', payload, 18)
    await appDatabase.close()

    const reopened = await openSuoraDatabase(workspace)

    expect(reopened.getPersistedStore('suora-store')).toBe(payload)

    await reopened.close()
  })
})