import fs from 'fs/promises'
import path from 'path'
import { createRequire } from 'module'
import initSqlJs from 'sql.js'
import type { Database as SqlDatabase, SqlJsStatic } from 'sql.js'
import { DB_MIGRATIONS, DB_SCHEMA_VERSION } from './dbMigrations.js'

const require = createRequire(import.meta.url)

export const SUORA_DB_FILENAME = 'suora.db'

export type JsonTableName =
  | 'provider_configs'
  | 'models'
  | 'agents'
  | 'skills'
  | 'channels'
  | 'channel_messages'
  | 'mcp_servers'
  | 'timers'
  | 'timer_executions'
  | 'pipelines'
  | 'pipeline_executions'
  | 'memories'

const JSON_TABLES = new Set<JsonTableName>([
  'provider_configs',
  'models',
  'agents',
  'skills',
  'channels',
  'channel_messages',
  'mcp_servers',
  'timers',
  'timer_executions',
  'pipelines',
  'pipeline_executions',
  'memories',
])

let sqlModulePromise: Promise<SqlJsStatic> | null = null

function assertJsonTable(table: JsonTableName): void {
  if (!JSON_TABLES.has(table)) throw new Error(`Unsupported database table: ${table}`)
}

function getSqlModule(): Promise<SqlJsStatic> {
  if (!sqlModulePromise) {
    sqlModulePromise = (async () => {
      const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')
      const wasmBuffer = await fs.readFile(wasmPath)
      const wasmBinary = wasmBuffer.buffer.slice(
        wasmBuffer.byteOffset,
        wasmBuffer.byteOffset + wasmBuffer.byteLength,
      ) as ArrayBuffer
      return initSqlJs({ wasmBinary })
    })()
  }
  return sqlModulePromise
}

async function atomicWriteBuffer(filePath: string, data: Uint8Array): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tempPath, data)
  try {
    await fs.rename(tempPath, filePath)
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {})
    throw error
  }
}

function getUserVersion(database: SqlDatabase): number {
  const result = database.exec('PRAGMA user_version')
  return Number(result[0]?.values[0]?.[0] ?? 0)
}

function runMigrations(database: SqlDatabase): void {
  const currentVersion = getUserVersion(database)
  const pending = DB_MIGRATIONS.filter((migration) => migration.version > currentVersion)
  if (pending.length === 0) return

  database.run('BEGIN')
  try {
    for (const migration of pending) {
      for (const statement of migration.statements) {
        database.run(statement)
      }
      database.run(`PRAGMA user_version = ${migration.version}`)
    }
    database.run('COMMIT')
  } catch (error) {
    database.run('ROLLBACK')
    throw error
  }
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return null
  return JSON.parse(value)
}

export function getDatabasePath(workspacePath: string): string {
  return path.join(workspacePath, SUORA_DB_FILENAME)
}

export class SuoraDatabase {
  readonly path: string
  readonly database: SqlDatabase

  constructor(filePath: string, database: SqlDatabase) {
    this.path = filePath
    this.database = database
  }

  get schemaVersion(): number {
    return getUserVersion(this.database)
  }

  async persist(): Promise<void> {
    await atomicWriteBuffer(this.path, this.database.export())
  }

  async close(): Promise<void> {
    await this.persist()
    this.database.close()
  }

  getStateSlices(): Record<string, unknown> {
    const statement = this.database.prepare('SELECT key, value_json FROM settings ORDER BY key')
    const slices: Record<string, unknown> = {}
    try {
      while (statement.step()) {
        const row = statement.getAsObject() as { key?: unknown; value_json?: unknown }
        if (typeof row.key === 'string') slices[row.key] = parseJson(row.value_json)
      }
    } finally {
      statement.free()
    }
    return slices
  }

  async saveStateSlice(key: string, value: unknown): Promise<void> {
    this.database.run(
      `INSERT INTO settings (key, value_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      [key, JSON.stringify(value), Date.now()],
    )
    await this.persist()
  }

  getPersistedStore(key: string): string | null {
    const statement = this.database.prepare('SELECT value_json FROM app_state WHERE key = ?')
    try {
      statement.bind([key])
      if (!statement.step()) return null
      const row = statement.getAsObject() as { value_json?: unknown }
      return typeof row.value_json === 'string' ? row.value_json : null
    } finally {
      statement.free()
    }
  }

  async savePersistedStore(key: string, serializedValue: string, version: number): Promise<void> {
    JSON.parse(serializedValue)
    this.database.run(
      `INSERT INTO app_state (key, value_json, version, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value_json = excluded.value_json,
         version = excluded.version,
         updated_at = excluded.updated_at`,
      [key, serializedValue, version, Date.now()],
    )
    await this.persist()
  }

  async deletePersistedStore(key: string): Promise<void> {
    this.database.run('DELETE FROM app_state WHERE key = ?', [key])
    await this.persist()
  }

  listJsonTable(table: JsonTableName): unknown[] {
    assertJsonTable(table)
    const statement = this.database.prepare(`SELECT value_json FROM ${table} ORDER BY updated_at DESC`)
    const rows: unknown[] = []
    try {
      while (statement.step()) {
        const row = statement.getAsObject() as { value_json?: unknown }
        rows.push(parseJson(row.value_json))
      }
    } finally {
      statement.free()
    }
    return rows
  }

  async saveJsonEntity(table: JsonTableName, id: string, value: unknown): Promise<void> {
    assertJsonTable(table)
    this.database.run(
      `INSERT INTO ${table} (id, value_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      [id, JSON.stringify(value), Date.now()],
    )
    await this.persist()
  }

  async deleteJsonEntity(table: JsonTableName, id: string): Promise<void> {
    assertJsonTable(table)
    this.database.run(`DELETE FROM ${table} WHERE id = ?`, [id])
    await this.persist()
  }

  getSnapshot(): Record<string, unknown> {
    return {
      schemaVersion: this.schemaVersion,
      settings: this.getStateSlices(),
      providerConfigs: this.listJsonTable('provider_configs'),
      models: this.listJsonTable('models'),
      agents: this.listJsonTable('agents'),
      skills: this.listJsonTable('skills'),
      channels: this.listJsonTable('channels'),
      channelMessages: this.listJsonTable('channel_messages'),
      mcpServers: this.listJsonTable('mcp_servers'),
      timers: this.listJsonTable('timers'),
      timerExecutions: this.listJsonTable('timer_executions'),
      pipelines: this.listJsonTable('pipelines'),
      pipelineExecutions: this.listJsonTable('pipeline_executions'),
      memories: this.listJsonTable('memories'),
    }
  }
}

export async function openSuoraDatabase(workspacePath: string): Promise<SuoraDatabase> {
  const SQL = await getSqlModule()
  const filePath = getDatabasePath(workspacePath)
  let existing: Uint8Array | undefined

  try {
    existing = new Uint8Array(await fs.readFile(filePath))
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') throw error
  }

  const database = new SQL.Database(existing)
  database.run('PRAGMA foreign_keys = ON')
  runMigrations(database)

  const appDatabase = new SuoraDatabase(filePath, database)
  if (!existing || appDatabase.schemaVersion !== DB_SCHEMA_VERSION) {
    await appDatabase.persist()
  }
  return appDatabase
}