# UI Simplification and SQLite Storage Plan

## Goal

Make all major Suora workspaces quieter and easier to scan, especially Chat, Models, Channels, Skills, Agents, Settings, MCP, Timer, and Pipeline. Replace most app-owned JSON/file persistence with a local SQLite database managed by the Electron main process, while keeping explicit user file operations and imported/exported assets available.

## Current State

- UI routing is centralized in `src/App.tsx`; feature screens are lazy-loaded as independent layouts.
- Most feature screens use `SidePanel` plus a detail area, but each screen defines its own cards, hero panels, stat blocks, buttons, tabs, and empty states.
- The visual language currently leans decorative: large rounded corners, gradients, layered shadows, pill badges, icon-heavy headers, and explanatory hero panels.
- Zustand persists shared app state through `fileStateStorage`, which splits data into `models.json`, `settings.json`, and `channels/config.json`.
- Sessions, agents, pipelines, and skills still use dedicated file services and write many JSON or Markdown files under the workspace.
- Electron already exposes a constrained IPC bridge in `electron/preload.ts`; storage changes should follow that pattern and keep renderer code sandboxed.

## Non-Goals

- Do not remove user-facing import/export workflows.
- Do not remove file-system tools used by agents for explicit file operations.
- Do not store large binary attachments directly in SQLite in the first pass; keep an attachment table with metadata and only move blobs after measuring size/performance.
- Do not rewrite all feature logic at once. Keep behavior stable and migrate storage behind service APIs.

## UI Design Direction

Adopt a utilitarian desktop-workbench style:

- Flat surfaces, 1px borders, small radius (`rounded-md` or `rounded-lg`), no decorative gradients.
- Fewer shadows; reserve elevation for menus, dialogs, and popovers.
- One compact toolbar/header per screen, one list/sidebar, one detail/editor area.
- Prefer tables, dense lists, and simple rows over hero cards and marketing-style summaries.
- Use icons only for recognizable actions; remove ornamental icons and oversized empty-state illustrations.
- Keep copy short. Avoid large explanatory paragraphs inside normal work screens.
- Standardize buttons, inputs, tabs, badges, and section panels through shared components.

## UI Implementation Plan

### Phase 1: Shared Minimal UI Primitives

1. Create or refactor shared primitives in `src/components/ui/`:
   - `Button`
   - `Input`
   - `Select`
   - `Textarea`
   - `Switch`
   - `Tabs`
   - `Badge`
   - `Panel`
   - `Toolbar`
   - `EntityListItem`
   - `EmptyState`
2. Update `src/components/layout/SidePanel.tsx` to remove blur, heavy transparency, uppercase-only styling, and oversized spacing.
3. Update `src/index.css` to quiet global animation/elevation helpers and remove decorative gradient/glow utility hooks where possible.
4. Add a short local style rule: cards use max `rounded-lg`; page sections are flat panels, not floating cards.

### Phase 2: Navigation and Shell

1. Simplify `src/components/layout/NavBar.tsx`:
   - Keep the left rail.
   - Remove animated tooltip panels and heavy active effects.
   - Use one icon style and one active indicator.
   - Keep command palette and notification access, but simplify panels.
2. Keep `src/components/layout/AppShell.tsx` structure unchanged except for shell classes.

### Phase 3: Feature Screen Simplification

Apply the same pattern to every feature area:

1. Chat
   - Keep session list + chat main.
   - Simplify message bubbles, session cards, tabs, and input controls.
   - Reduce gradients, decorative avatars, and large status visuals.
2. Models
   - Replace hero/stat blocks with a compact provider/model toolbar.
   - Use simple rows for providers and models.
   - Move comparison view into a plain table-style layout.
3. Channels
   - Remove channel hero panels.
   - Use tabs with flat section panels: Config, Messages, Users, Health, Debug.
   - Keep status badges but reduce color intensity.
4. Skills
   - Keep Installed/Browse/Sources tabs.
   - Use list rows and a flat editor panel.
   - Preserve SKILL.md import/export and marketplace browsing.
5. Agents
   - Replace marketplace/template presentation with compact template rows.
   - Keep editor/test chat/orchestration, but simplify nested cards and badges.
6. Settings
   - Replace `SettingsSection` and `SettingsStat` decorative styles with flat sections.
   - Group dense settings with clear labels and minimal helper copy.
7. MCP
   - Convert server overview into a plain detail form/table.
   - Keep connection testing and tool discovery, but simplify runtime status display.
8. Timer
   - Replace scheduler hero and large summary cards with a compact list + detail/editor.
   - Keep search, enable/disable, edit, delete, and execution history.
9. Pipeline
   - Align pipeline list, editor, and execution history with the same flat panel system.

### Phase 4: Visual QA

1. Run `npm run type-check`.
2. Run focused component tests for modified areas.
3. Run Electron UI smoke checks rather than relying only on browser screenshots, because browser-only rendering can produce a blank shell for this app.
4. Validate at minimum: 1200x700, 1440x900, and one narrow-width layout if supported.

## SQLite Storage Direction

Use SQLite in the Electron main process and expose narrow IPC methods to the renderer. Zustand remains the in-memory UI state layer. Renderer services call storage APIs; they do not open database files directly.

Initial dependency choice: `better-sqlite3` in the main process for simple transactions and predictable local desktop performance. In this Windows environment, native installation failed because `node-gyp` could not find the Visual Studio C++ desktop workload, so the current implementation uses `sql.js` plus a persisted `suora.db` file. This keeps the database local and avoids native rebuild friction while leaving room to revisit `better-sqlite3` later if packaging is configured.

Database location:

```text
{workspacePath}/suora.db
```

The default workspace is still `~/.suora`, so a first-run install uses `~/.suora/suora.db`. When the user changes workspace, the app opens that workspace's database instead of mixing data across workspaces.

Keep only these as files:

- `boot-config.json` initially, or move it later after DB bootstrapping is stable.
- Logs and crash reports, unless a later phase moves runtime logs into SQLite.
- User exports/imports.
- Explicit project/user skill folders that need compatibility with external skill ecosystems.
- Agent file-operation outputs requested by users.

## Proposed Schema

```sql
CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE provider_configs (
  id TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE models (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  value_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  agent_id TEXT,
  model_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  value_json TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_session_timestamp ON messages(session_id, timestamp);

CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  value_json TEXT NOT NULL,
  content TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  value_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE channel_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  value_json TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE TABLE mcp_servers (
  id TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE timers (
  id TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  next_run INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE pipelines (
  id TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE pipeline_executions (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  value_json TEXT NOT NULL,
  started_at INTEGER NOT NULL
);

CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL,
  owner_id TEXT,
  scope TEXT NOT NULL,
  value_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

Note: store full JSON initially for migration speed and backward compatibility, while indexing important fields separately for common queries. The first migration keeps some secondary fields nullable so a narrow generic JSON entity bridge can land before each feature receives a dedicated repository.

## SQLite Implementation Plan

### Phase 1: Main-Process Database Layer

1. Add SQLite support in the main process. Current implementation uses `sql.js` because `better-sqlite3` failed to install on this Windows machine without Visual Studio C++ build tools.
2. Create `electron/database.ts`:
   - open database at `{workspacePath}/suora.db`
   - load and persist the database file atomically
   - run migrations inside transactions
   - expose narrow settings/entity persistence helpers
3. Add `electron/dbMigrations.ts` with numbered migrations.
4. Add `db:*` IPC channels to `electron/preload.ts` allowlist only after main handlers exist.
5. Add IPC handlers in `electron/main.ts`:
   - `db:getSnapshot`
   - `db:saveStateSlice`
   - `db:listEntities`
   - `db:saveEntity`
   - `db:deleteEntity`
6. Later repository-specific handlers can replace the generic entity bridge when sessions, skills, timers, and pipeline execution history need richer queries.

### Phase 2: Renderer Storage Adapter

1. Add `src/services/sqliteStorage.ts` as the renderer-facing bridge.
2. Replace `fileStateStorage` with a DB-backed storage adapter while keeping the same Zustand persist contract.
3. Keep an in-memory cache for synchronous reads used by tools and runtime services.
4. Save sensitive values through existing `safeStorage` helpers before writing them to SQLite.

### Phase 3: Entity Service Migration

1. Replace `sessionFiles.ts` internals with SQLite calls while preserving exported function names for low-risk adoption.
2. Replace `agentFiles.ts` internals with SQLite calls.
3. Replace `pipelineFiles.ts` internals with SQLite calls.
4. For `skillRegistry.ts`, store installed/local skill metadata and content in SQLite, but keep compatibility imports from `SKILL.md` and optional export back to Markdown.
5. Move MCP, channel, model, settings, memory, performance, and notification state into DB-backed Zustand persistence.
6. Migrate timers carefully because current timer CRUD lives in Electron IPC. Prefer moving timer storage into the same database layer inside main process first.

### Phase 4: Migration from Existing Files

1. On first DB open, check `app_meta` for `file_migration_completed`.
2. Import existing files in this order:
   - `models.json`
   - `settings.json`
   - `channels/config.json`
   - `sessions/*/conversation.json`
   - `sessions/*/memories.json`
   - `agents/*.json`
   - `pipelines/*.json`
   - `pipelines/history.json`
   - local/workspace skills where safe
3. Do not delete old files automatically. Rename or mark them as migrated only after successful import and user-visible backup confirmation.
4. Add a Settings/Data action: "Migrate files to SQLite" and "Export SQLite backup".
5. Add a fallback path to read old files if DB migration fails.

### Phase 5: Tests and Verification

1. Unit test migrations with temporary databases.
2. Unit test repositories for CRUD and cascade deletes.
3. Update existing tests that mock `fs:*` storage to mock `db:*` storage.
4. Run:
   - `npm run type-check`
   - `npm run test:run`
   - focused Electron smoke checks
5. Manual verification:
   - create/edit/delete sessions, agents, skills, providers, channels, MCP servers, timers, and pipelines
   - restart app and confirm data survives
   - migrate an existing workspace with populated JSON files
   - verify API keys/secrets remain encrypted or unavailable rather than saved in plaintext

## Suggested Work Order

1. Land shared minimal UI primitives and simplify Settings first. This gives a style target for the rest of the app.
2. Simplify Models, MCP, Timer, and Channels next because they share the list/detail pattern.
3. Simplify Agents and Skills after that because their editors and marketplace features are denser.
4. Simplify Chat last to avoid disrupting active conversation behavior while storage migration is still moving.
5. Build SQLite main-process foundation.
6. Migrate Zustand shared state.
7. Migrate sessions, agents, pipelines, skills, and timers one service at a time.
8. Add migration UI and backup/export controls.
9. Remove obsolete file-storage paths only after at least one full release cycle or explicit confirmation.

## Risks

- Native SQLite dependency packaging can fail without Electron rebuild configuration.
- Moving all state at once can break startup order; use compatibility wrappers and preserve function names during migration.
- Skills have external ecosystem compatibility with `SKILL.md`; do not make SQLite the only interchange format.
- Secrets must still use OS safe storage. SQLite should store encrypted payloads only.
- Browser-mode tests may not fully represent Electron runtime behavior.

## Acceptance Criteria

- All major screens use the same flat layout primitives and no longer contain decorative hero panels, heavy gradients, or large shadowed cards.
- App-owned persistent state is stored in `{workspacePath}/suora.db`, defaulting to `~/.suora/suora.db` on first run.
- Existing JSON workspace data migrates automatically or through a clear Data Settings action.
- Existing import/export flows still work.
- Restart persistence works for chat sessions, providers, channels, agents, skills, MCP servers, timers, pipelines, settings, and memory.
- Type check and test suite pass, with focused migration tests added.