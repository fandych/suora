import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { DB_SCHEMA_VERSION } from './dbMigrations'
import { SCHEMA_HISTORY_TABLE, getDatabasePath, openSuoraDatabase, type SuoraDatabase } from './database'

const tempDirectories: string[] = []

async function makeWorkspace(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'suora-db-'))
  tempDirectories.push(directory)
  return directory
}

function readMigrationHistory(appDatabase: SuoraDatabase): Array<{
  version: number
  script: string
  checksum: string
  success: number
}> {
  const statement = appDatabase.database.prepare(
    `SELECT version, script, checksum, success
     FROM ${SCHEMA_HISTORY_TABLE}
     ORDER BY installed_rank`,
  )
  const rows: Array<{ version: number; script: string; checksum: string; success: number }> = []
  try {
    while (statement.step()) {
      const row = statement.getAsObject() as Record<string, unknown>
      rows.push({
        version: Number(row.version),
        script: String(row.script),
        checksum: String(row.checksum),
        success: Number(row.success),
      })
    }
  } finally {
    statement.free()
  }
  return rows
}

function hasTable(appDatabase: SuoraDatabase, tableName: string): boolean {
  const statement = appDatabase.database.prepare(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table' AND name = ?`,
  )
  try {
    statement.bind([tableName])
    return statement.step()
  } finally {
    statement.free()
  }
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
    expect(readMigrationHistory(appDatabase).map(({ version, script, success }) => ({ version, script, success }))).toEqual([
      { version: 1, script: 'V1__initial_schema.sql', success: 1 },
      { version: 2, script: 'V2__persisted_app_state_and_timer_executions.sql', success: 1 },
    ])

    await appDatabase.close()
    await expect(fs.stat(getDatabasePath(workspace))).resolves.toBeTruthy()
  })

  it('backfills migration history for legacy current databases', async () => {
    const workspace = await makeWorkspace()
    const appDatabase = await openSuoraDatabase(workspace)

    appDatabase.database.run(`DROP TABLE ${SCHEMA_HISTORY_TABLE}`)
    appDatabase.database.run(`PRAGMA user_version = ${DB_SCHEMA_VERSION}`)
    await appDatabase.close()

    const reopened = await openSuoraDatabase(workspace)

    expect(reopened.schemaVersion).toBe(DB_SCHEMA_VERSION)
    expect(readMigrationHistory(reopened).map(({ version, script, success }) => ({ version, script, success }))).toEqual([
      { version: 1, script: 'V1__initial_schema.sql', success: 1 },
      { version: 2, script: 'V2__persisted_app_state_and_timer_executions.sql', success: 1 },
    ])

    await reopened.close()
  })

  it('upgrades legacy v1 databases and records the v2 migration', async () => {
    const workspace = await makeWorkspace()
    const appDatabase = await openSuoraDatabase(workspace)

    appDatabase.database.run(`DROP TABLE ${SCHEMA_HISTORY_TABLE}`)
    appDatabase.database.run('DROP TABLE app_state')
    appDatabase.database.run('DROP TABLE timer_executions')
    appDatabase.database.run('PRAGMA user_version = 1')
    await appDatabase.close()

    const upgraded = await openSuoraDatabase(workspace)

    expect(upgraded.schemaVersion).toBe(DB_SCHEMA_VERSION)
    expect(hasTable(upgraded, 'app_state')).toBe(true)
    expect(hasTable(upgraded, 'timer_executions')).toBe(true)
    expect(readMigrationHistory(upgraded).map(({ version, script, success }) => ({ version, script, success }))).toEqual([
      { version: 1, script: 'V1__initial_schema.sql', success: 1 },
      { version: 2, script: 'V2__persisted_app_state_and_timer_executions.sql', success: 1 },
    ])

    await upgraded.close()
  })

  it('rejects modified applied migration checksums', async () => {
    const workspace = await makeWorkspace()
    const appDatabase = await openSuoraDatabase(workspace)

    appDatabase.database.run(`UPDATE ${SCHEMA_HISTORY_TABLE} SET checksum = ? WHERE version = 1`, ['changed'])
    await appDatabase.close()

    await expect(openSuoraDatabase(workspace)).rejects.toThrow(/checksum mismatch/)
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