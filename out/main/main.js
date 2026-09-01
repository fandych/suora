import { app, ipcMain, nativeImage, BrowserWindow } from "electron";
import { Buffer as Buffer$1 } from "node:buffer";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import http from "node:http";
import https from "node:https";
import { spawn } from "node:child_process";
import electronUpdater from "electron-updater";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const runtimeMigrations = [
  {
    id: 1,
    statements: [
      `
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        chatbot_id TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY NOT NULL,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS workflow_versions (
        id TEXT PRIMARY KEY NOT NULL,
        workflow_id TEXT NOT NULL,
        major INTEGER NOT NULL,
        minor INTEGER NOT NULL,
        is_release INTEGER NOT NULL DEFAULT 0,
        definition_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS skill_versions (
        id TEXT PRIMARY KEY NOT NULL,
        skill_id TEXT NOT NULL,
        major INTEGER NOT NULL,
        minor INTEGER NOT NULL,
        is_release INTEGER NOT NULL DEFAULT 0,
        files_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS document_versions (
        id TEXT PRIMARY KEY NOT NULL,
        document_id TEXT NOT NULL,
        major INTEGER NOT NULL,
        minor INTEGER NOT NULL,
        is_release INTEGER NOT NULL DEFAULT 0,
        structure_json TEXT NOT NULL,
        graph_json TEXT NOT NULL,
        settings_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
      `
    ]
  },
  {
    id: 2,
    statements: [
      `
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        provider_type TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS integrations (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        endpoint TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS schedulers (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        schedule TEXT NOT NULL DEFAULT '',
        time_zone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
        target_type TEXT NOT NULL DEFAULT 'workflow',
        target_id TEXT NOT NULL DEFAULT '',
        target_name TEXT NOT NULL DEFAULT '',
        missed_run_policy TEXT NOT NULL DEFAULT 'skip',
        retry_limit INTEGER NOT NULL DEFAULT 0,
        retry_backoff_seconds INTEGER NOT NULL DEFAULT 300,
        input_payload_json TEXT NOT NULL DEFAULT '{}',
        updated_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        platform TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
      `,
      `
      ALTER TABLE skills ADD COLUMN source TEXT NOT NULL DEFAULT 'custom'
      `
    ]
  },
  {
    id: 3,
    statements: [
      `
      CREATE TABLE IF NOT EXISTS workflow_invocations (
        id TEXT PRIMARY KEY NOT NULL,
        workflow_id TEXT NOT NULL,
        version_id TEXT NOT NULL,
        status TEXT NOT NULL,
        trigger TEXT NOT NULL,
        input_json TEXT NOT NULL,
        output_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS integration_versions (
        id TEXT PRIMARY KEY NOT NULL,
        integration_id TEXT NOT NULL,
        major INTEGER NOT NULL,
        minor INTEGER NOT NULL,
        is_release INTEGER NOT NULL DEFAULT 0,
        config_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
      `
    ]
  },
  {
    id: 4,
    statements: [
      `
      ALTER TABLE workflow_invocations ADD COLUMN trace_json TEXT NOT NULL DEFAULT '[]'
      `,
      `
      CREATE TABLE IF NOT EXISTS integration_executions (
        id TEXT PRIMARY KEY NOT NULL,
        integration_id TEXT NOT NULL,
        version_id TEXT NOT NULL,
        status TEXT NOT NULL,
        input_json TEXT NOT NULL,
        output_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
      `
    ]
  },
  {
    id: 5,
    statements: [
      `ALTER TABLE providers ADD COLUMN base_url TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE providers ADD COLUMN api_key TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE providers ADD COLUMN models_json TEXT NOT NULL DEFAULT '[]'`,
      `ALTER TABLE providers ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1`
    ]
  },
  {
    id: 6,
    statements: [
      `
      CREATE TABLE IF NOT EXISTS agent_versions (
        id TEXT PRIMARY KEY NOT NULL,
        agent_id TEXT NOT NULL,
        major INTEGER NOT NULL,
        minor INTEGER NOT NULL,
        is_release INTEGER NOT NULL DEFAULT 0,
        config_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
      `
    ]
  },
  {
    id: 7,
    statements: [
      `ALTER TABLE schedulers ADD COLUMN description TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE schedulers ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE schedulers ADD COLUMN time_zone TEXT NOT NULL DEFAULT 'Asia/Shanghai'`,
      `ALTER TABLE schedulers ADD COLUMN target_type TEXT NOT NULL DEFAULT 'workflow'`,
      `ALTER TABLE schedulers ADD COLUMN target_id TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE schedulers ADD COLUMN target_name TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE schedulers ADD COLUMN missed_run_policy TEXT NOT NULL DEFAULT 'skip'`,
      `ALTER TABLE schedulers ADD COLUMN retry_limit INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE schedulers ADD COLUMN retry_backoff_seconds INTEGER NOT NULL DEFAULT 300`,
      `ALTER TABLE schedulers ADD COLUMN input_payload_json TEXT NOT NULL DEFAULT '{}'`
    ],
    ignoreErrorsMatching: [
      /duplicate column name: description/i,
      /duplicate column name: enabled/i,
      /duplicate column name: time_zone/i,
      /duplicate column name: target_type/i,
      /duplicate column name: target_id/i,
      /duplicate column name: target_name/i,
      /duplicate column name: missed_run_policy/i,
      /duplicate column name: retry_limit/i,
      /duplicate column name: retry_backoff_seconds/i,
      /duplicate column name: input_payload_json/i
    ]
  },
  {
    id: 8,
    statements: [
      `ALTER TABLE schedulers ADD COLUMN description TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE schedulers ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE schedulers ADD COLUMN time_zone TEXT NOT NULL DEFAULT 'Asia/Shanghai'`,
      `ALTER TABLE schedulers ADD COLUMN target_type TEXT NOT NULL DEFAULT 'workflow'`,
      `ALTER TABLE schedulers ADD COLUMN target_id TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE schedulers ADD COLUMN target_name TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE schedulers ADD COLUMN missed_run_policy TEXT NOT NULL DEFAULT 'skip'`,
      `ALTER TABLE schedulers ADD COLUMN retry_limit INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE schedulers ADD COLUMN retry_backoff_seconds INTEGER NOT NULL DEFAULT 300`,
      `ALTER TABLE schedulers ADD COLUMN input_payload_json TEXT NOT NULL DEFAULT '{}'`
    ],
    ignoreErrorsMatching: [
      /duplicate column name: description/i,
      /duplicate column name: enabled/i,
      /duplicate column name: time_zone/i,
      /duplicate column name: target_type/i,
      /duplicate column name: target_id/i,
      /duplicate column name: target_name/i,
      /duplicate column name: missed_run_policy/i,
      /duplicate column name: retry_limit/i,
      /duplicate column name: retry_backoff_seconds/i,
      /duplicate column name: input_payload_json/i
    ]
  }
];
const appState = {
  isDev: !app.isPackaged,
  mainWindow: null,
  sqlite: null,
  activeAiRequests: /* @__PURE__ */ new Map(),
  currentProxySettings: {
    enabled: false,
    type: "http",
    host: "",
    port: 0
  }
};
function setMainWindow(mainWindow) {
  appState.mainWindow = mainWindow;
}
function getWorkspacePath() {
  return path.join(app.getPath("userData"), "workspace");
}
function getDatabasePath() {
  return path.join(getWorkspacePath(), "suora.sqlite");
}
function openDatabase() {
  if (appState.sqlite) {
    return appState.sqlite;
  }
  appState.sqlite = new DatabaseSync(getDatabasePath());
  appState.sqlite.exec("PRAGMA journal_mode = WAL");
  appState.sqlite.exec("PRAGMA foreign_keys = ON");
  return appState.sqlite;
}
function applyMigrations(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS __app_migrations (
      id INTEGER PRIMARY KEY NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
  const appliedIds = new Set(
    database.prepare("SELECT id FROM __app_migrations ORDER BY id ASC").all().map((row) => Number(row.id))
  );
  for (const migration of runtimeMigrations) {
    if (appliedIds.has(migration.id)) {
      continue;
    }
    try {
      database.exec("BEGIN");
      for (const statement of migration.statements) {
        try {
          database.exec(statement);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!migration.ignoreErrorsMatching?.some((pattern) => pattern.test(message))) {
            throw error;
          }
        }
      }
      database.prepare("INSERT INTO __app_migrations (id) VALUES (?)").run(migration.id);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}
function mapRows(rows) {
  return rows.map((row) => {
    if (!row || typeof row !== "object") {
      return row;
    }
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        value instanceof Uint8Array ? Buffer$1.from(value).toString("utf8") : value
      ])
    );
  });
}
function prepareStatement(database, sql) {
  const statement = database.prepare(sql);
  statement.setReturnArrays(true);
  statement.setReadBigInts(false);
  return statement;
}
function normalizeSqlParams(params) {
  return params.map((value) => {
    if (value === void 0) {
      return null;
    }
    if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
      return value;
    }
    if (ArrayBuffer.isView(value)) {
      return value;
    }
    return JSON.stringify(value);
  });
}
function executeQuery(payload) {
  const database = openDatabase();
  applyMigrations(database);
  const statement = prepareStatement(database, payload.sql);
  const params = normalizeSqlParams(payload.params);
  switch (payload.method) {
    case "run": {
      statement.run(...params);
      return { rows: [] };
    }
    case "get": {
      statement.setReturnArrays(false);
      const row = statement.get(...params);
      return { rows: row ? [row] : [] };
    }
    case "values": {
      statement.setReturnArrays(true);
      return { rows: statement.all(...params) };
    }
    case "all":
    default: {
      statement.setReturnArrays(false);
      return { rows: mapRows(statement.all(...params)) };
    }
  }
}
function closeDatabase() {
  appState.sqlite?.close();
  appState.sqlite = null;
}
async function ensureWorkspace() {
  await fs.mkdir(getWorkspacePath(), { recursive: true });
}
function configureAppStoragePaths() {
  app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
}
function registerAutomationIpc() {
  ipcMain.handle("integrations:list", async () => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    return database.prepare(`SELECT id, title, kind, endpoint, updated_at as updatedAt FROM integrations ORDER BY updated_at DESC`).all();
  });
  ipcMain.handle("integrations:get", async (_event, integrationId) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    return {
      integration: database.prepare(`SELECT id, title, kind, endpoint, updated_at as updatedAt FROM integrations WHERE id = ?`).get(integrationId) ?? null,
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, config_json as configJson FROM integration_versions WHERE integration_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(integrationId),
      executions: database.prepare(`SELECT id, version_id as versionId, status, input_json as input, output_json as output, created_at as createdAt FROM integration_executions WHERE integration_id = ? ORDER BY created_at DESC`).all(integrationId)
    };
  });
  ipcMain.handle("integrations:create", async (_event, payload) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    const integrationId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const now = Date.now();
    database.prepare(`INSERT INTO integrations (id, title, kind, endpoint, updated_at) VALUES (?, ?, ?, ?, ?)`).run(integrationId, payload?.title || `New ${payload?.kind || "http"} integration`, payload?.kind || "http", payload?.endpoint || "", now);
    database.prepare(`INSERT INTO integration_versions (id, integration_id, major, minor, is_release, config_json, created_at) VALUES (?, ?, 1, 0, 0, ?, ?)`).run(versionId, integrationId, payload?.configJson || "{}", now);
    return {
      integration: database.prepare(`SELECT id, title, kind, endpoint, updated_at as updatedAt FROM integrations WHERE id = ?`).get(integrationId),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, config_json as configJson FROM integration_versions WHERE integration_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(integrationId),
      executions: []
    };
  });
  ipcMain.handle("integrations:save", async (_event, payload) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    const latest = database.prepare(`SELECT major, minor, is_release as isRelease FROM integration_versions WHERE integration_id = ? ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id);
    const nextMajor = !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major;
    const nextMinor = !latest ? 0 : latest.isRelease ? 0 : latest.minor + 1;
    const versionId = crypto.randomUUID();
    const now = Date.now();
    database.prepare(`UPDATE integrations SET title = ?, kind = ?, endpoint = ?, updated_at = ? WHERE id = ?`).run(payload.title, payload.kind, payload.endpoint, now, payload.id);
    database.prepare(`INSERT INTO integration_versions (id, integration_id, major, minor, is_release, config_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(versionId, payload.id, nextMajor, nextMinor, payload.publish ? 1 : 0, payload.configJson, now);
    return {
      integration: database.prepare(`SELECT id, title, kind, endpoint, updated_at as updatedAt FROM integrations WHERE id = ?`).get(payload.id),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, config_json as configJson FROM integration_versions WHERE integration_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(payload.id),
      executions: database.prepare(`SELECT id, version_id as versionId, status, input_json as input, output_json as output, created_at as createdAt FROM integration_executions WHERE integration_id = ? ORDER BY created_at DESC`).all(payload.id)
    };
  });
  ipcMain.handle("integrations:recordExecution", async (_event, payload) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    database.prepare(`INSERT INTO integration_executions (id, integration_id, version_id, status, input_json, output_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), payload.id, payload.versionId, payload.status, payload.input, payload.output, Date.now());
    return database.prepare(`SELECT id, version_id as versionId, status, input_json as input, output_json as output, created_at as createdAt FROM integration_executions WHERE integration_id = ? ORDER BY created_at DESC`).all(payload.id);
  });
  ipcMain.handle("workflows:list", async () => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    return database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM workflows ORDER BY updated_at DESC`).all();
  });
  ipcMain.handle("workflows:get", async (_event, workflowId) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    return {
      workflow: database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM workflows WHERE id = ?`).get(workflowId) ?? null,
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, definition_json as definitionJson FROM workflow_versions WHERE workflow_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(workflowId),
      invocations: database.prepare(`SELECT id, version_id as versionId, status, trigger, input_json as input, output_json as output, trace_json as traceJson, created_at as createdAt FROM workflow_invocations WHERE workflow_id = ? ORDER BY created_at DESC`).all(workflowId)
    };
  });
  ipcMain.handle("workflows:create", async () => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    const workflowId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const now = Date.now();
    const definition = JSON.stringify({ nodes: [{ id: "start", type: "input", position: { x: 60, y: 140 }, data: { label: "Start", prompt: "Capture input variables.", kind: "start" } }], edges: [], viewport: { x: 0, y: 0, zoom: 1 } });
    database.prepare(`INSERT INTO workflows (id, title, summary, updated_at) VALUES (?, ?, ?, ?)`).run(workflowId, "New workflow", "", now);
    database.prepare(`INSERT INTO workflow_versions (id, workflow_id, major, minor, is_release, definition_json, created_at) VALUES (?, ?, 1, 0, 0, ?, ?)`).run(versionId, workflowId, definition, now);
    return {
      workflow: database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM workflows WHERE id = ?`).get(workflowId),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, definition_json as definitionJson FROM workflow_versions WHERE workflow_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(workflowId),
      invocations: []
    };
  });
  ipcMain.handle("workflows:save", async (_event, payload) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    const latest = database.prepare(`SELECT major, minor, is_release as isRelease FROM workflow_versions WHERE workflow_id = ? ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id);
    const nextMajor = !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major;
    const nextMinor = !latest ? 0 : latest.isRelease ? 0 : latest.minor + 1;
    const versionId = crypto.randomUUID();
    const now = Date.now();
    database.prepare(`UPDATE workflows SET title = ?, summary = ?, updated_at = ? WHERE id = ?`).run(payload.title, payload.summary, now, payload.id);
    database.prepare(`INSERT INTO workflow_versions (id, workflow_id, major, minor, is_release, definition_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(versionId, payload.id, nextMajor, nextMinor, payload.publish ? 1 : 0, payload.definitionJson, now);
    return {
      workflow: database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM workflows WHERE id = ?`).get(payload.id),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, definition_json as definitionJson FROM workflow_versions WHERE workflow_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(payload.id),
      invocations: database.prepare(`SELECT id, version_id as versionId, status, trigger, input_json as input, output_json as output, trace_json as traceJson, created_at as createdAt FROM workflow_invocations WHERE workflow_id = ? ORDER BY created_at DESC`).all(payload.id)
    };
  });
  ipcMain.handle("workflows:recordInvocation", async (_event, payload) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    database.prepare(`INSERT INTO workflow_invocations (id, workflow_id, version_id, status, trigger, input_json, output_json, trace_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), payload.workflowId, payload.versionId, payload.status, payload.trigger, payload.input, payload.output, payload.traceJson, Date.now());
    return database.prepare(`SELECT id, version_id as versionId, status, trigger, input_json as input, output_json as output, trace_json as traceJson, created_at as createdAt FROM workflow_invocations WHERE workflow_id = ? ORDER BY created_at DESC`).all(payload.workflowId);
  });
  ipcMain.handle("channels:list", async () => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    return database.prepare(`SELECT id, title, platform, updated_at as updatedAt FROM channels ORDER BY updated_at DESC`).all();
  });
  ipcMain.handle("channels:get", async (_event, channelId) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    return database.prepare(`SELECT id, title, platform, updated_at as updatedAt FROM channels WHERE id = ?`).get(channelId) ?? null;
  });
  ipcMain.handle("channels:create", async () => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    const channelId = crypto.randomUUID();
    const now = Date.now();
    database.prepare(`INSERT INTO channels (id, title, platform, updated_at) VALUES (?, ?, ?, ?)`).run(channelId, "New channel", "web", now);
    return database.prepare(`SELECT id, title, platform, updated_at as updatedAt FROM channels WHERE id = ?`).get(channelId);
  });
  ipcMain.handle("channels:save", async (_event, payload) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    database.prepare(`UPDATE channels SET title = ?, platform = ?, updated_at = ? WHERE id = ?`).run(payload.title, payload.platform, Date.now(), payload.id);
    return database.prepare(`SELECT id, title, platform, updated_at as updatedAt FROM channels WHERE id = ?`).get(payload.id);
  });
  ipcMain.handle("channels:delete", async (_event, channelId) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    database.prepare(`DELETE FROM channels WHERE id = ?`).run(channelId);
    return { success: true };
  });
  ipcMain.handle("schedulers:list", async () => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    return database.prepare(`SELECT id, title, description, enabled, schedule, time_zone as timeZone, target_type as targetType, target_id as targetId, target_name as targetName, missed_run_policy as missedRunPolicy, retry_limit as retryLimit, retry_backoff_seconds as retryBackoffSeconds, input_payload_json as inputPayloadJson, updated_at as updatedAt FROM schedulers ORDER BY updated_at DESC`).all();
  });
  ipcMain.handle("schedulers:get", async (_event, schedulerId) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    return database.prepare(`SELECT id, title, description, enabled, schedule, time_zone as timeZone, target_type as targetType, target_id as targetId, target_name as targetName, missed_run_policy as missedRunPolicy, retry_limit as retryLimit, retry_backoff_seconds as retryBackoffSeconds, input_payload_json as inputPayloadJson, updated_at as updatedAt FROM schedulers WHERE id = ?`).get(schedulerId) ?? null;
  });
  ipcMain.handle("schedulers:create", async () => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    const schedulerId = crypto.randomUUID();
    const now = Date.now();
    database.prepare(`INSERT INTO schedulers (id, title, description, enabled, schedule, time_zone, target_type, target_id, target_name, missed_run_policy, retry_limit, retry_backoff_seconds, input_payload_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      schedulerId,
      "New scheduler",
      "",
      1,
      "0 9 * * *",
      "Asia/Shanghai",
      "workflow",
      "",
      "",
      "skip",
      0,
      300,
      "{}",
      now
    );
    return database.prepare(`SELECT id, title, description, enabled, schedule, time_zone as timeZone, target_type as targetType, target_id as targetId, target_name as targetName, missed_run_policy as missedRunPolicy, retry_limit as retryLimit, retry_backoff_seconds as retryBackoffSeconds, input_payload_json as inputPayloadJson, updated_at as updatedAt FROM schedulers WHERE id = ?`).get(schedulerId);
  });
  ipcMain.handle("schedulers:save", async (_event, payload) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    database.prepare(`UPDATE schedulers SET title = ?, description = ?, enabled = ?, schedule = ?, time_zone = ?, target_type = ?, target_id = ?, target_name = ?, missed_run_policy = ?, retry_limit = ?, retry_backoff_seconds = ?, input_payload_json = ?, updated_at = ? WHERE id = ?`).run(
      payload.title,
      payload.description,
      payload.enabled ? 1 : 0,
      payload.schedule,
      payload.timeZone,
      payload.targetType,
      payload.targetId,
      payload.targetName,
      payload.missedRunPolicy,
      payload.retryLimit,
      payload.retryBackoffSeconds,
      payload.inputPayloadJson,
      Date.now(),
      payload.id
    );
    return database.prepare(`SELECT id, title, description, enabled, schedule, time_zone as timeZone, target_type as targetType, target_id as targetId, target_name as targetName, missed_run_policy as missedRunPolicy, retry_limit as retryLimit, retry_backoff_seconds as retryBackoffSeconds, input_payload_json as inputPayloadJson, updated_at as updatedAt FROM schedulers WHERE id = ?`).get(payload.id);
  });
  ipcMain.handle("preferences:get", async () => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    const row = database.prepare(`SELECT value FROM app_meta WHERE key = 'preference_settings'`).get();
    return row?.value ?? null;
  });
  ipcMain.handle("preferences:save", async (_event, value) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    database.prepare(`INSERT INTO app_meta (key, value) VALUES ('preference_settings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(value);
    return value;
  });
}
function registerCatalogIpc() {
  ipcMain.handle("models:list", async () => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    return database.prepare(`SELECT id, title, provider_type as providerType, base_url as baseUrl, api_key as apiKey, models_json as modelsJson, enabled, updated_at as updatedAt FROM providers ORDER BY updated_at DESC`).all();
  });
  ipcMain.handle("models:get", async (_event, providerId) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    return database.prepare(`SELECT id, title, provider_type as providerType, base_url as baseUrl, api_key as apiKey, models_json as modelsJson, enabled, updated_at as updatedAt FROM providers WHERE id = ?`).get(providerId) ?? null;
  });
  ipcMain.handle("models:create", async (_event, payload) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    const now = Date.now();
    const providerId = crypto.randomUUID();
    const title = payload?.title?.trim() || "New provider";
    const providerType = payload?.providerType?.trim() || "openai-compatible";
    const baseUrl = payload?.baseUrl?.trim() || "";
    const apiKey = payload?.apiKey || "";
    const modelsJson = payload?.modelsJson || "[]";
    const enabled = payload?.enabled ?? true;
    database.prepare(`INSERT INTO providers (id, title, provider_type, base_url, api_key, models_json, enabled, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(providerId, title, providerType, baseUrl, apiKey, modelsJson, enabled ? 1 : 0, now);
    return database.prepare(`SELECT id, title, provider_type as providerType, base_url as baseUrl, api_key as apiKey, models_json as modelsJson, enabled, updated_at as updatedAt FROM providers WHERE id = ?`).get(providerId);
  });
  ipcMain.handle("models:save", async (_event, payload) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    database.prepare(`UPDATE providers SET title = ?, provider_type = ?, base_url = ?, api_key = ?, models_json = ?, enabled = ?, updated_at = ? WHERE id = ?`).run(payload.title, payload.providerType, payload.baseUrl, payload.apiKey, payload.modelsJson, payload.enabled ? 1 : 0, Date.now(), payload.id);
    return database.prepare(`SELECT id, title, provider_type as providerType, base_url as baseUrl, api_key as apiKey, models_json as modelsJson, enabled, updated_at as updatedAt FROM providers WHERE id = ?`).get(payload.id);
  });
  ipcMain.handle("models:delete", async (_event, providerId) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    database.prepare(`DELETE FROM providers WHERE id = ?`).run(providerId);
    return { success: true };
  });
  ipcMain.handle("skills:list", async () => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    return database.prepare(`SELECT id, title, source, summary, updated_at as updatedAt FROM skills ORDER BY updated_at DESC`).all();
  });
  ipcMain.handle("skills:get", async (_event, skillId) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    return {
      skill: database.prepare(`SELECT id, title, source, summary, updated_at as updatedAt FROM skills WHERE id = ?`).get(skillId) ?? null,
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, files_json as filesJson FROM skill_versions WHERE skill_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(skillId)
    };
  });
  ipcMain.handle("skills:create", async () => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    const now = Date.now();
    const skillId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    database.prepare(`INSERT INTO skills (id, title, source, summary, updated_at) VALUES (?, ?, ?, ?, ?)`).run(skillId, "New skill", "custom", "", now);
    database.prepare(`INSERT INTO skill_versions (id, skill_id, major, minor, is_release, files_json, created_at) VALUES (?, ?, 1, 0, 0, ?, ?)`).run(versionId, skillId, JSON.stringify([
      { path: "SKILL.md", content: '---\nname: "New skill"\ndescription: "Describe what this skill does and when to use it."\n---\n\n## Purpose\n\nDescribe the skill intent, triggers, and limits here.\n', language: "md", kind: "file" },
      { path: "references", content: "", language: "txt", kind: "directory" },
      { path: "references/README.md", content: "# References\n\nCapture related docs, notes, or external links for this skill.", language: "md", kind: "file" },
      { path: "assets", content: "", language: "txt", kind: "directory" },
      { path: "assets/.gitkeep", content: "", language: "txt", kind: "file" },
      { path: "scripts", content: "", language: "txt", kind: "directory" },
      { path: "scripts/main.ts", content: "export async function main(input: unknown) {\n  return { ok: true, input }\n}\n", language: "ts", kind: "file", executable: true },
      { path: "other", content: "", language: "txt", kind: "directory" },
      { path: "other/notes.md", content: "# Notes\n\nAdd extra snippets or implementation notes here.\n", language: "md", kind: "file" }
    ]), now);
    return {
      skill: database.prepare(`SELECT id, title, source, summary, updated_at as updatedAt FROM skills WHERE id = ?`).get(skillId),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, files_json as filesJson FROM skill_versions WHERE skill_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(skillId)
    };
  });
  ipcMain.handle("skills:save", async (_event, payload) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    const latest = database.prepare(`SELECT major, minor, is_release as isRelease FROM skill_versions WHERE skill_id = ? ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id);
    const nextMajor = !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major;
    const nextMinor = !latest ? 0 : latest.isRelease ? 0 : latest.minor + 1;
    const versionId = crypto.randomUUID();
    const now = Date.now();
    database.prepare(`UPDATE skills SET title = ?, source = ?, summary = ?, updated_at = ? WHERE id = ?`).run(payload.title, payload.source, payload.summary, now, payload.id);
    database.prepare(`INSERT INTO skill_versions (id, skill_id, major, minor, is_release, files_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(versionId, payload.id, nextMajor, nextMinor, payload.publish ? 1 : 0, payload.filesJson, now);
    return {
      skill: database.prepare(`SELECT id, title, source, summary, updated_at as updatedAt FROM skills WHERE id = ?`).get(payload.id),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, files_json as filesJson FROM skill_versions WHERE skill_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(payload.id)
    };
  });
  ipcMain.handle("skills:delete", async (_event, skillId) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    database.prepare(`DELETE FROM skill_versions WHERE skill_id = ?`).run(skillId);
    database.prepare(`DELETE FROM skills WHERE id = ?`).run(skillId);
    return { success: true };
  });
  ipcMain.handle("agents:list", async () => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    return database.prepare(`SELECT id, title, kind, summary, updated_at as updatedAt FROM agents ORDER BY updated_at DESC`).all();
  });
  ipcMain.handle("agents:get", async (_event, agentId) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    return {
      agent: database.prepare(`SELECT id, title, kind, summary, updated_at as updatedAt FROM agents WHERE id = ?`).get(agentId) ?? null,
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, config_json as configJson FROM agent_versions WHERE agent_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(agentId)
    };
  });
  ipcMain.handle("agents:create", async () => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    const now = Date.now();
    const agentId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const config = JSON.stringify({ instructions: "You are a helpful agent.", providerId: "provider-openai", modelId: "gpt-4.1-mini", skillIds: ["skill-plan"], toolsetIds: ["integration-webhook"] });
    database.prepare(`INSERT INTO agents (id, title, kind, summary, updated_at) VALUES (?, ?, ?, ?, ?)`).run(agentId, "New agent", "custom", "", now);
    database.prepare(`INSERT INTO agent_versions (id, agent_id, major, minor, is_release, config_json, created_at) VALUES (?, ?, 1, 0, 0, ?, ?)`).run(versionId, agentId, config, now);
    return {
      agent: database.prepare(`SELECT id, title, kind, summary, updated_at as updatedAt FROM agents WHERE id = ?`).get(agentId),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, config_json as configJson FROM agent_versions WHERE agent_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(agentId)
    };
  });
  ipcMain.handle("agents:save", async (_event, payload) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    const latest = database.prepare(`SELECT major, minor, is_release as isRelease FROM agent_versions WHERE agent_id = ? ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id);
    const nextMajor = !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major;
    const nextMinor = !latest ? 0 : latest.isRelease ? 0 : latest.minor + 1;
    const versionId = crypto.randomUUID();
    const now = Date.now();
    database.prepare(`UPDATE agents SET title = ?, kind = ?, summary = ?, updated_at = ? WHERE id = ?`).run(payload.title, payload.kind, payload.summary, now, payload.id);
    database.prepare(`INSERT INTO agent_versions (id, agent_id, major, minor, is_release, config_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(versionId, payload.id, nextMajor, nextMinor, payload.publish ? 1 : 0, payload.configJson, now);
    return {
      agent: database.prepare(`SELECT id, title, kind, summary, updated_at as updatedAt FROM agents WHERE id = ?`).get(payload.id),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, config_json as configJson FROM agent_versions WHERE agent_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(payload.id)
    };
  });
  ipcMain.handle("agents:delete", async (_event, agentId) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    database.prepare(`DELETE FROM agent_versions WHERE agent_id = ?`).run(agentId);
    database.prepare(`DELETE FROM agents WHERE id = ?`).run(agentId);
    return { success: true };
  });
}
function getProxySettings() {
  return appState.currentProxySettings;
}
function setProxySettings(settings) {
  appState.currentProxySettings = settings;
}
function getProxyUrl(settings) {
  const auth = settings.username ? `${encodeURIComponent(settings.username)}:${encodeURIComponent(settings.password ?? "")}@` : "";
  return `${settings.type}://${auth}${settings.host}:${settings.port}`;
}
function getProxyAgent(targetUrl) {
  const settings = appState.currentProxySettings;
  if (!settings.enabled || !settings.host || !settings.port) {
    return void 0;
  }
  if (settings.type === "socks5") {
    throw new Error("SOCKS5 proxy is not wired yet in this desktop shell.");
  }
  const proxyUrl = getProxyUrl(settings);
  return targetUrl.protocol === "https:" ? new HttpsProxyAgent(proxyUrl) : new HttpProxyAgent(proxyUrl);
}
function registerContentIpc() {
  ipcMain.handle("chats:list", async () => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    return database.prepare(`SELECT id, title, chatbot_id as chatbotId, summary, updated_at as updatedAt FROM chats ORDER BY updated_at DESC`).all();
  });
  ipcMain.handle("chats:get", async (_event, chatId) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    return {
      chat: database.prepare(`SELECT id, title, chatbot_id as chatbotId, summary, updated_at as updatedAt FROM chats WHERE id = ?`).get(chatId) ?? null,
      messages: database.prepare(`SELECT id, role, content, created_at as createdAt FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC`).all(chatId)
    };
  });
  ipcMain.handle("chats:create", async () => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    const chatId = crypto.randomUUID();
    const now = Date.now();
    database.prepare(`INSERT INTO chats (id, title, chatbot_id, summary, updated_at) VALUES (?, ?, ?, ?, ?)`).run(chatId, "New chat", "assistant-main", "", now);
    return {
      chat: database.prepare(`SELECT id, title, chatbot_id as chatbotId, summary, updated_at as updatedAt FROM chats WHERE id = ?`).get(chatId),
      messages: []
    };
  });
  ipcMain.handle("chats:appendUser", async (_event, payload) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    const now = Date.now();
    const chat = database.prepare(`SELECT id, title FROM chats WHERE id = ?`).get(payload.chatId);
    if (!chat) {
      return null;
    }
    const trimmed = payload.content.trim();
    database.prepare(`INSERT INTO chat_messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`).run(crypto.randomUUID(), payload.chatId, "user", trimmed, now);
    const nextTitle = chat.title === "New chat" ? trimmed.slice(0, 18) || "Untitled chat" : chat.title;
    database.prepare(`UPDATE chats SET title = ?, summary = ?, updated_at = ? WHERE id = ?`).run(nextTitle, trimmed, now, payload.chatId);
    return {
      chat: database.prepare(`SELECT id, title, chatbot_id as chatbotId, summary, updated_at as updatedAt FROM chats WHERE id = ?`).get(payload.chatId),
      messages: database.prepare(`SELECT id, role, content, created_at as createdAt FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC`).all(payload.chatId)
    };
  });
  ipcMain.handle("chats:appendAssistant", async (_event, payload) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    const now = Date.now();
    const chat = database.prepare(`SELECT id FROM chats WHERE id = ?`).get(payload.chatId);
    if (!chat) {
      return null;
    }
    database.prepare(`INSERT INTO chat_messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`).run(crypto.randomUUID(), payload.chatId, "assistant", payload.content, now);
    database.prepare(`UPDATE chats SET updated_at = ? WHERE id = ?`).run(now, payload.chatId);
    return {
      chat: database.prepare(`SELECT id, title, chatbot_id as chatbotId, summary, updated_at as updatedAt FROM chats WHERE id = ?`).get(payload.chatId),
      messages: database.prepare(`SELECT id, role, content, created_at as createdAt FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC`).all(payload.chatId)
    };
  });
  ipcMain.handle("chats:getSettings", async () => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    const row = database.prepare(`SELECT value FROM app_meta WHERE key = 'chat_runtime_settings'`).get();
    return row?.value ?? null;
  });
  ipcMain.handle("chats:saveSettings", async (_event, payload) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    database.prepare(`INSERT INTO app_meta (key, value) VALUES ('chat_runtime_settings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(JSON.stringify(payload));
    setProxySettings(payload.proxy);
    return payload;
  });
  ipcMain.handle("documents:list", async () => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    return database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM documents ORDER BY updated_at DESC`).all();
  });
  ipcMain.handle("documents:get", async (_event, documentId, versionId) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    const versions = database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, structure_json as structureJson, graph_json as graphJson, settings_json as settingsJson FROM document_versions WHERE document_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(documentId);
    const selected = versions.find((item) => item.id === versionId) ?? versions[0] ?? null;
    return {
      document: database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM documents WHERE id = ?`).get(documentId) ?? null,
      versions,
      selectedVersionId: selected?.id ?? null
    };
  });
  ipcMain.handle("documents:create", async () => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    const documentId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const now = Date.now();
    const folderId = crypto.randomUUID();
    const pages = [
      { id: folderId, title: "guides", content: "", type: "folder", parentId: null },
      { id: crypto.randomUUID(), title: "overview.md", content: "# New document\n\n## Overview\n\nStart writing here.\n", type: "document", parentId: folderId }
    ];
    database.prepare(`INSERT INTO documents (id, title, summary, updated_at) VALUES (?, ?, ?, ?)`).run(documentId, "New document", "", now);
    database.prepare(`INSERT INTO document_versions (id, document_id, major, minor, is_release, structure_json, graph_json, settings_json, created_at) VALUES (?, ?, 1, 0, 0, ?, ?, ?, ?)`).run(versionId, documentId, JSON.stringify({ pages }), JSON.stringify({ edges: [] }), JSON.stringify({ isPublic: false, includeInLlmsTxt: true }), now);
    return {
      document: database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM documents WHERE id = ?`).get(documentId),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, structure_json as structureJson, graph_json as graphJson, settings_json as settingsJson FROM document_versions WHERE document_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(documentId),
      selectedVersionId: versionId
    };
  });
  ipcMain.handle("documents:save", async (_event, payload) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    const latest = database.prepare(`SELECT major, minor, is_release as isRelease FROM document_versions WHERE document_id = ? ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id);
    const nextMajor = !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major;
    const nextMinor = !latest ? 0 : latest.isRelease ? 0 : latest.minor + 1;
    const versionId = crypto.randomUUID();
    const now = Date.now();
    database.prepare(`UPDATE documents SET title = ?, summary = ?, updated_at = ? WHERE id = ?`).run(payload.title, payload.summary, now, payload.id);
    database.prepare(`INSERT INTO document_versions (id, document_id, major, minor, is_release, structure_json, graph_json, settings_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(versionId, payload.id, nextMajor, nextMinor, payload.publish ? 1 : 0, payload.structureJson, payload.graphJson, payload.settingsJson, now);
    return {
      document: database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM documents WHERE id = ?`).get(payload.id),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, structure_json as structureJson, graph_json as graphJson, settings_json as settingsJson FROM document_versions WHERE document_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(payload.id),
      selectedVersionId: versionId
    };
  });
  ipcMain.handle("documents:delete", async (_event, documentId) => {
    await ensureWorkspace();
    const database = openDatabase();
    applyMigrations(database);
    database.prepare(`DELETE FROM document_versions WHERE document_id = ?`).run(documentId);
    database.prepare(`DELETE FROM documents WHERE id = ?`).run(documentId);
    return { success: true };
  });
}
function sendAiEvent(payload) {
  appState.mainWindow?.webContents.send("ai:fetch:event", payload);
}
function startAiFetch(payload) {
  const requestId = crypto.randomUUID();
  const url = new URL(payload.url);
  const transport = url.protocol === "https:" ? https : http;
  const body = payload.bodyBase64 ? Buffer$1.from(payload.bodyBase64, "base64") : payload.bodyText ? Buffer$1.from(payload.bodyText) : void 0;
  const request = transport.request(url, {
    method: payload.method ?? "GET",
    headers: payload.headers,
    agent: getProxyAgent(url),
    rejectUnauthorized: appState.currentProxySettings.ignoreSslErrors ? false : appState.currentProxySettings.rejectUnauthorized
  }, (response) => {
    sendAiEvent({
      requestId,
      type: "response",
      status: response.statusCode ?? 500,
      statusText: response.statusMessage ?? "",
      headers: Object.fromEntries(
        Object.entries(response.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : String(value ?? "")])
      )
    });
    response.on("data", (chunk) => {
      sendAiEvent({
        requestId,
        type: "data",
        chunkBase64: chunk.toString("base64")
      });
    });
    response.on("end", () => {
      appState.activeAiRequests.delete(requestId);
      sendAiEvent({ requestId, type: "end" });
    });
  });
  appState.activeAiRequests.set(requestId, request);
  request.on("error", (error) => {
    appState.activeAiRequests.delete(requestId);
    sendAiEvent({ requestId, type: "error", error: error instanceof Error ? error.message : String(error) });
  });
  request.setTimeout(payload.timeoutMs ?? 12e4, () => {
    request.destroy(new Error("AI request timed out"));
  });
  if (body) {
    request.write(body);
  }
  request.end();
  return { requestId };
}
function abortAiFetch(requestId) {
  const request = appState.activeAiRequests.get(requestId);
  if (request) {
    request.destroy(new Error("AI request aborted"));
    appState.activeAiRequests.delete(requestId);
  }
  return { ok: true };
}
async function executeHttpIntegration(payload) {
  const config = payload.config;
  const baseUrl = new URL(config.url || "");
  const query = config.queryJson ? JSON.parse(config.queryJson) : {};
  for (const [key, value] of Object.entries(query)) {
    baseUrl.searchParams.set(key, String(value));
  }
  const body = config.bodyJson ? JSON.parse(config.bodyJson) : void 0;
  const headers = config.headersJson ? JSON.parse(config.headersJson) : {};
  const transport = baseUrl.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.request(baseUrl, {
      method: config.method || "GET",
      headers: {
        "content-type": "application/json",
        ...headers
      },
      agent: getProxyAgent(baseUrl)
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        resolve({
          ok: (response.statusCode ?? 500) < 400,
          status: response.statusCode ?? 500,
          body: Buffer.concat(chunks).toString("utf8")
        });
      });
    });
    request.on("error", reject);
    request.setTimeout(6e4, () => request.destroy(new Error("HTTP integration timed out")));
    if (body && config.method && config.method !== "GET") {
      request.write(JSON.stringify(body));
    }
    request.end();
  });
}
async function executeScriptIntegration(payload) {
  const config = payload.config;
  const selectedScript = config.scripts?.find((item) => item.id === config.selectedScriptId) ?? config.scripts?.[0];
  if (!selectedScript) {
    return {
      ok: false,
      status: 400,
      body: "No script entry is configured."
    };
  }
  const AsyncFunction = Object.getPrototypeOf(async function() {
  }).constructor;
  const compiled = new AsyncFunction(`${selectedScript.code || ""}; return typeof ${selectedScript.handler || "main"} === 'function' ? ${selectedScript.handler || "main"}(input) : { ok: false, error: 'Handler not found' };`);
  const parsedInput = payload.inputJson ? JSON.parse(payload.inputJson) : {};
  const output = await compiled(parsedInput);
  return {
    ok: true,
    status: 200,
    body: JSON.stringify(output, null, 2)
  };
}
async function executeMcpIntegration(payload) {
  const config = payload.config;
  if (config.endpoint) {
    const probe = await executeHttpIntegration({
      config: {
        method: "GET",
        url: config.endpoint,
        headersJson: "{}",
        queryJson: "{}",
        bodyJson: "{}"
      }
    });
    return {
      ...probe,
      body: `MCP endpoint responded with status ${probe.status}

${probe.body}`
    };
  }
  if (config.launchCommand) {
    return new Promise((resolve) => {
      const child = spawn(config.launchCommand || "", { shell: true });
      const chunks = [];
      const errors = [];
      const timer = setTimeout(() => {
        child.kill();
        resolve({ ok: true, status: 200, body: `Spawned command: ${config.launchCommand}
${Buffer.concat(chunks).toString("utf8")}
${Buffer.concat(errors).toString("utf8")}` });
      }, 2e3);
      child.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      child.stderr.on("data", (chunk) => errors.push(Buffer.from(chunk)));
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ ok: code === 0, status: code ?? 0, body: Buffer.concat(chunks).toString("utf8") || Buffer.concat(errors).toString("utf8") || `Process exited with code ${code}` });
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        resolve({ ok: false, status: 500, body: error.message });
      });
    });
  }
  return { ok: false, status: 400, body: "MCP integration requires endpoint or launch command." };
}
function executeIntegration(payload) {
  if (payload.kind === "http") {
    return executeHttpIntegration(payload);
  }
  if (payload.kind === "scripts") {
    return executeScriptIntegration(payload);
  }
  return executeMcpIntegration(payload);
}
const { autoUpdater } = electronUpdater;
function configureAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
}
function getUpdaterState() {
  return {
    enabled: app.isPackaged,
    channel: "latest"
  };
}
function checkForUpdates() {
  if (!app.isPackaged) {
    return { skipped: true, reason: "not-packaged" };
  }
  return autoUpdater.checkForUpdates();
}
function registerCoreIpc() {
  ipcMain.handle("system:info", () => ({
    isDev: !app.isPackaged,
    platform: process.platform,
    version: app.getVersion()
  }));
  ipcMain.handle("workspace:getPaths", async () => {
    await ensureWorkspace();
    return {
      workspacePath: getWorkspacePath(),
      databasePath: getDatabasePath()
    };
  });
  ipcMain.handle("db:execute", async (_event, payload) => {
    await ensureWorkspace();
    return executeQuery(payload);
  });
  ipcMain.handle("workspace:setProxySettings", (_event, settings) => {
    setProxySettings(settings);
    return { ok: true };
  });
  ipcMain.handle("workspace:getProxySettings", () => getProxySettings());
  ipcMain.handle("ai:fetch:start", async (_event, payload) => startAiFetch(payload));
  ipcMain.handle("ai:fetch:abort", (_event, requestId) => abortAiFetch(requestId));
  ipcMain.handle("integration:execute", async (_event, payload) => executeIntegration(payload));
  ipcMain.handle("updater:getState", () => getUpdaterState());
  ipcMain.handle("updater:check", async () => checkForUpdates());
}
function setupIpc() {
  registerCoreIpc();
  registerContentIpc();
  registerCatalogIpc();
  registerAutomationIpc();
}
async function createWindow() {
  const icon = nativeImage.createFromPath(path.join(process.cwd(), "resources", "icons", "icon-256x256.png"));
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    title: "SUORA",
    icon,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  setMainWindow(mainWindow);
  if (appState.isDev) {
    const rendererUrl = process.env.ELECTRON_RENDERER_URL;
    if (!rendererUrl) {
      throw new Error("ELECTRON_RENDERER_URL is not available in development mode.");
    }
    await mainWindow.loadURL(rendererUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  return mainWindow;
}
configureAppStoragePaths();
app.whenReady().then(async () => {
  await ensureWorkspace();
  applyMigrations(openDatabase());
  setupIpc();
  configureAutoUpdater();
  await createWindow();
  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("before-quit", () => {
  closeDatabase();
});
