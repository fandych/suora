import fs from 'fs/promises'
import path from 'path'
import { createHash } from 'crypto'
import { createRequire } from 'module'
import initSqlJs from 'sql.js'
import type { Database as SqlDatabase, SqlJsStatic } from 'sql.js'
import { DB_MIGRATIONS, DB_SCHEMA_VERSION } from './dbMigrations.js'

const require = createRequire(import.meta.url)

export const SUORA_DB_FILENAME = 'suora.db'
export const SCHEMA_HISTORY_TABLE = 'suora_schema_history'

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

interface AppliedMigration {
  version: number
  description: string
  script: string
  checksum: string
  success: boolean
}

function getMigrationChecksum(statements: string[]): string {
  return createHash('sha256').update(statements.join('\n-- statement boundary --\n')).digest('hex')
}

function ensureSchemaHistoryTable(database: SqlDatabase): void {
  database.run(
    `CREATE TABLE IF NOT EXISTS ${SCHEMA_HISTORY_TABLE} (
      installed_rank INTEGER PRIMARY KEY,
      version INTEGER NOT NULL UNIQUE,
      description TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'SQL',
      script TEXT NOT NULL,
      checksum TEXT NOT NULL,
      installed_by TEXT NOT NULL,
      installed_on INTEGER NOT NULL,
      execution_time INTEGER NOT NULL,
      success INTEGER NOT NULL
    )`,
  )
  database.run(
    `CREATE INDEX IF NOT EXISTS idx_${SCHEMA_HISTORY_TABLE}_success
     ON ${SCHEMA_HISTORY_TABLE}(success)`,
  )
}

function getAppliedMigrations(database: SqlDatabase): Map<number, AppliedMigration> {
  const statement = database.prepare(
    `SELECT version, description, script, checksum, success
     FROM ${SCHEMA_HISTORY_TABLE}
     ORDER BY installed_rank`,
  )
  const migrations = new Map<number, AppliedMigration>()
  try {
    while (statement.step()) {
      const row = statement.getAsObject() as Record<string, unknown>
      migrations.set(Number(row.version), {
        version: Number(row.version),
        description: String(row.description ?? ''),
        script: String(row.script ?? ''),
        checksum: String(row.checksum ?? ''),
        success: Number(row.success) === 1,
      })
    }
  } finally {
    statement.free()
  }
  return migrations
}

function insertMigrationHistory(
  database: SqlDatabase,
  migration: (typeof DB_MIGRATIONS)[number],
  checksum: string,
  executionTime: number,
  success: boolean,
): void {
  database.run(
    `INSERT INTO ${SCHEMA_HISTORY_TABLE} (
       installed_rank,
       version,
       description,
       type,
       script,
       checksum,
       installed_by,
       installed_on,
       execution_time,
       success
     ) VALUES (
       (SELECT COALESCE(MAX(installed_rank), 0) + 1 FROM ${SCHEMA_HISTORY_TABLE}),
       ?, ?, 'SQL', ?, ?, ?, ?, ?, ?
     )`,
    [
      migration.version,
      migration.description,
      migration.script,
      checksum,
      'suora',
      Date.now(),
      executionTime,
      success ? 1 : 0,
    ],
  )
}

function backfillLegacyMigrationHistory(database: SqlDatabase, userVersion: number): boolean {
  const applied = getAppliedMigrations(database)
  if (applied.size > 0 || userVersion <= 0) return false

  const legacyMigrations = DB_MIGRATIONS.filter((migration) => migration.version <= userVersion)
  if (legacyMigrations.length === 0) return false

  database.run('BEGIN')
  try {
    for (const migration of legacyMigrations) {
      insertMigrationHistory(database, migration, getMigrationChecksum(migration.statements), 0, true)
    }
    database.run('COMMIT')
    return true
  } catch (error) {
    database.run('ROLLBACK')
    throw error
  }
}

function validateAppliedMigrations(applied: Map<number, AppliedMigration>): void {
  for (const migration of DB_MIGRATIONS) {
    const current = applied.get(migration.version)
    if (!current) continue
    if (!current.success) {
      throw new Error(`Database migration ${migration.script} previously failed`)
    }
    const expectedChecksum = getMigrationChecksum(migration.statements)
    if (current.checksum !== expectedChecksum) {
      throw new Error(
        `Database migration checksum mismatch for ${migration.script}. Expected ${expectedChecksum}, found ${current.checksum}`,
      )
    }
  }
}

function runMigrations(database: SqlDatabase): boolean {
  ensureSchemaHistoryTable(database)
  let changed = backfillLegacyMigrationHistory(database, getUserVersion(database))
  let applied = getAppliedMigrations(database)
  validateAppliedMigrations(applied)

  const pending = DB_MIGRATIONS.filter((migration) => !applied.has(migration.version))
  for (const migration of pending) {
    const startedAt = Date.now()
    const checksum = getMigrationChecksum(migration.statements)
    database.run('BEGIN')
    try {
      for (const statement of migration.statements) {
        database.run(statement)
      }
      insertMigrationHistory(database, migration, checksum, Date.now() - startedAt, true)
      database.run(`PRAGMA user_version = ${migration.version}`)
      database.run('COMMIT')
      changed = true
    } catch (error) {
      database.run('ROLLBACK')
      throw error
    }
  }

  applied = getAppliedMigrations(database)
  validateAppliedMigrations(applied)
  if (getUserVersion(database) !== DB_SCHEMA_VERSION) {
    database.run(`PRAGMA user_version = ${DB_SCHEMA_VERSION}`)
    changed = true
  }

  return changed
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
  const migrated = runMigrations(database)

  const appDatabase = new SuoraDatabase(filePath, database)
  if (!existing || migrated || appDatabase.schemaVersion !== DB_SCHEMA_VERSION) {
    await appDatabase.persist()
  }
  return appDatabase
}