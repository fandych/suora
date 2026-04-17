# Suora �?Technical Documentation

> An intelligent Electron-based desktop application with multi-model support, smart agents, skill system, memory management, and plugin architecture.

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [Technology Stack](#3-technology-stack)
4. [Build System](#4-build-system)
5. [State Management](#5-state-management)
6. [AI Service Layer](#6-ai-service-layer)
7. [Skill / Tool System](#7-skill--tool-system)
8. [Internationalization System](#8-internationalization-system)
9. [Memory System](#9-memory-system)
10. [IPC Communication](#10-ipc-communication)
11. [Security Architecture](#11-security-architecture)
12. [Plugin System](#12-plugin-system)
13. [Channel Integration](#13-channel-integration)
14. [Testing](#14-testing)
15. [CI/CD & Release](#15-cicd--release)
16. [Development Guide](#16-development-guide)
17. [API Reference](#17-api-reference)

---

## 1. Architecture Overview

```
┌───────────────────────────────────────────────────────�?
�?                  Electron Shell                      �?
�?                                                      �?
�? ┌─────────────�? IPC (68 channels)  ┌────────────�? �?
�? │Main Process │◄───────────────────►│  Renderer   �? �?
�? �?(Node.js)   �? preload bridge     �?(React 19)  �? �?
�? �?            �?                     �?            �? �?
�? │�?IPC handlers�?                    │�?Zustand 5  �? �?
�? │�?File I/O   �?                     │�?AI SDK 6   �? �?
�? │�?Shell exec �?                     │�?Tools      �? �?
�? │�?SMTP email �?                     │�?Router     �? �?
�? │�?Logger     �?                     │�?Tailwind 4 �? �?
�? └─────────────�?                     └────────────�? �?
�?       �? contextIsolation: true            �?        �?
�?       └──────── Preload (preload.ts) ──────�?        �?
�?             window.electron.invoke/on/send            �?
└───────────────────────────────────────────────────────�?
```

- **Main Process** (`electron/main.ts`) �?owns the `BrowserWindow`; handles all OS-level operations (filesystem, shell, clipboard, SMTP, timers, browser automation) via IPC handlers.
- **Preload Script** (`electron/preload.ts`) �?isolated context that exposes a whitelist of 68 IPC channels through `contextBridge.exposeInMainWorld('electron', ...)`.
- **Renderer** (`src/`) �?single-page React 19 application bundled by Vite 6, state via Zustand 5, AI via Vercel AI SDK 6, and OS access through the preload bridge.

---

## 2. Project Structure

```
src/
├── App.tsx                  # React Router (8 routes)
├── index.css                # Tailwind @theme tokens (dark/light)
├── store/appStore.ts        # Zustand global state (version 12)
├── services/
�?  ├── aiService.ts         # Multi-provider AI integration
�?  ├── tools.ts             # 18 skill categories, 42+ tools
�?  ├── i18n.ts              # 10-language translation (~910 keys)
�?  ├── fileStorage.ts       # IPC-backed JSON persistence + cache
�?  ├── voiceInteraction.ts  # Web Speech API (STT/TTS)
�?  └── logger.ts            # Renderer �?main log forwarding
├── hooks/
�?  ├── useI18n.ts           # Translation hook
�?  └── useTheme.ts          # Theme/accent/font hook
├── components/              # Feature-organized React components
├── types/index.ts           # Shared TypeScript interfaces
└── test/setup.ts            # Vitest setup

electron/
├── main.ts                  # Main process, IPC handlers, SMTP, updater
├── preload.ts               # Context-isolated bridge (68 channels)
└── logger.ts                # RotatingLogger (~/.suora/logs)
```

**Build outputs:** `out/main/` (ESM) · `out/preload/` (CJS) · `out/renderer/` (SPA) · `dist/` (installers)

---

## 3. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop | Electron | 41.x |
| Frontend | React | 19.2 |
| Bundler | Vite + electron-vite | 6.0 + 5.0 |
| Styling | Tailwind CSS | 4.2 |
| State | Zustand | 5.0 |
| AI SDK | Vercel AI SDK (`ai`) | 6.0 |
| Language | TypeScript | 5.8+ |
| Router | React Router | 7.x |
| Validation | Zod | 4.x |
| Email | nodemailer | 8.x |
| HTTP/WS | Express 5 + ws 8 | �?|
| Packaging | electron-builder | 26.x |
| Testing | Vitest 4.x + Playwright 1.58 | �?|

**AI provider packages:** `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google-vertex`, `@ai-sdk/openai-compatible` (for Ollama, DeepSeek, Groq, Together, Fireworks, Perplexity, Cohere, Zhipu, MiniMax, and custom endpoints).

---

## 4. Build System

Three build targets defined in `electron.vite.config.ts`:

| Target | Entry | Output | Format |
|--------|-------|--------|--------|
| Main | `electron/main.ts` | `out/main/` | ESM |
| Preload | `electron/preload.ts` | `out/preload/` | CJS |
| Renderer | `index.html` | `out/renderer/` | SPA |

The renderer uses `@vitejs/plugin-react` + `@tailwindcss/vite`, with the path alias `@` �?`./src`, and the dev server on `127.0.0.1:5173` (strict port).

| Command | Description |
|---------|-------------|
| `npm run dev` | Electron + Vite dev server with Hot Module Replacement (HMR) |
| `npm run build` | Production build (all three targets) |
| `npm run package` | Build + electron-builder (NSIS/DMG/AppImage) |

**electron-builder targets:** Windows (NSIS + portable), macOS (DMG + ZIP), Linux (AppImage + DEB + RPM).

---

## 5. State Management

A single Zustand store with a `persist` middleware backed by IPC file storage.

**Store name:** `suora-store` · **Version:** 12 · **Backend:** `~/.suora/data/`

### Key State Slices

| Slice | Key Fields |
|-------|-----------|
| Sessions | `sessions`, `activeSessionId`, `openSessionTabs` |
| Agents | `agents`, `selectedAgent`, `agentPerformance`, `agentVersions` |
| Models | `providerConfigs`, `globalModels`, `modelUsageStats` |
| Skills | `skills`, `pluginTools`, `skillVersions` |
| Memory | `globalMemories` |
| Security | `toolSecurity` (allowed directories, blocked commands, confirmation) |
| Appearance | `theme`, `fontSize`, `codeFont`, `accentColor`, `bubbleStyle`, `locale` |
| Channels | `channelConfigs`, `channelMessages`, `channelTokens`, `channelHealth` |
| Plugins | `installedPlugins` |
| Email | `emailConfig` (SMTP) |

### Persistence Flow

```
Zustand �?fileStateStorage adapter �?IPC (store:load/save/remove) �?~/.suora/data/*.json
```

An in-memory `Map` cache enables synchronous reads via `readCached()`/`writeCached()`. On first load, the adapter checks file storage, falls back to `localStorage` (migration), then caches.

### Migrations (Version 1 �?12)

v2: agent memory, skill tools · v3: `toolSecurity` defaults · v5: `workspacePath` · v7: migrate `providerConfigs` from Record to Array · v8: disable confirmation by default · v9: `globalMemories`, backfill memory scope · v10: channels, plugins, locale, agent, onboarding · v11: `pluginTools`, `skillVersions` · v12: `emailConfig`

---

## 6. AI Service Layer

Provider instances are cached by key `${providerId}:${apiKey}:${baseUrl}`.

### Supported Providers (13+)

Anthropic and OpenAI use their native SDK packages. All other providers use `@ai-sdk/openai-compatible` with preconfigured base URLs (Google �?`generativelanguage.googleapis.com`, Ollama �?`localhost:11434/v1`, DeepSeek, Groq, Together, Fireworks, Perplexity, Cohere, Zhipu, MiniMax, or custom).

### Key Functions

```ts
validateModelConfig(model): { valid: boolean; error?: string }
initializeProvider(providerType, apiKey, baseUrl?, providerId?): void
testConnection(providerType, apiKey, baseUrl, modelId): Promise<{ success; error?; latency? }>
generateResponse(modelId, messages, systemPrompt?): Promise<string>
streamResponseWithTools(model, messages, tools, systemPrompt?, maxSteps?): AsyncGenerator<AppStreamEvent[]>
```

### Streaming Events

`text-delta` · `tool-call` · `tool-result` · `tool-error` · `finish-step` · `usage` · `error`

Tool calls are executed in a multi-step loop (default max 20 steps, `toolChoice: 'auto'`).

---

## 7. Skill / Tool System

### 18 Built-in Skills

| Skill ID | Tools (examples) |
|----------|-----------------|
| `builtin-filesystem` | `list_dir`, `read_file`, `write_file`, `search_files`, `copy_file`, `move_file`, `stat_file` |
| `builtin-shell` | `shell` (bash on Unix, PowerShell on Windows) |
| `builtin-web` | `web_search` (DuckDuckGo), `fetch_webpage` |
| `builtin-utilities` | `get_current_time`, `parse_json`, `generate_uuid` |
| `builtin-todo` | `list_todos`, `add_todo`, `update_todo`, `delete_todo` |
| `builtin-timer` | `list_timers`, `create_timer`, `update_timer`, `delete_timer` |
| `builtin-memory` | `search_memory`, `add_memory` |
| `builtin-browser` | `browser_navigate`, `browser_screenshot`, `browser_evaluate`, `browser_click`, `browser_fill_form` |
| `builtin-agent-comm` | `send_agent_message`, `broadcast_agent_message` |
| `builtin-event-automation` | `register_event_trigger`, `trigger_event` |
| `builtin-self-evolution` | `create_agent_memory`, `update_skill_description` |
| `builtin-file-attachment` | `analyze_image_attachment`, `save_attachment` |
| `builtin-git` | `git_exec` |
| `builtin-code-analysis` | `analyze_code`, `suggest_refactoring` |
| `builtin-advanced-interaction` | `send_persistent_message`, `request_user_input` |
| `builtin-channels` | `channel_send_message`, `channel_read_message` |
| `builtin-email` | `send_email` |
| `builtin-system-management` | `get_system_info`, `read_clipboard`, `write_clipboard`, `notify`, `take_screenshot` |

### Tool Registration

```ts
import { tool } from 'ai'
import { z } from 'zod'

export const builtinToolDefs: ToolSet = {
  list_dir: tool({
    description: 'List files and directories',
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => { /* IPC call */ },
  }),
}
```

Functions: `registerTools()`, `getToolsForSkills(skillIds)`, `buildToolSet()`, `getCustomToolsFromSkill()`, `getPluginTools()`.

Skills can be installed from the marketplace (official or private registry, controlled via the `marketplace` store setting).

---

## 8. Internationalization System

**10 languages:** en · zh · ja · ko · fr · de · es · pt · ru · ar (~910 keys per language)

```ts
import { useI18n } from '@/hooks/useI18n'
const { t } = useI18n()
t('chat.send')  // Locale-aware translation
```

**Key namespaces:** `nav.*`, `chat.*`, `agents.*`, `skills.*`, `models.*`, `settings.*`, `channels.*`, `common.*`, `onboarding.*`

**Fallback chain:** current locale �?English �?provided fallback �?raw key.

**Adding a language:** (1) add the code to the `AppLocale` type, (2) add the translation map in `i18n.ts`, (3) add the UI option in settings.

---

## 9. Memory System

| Level | Scope | Limit | Persistence |
|-------|-------|-------|-------------|
| Short-term | Per session | 100 items | Session lifetime only |
| Long-term | Global | Unlimited | `globalMemories` in store |
| Vector | Global | Unlimited | `search_memory`/`add_memory` tools |

```ts
interface AgentMemoryEntry {
  id: string; content: string; type: string;     // 'fact', 'preference', 'context'
  scope: 'session' | 'global'; createdAt: number; source?: string;
}
```

Agents with `autoLearn: true` automatically persist facts via the `builtin-self-evolution` skill.

---

## 10. IPC Communication

**67 invoke channels** (request-response) · **1 send channel** (`app:ready`) · **6 on channels** (events)

### Preload Bridge

```ts
window.electron.invoke(channel, ...args): Promise<unknown>  // Whitelisted; throws on unknown channels
window.electron.on(channel, listener): void                  // Whitelisted; silently ignored otherwise
window.electron.send(channel, ...args): void                 // Whitelisted; silently ignored otherwise
```

### Channel Index

| Category | Channels |
|----------|----------|
| Filesystem | `fs:listDir`, `fs:readFile`, `fs:readFileRange`, `fs:writeFile`, `fs:deleteFile`, `fs:editFile`, `fs:searchFiles`, `fs:moveFile`, `fs:copyFile`, `fs:stat`, `fs:watch:start`, `fs:watch:stop` |
| Shell | `shell:exec`, `shell:openUrl` |
| Web | `web:search`, `web:fetch` |
| Browser | `browser:navigate`, `browser:screenshot`, `browser:evaluate`, `browser:extractLinks`, `browser:extractText`, `browser:fillForm`, `browser:click` |
| Clipboard | `clipboard:read`, `clipboard:write` |
| Timer | `timer:list`, `timer:create`, `timer:update`, `timer:delete`, `timer:history` |
| Store | `store:load`, `store:save`, `store:remove` |
| Safe Storage | `safe-storage:encrypt`, `safe-storage:decrypt`, `safe-storage:isAvailable` |
| System | `system:getDefaultWorkspacePath`, `system:ensureDirectory`, `system:info`, `system:notify`, `system:screenshot` |
| Channels | `channel:start/stop/status/register`, `channel:getWebhookUrl`, `channel:sendMessage`, `channel:sendMessageQueued`, `channel:getAccessToken`, `channel:healthCheck`, `channel:debugSend` |
| Email | `email:send`, `email:test` |
| Updater | `updater:check`, `updater:getVersion` |
| Logging | `log:write` |
| Other | `app:setAutoStart`, `app:getAutoStart`, `deep-link:getProtocol`, `crash:report/getLogs/clearLogs`, `perf:getMetrics` |

**On-event channels:** `timer:fired`, `channel:message`, `fs:watch:changed`, `app:update`, `updater:available`, `deep-link`

---

## 11. Security Architecture

| Measure | Details |
|---------|---------|
| `nodeIntegration` | `false` �?no Node.js in the renderer |
| `contextIsolation` | `true` �?separate JavaScript contexts |
| IPC Whitelist | 68 channels; unknown channels throw or are silently ignored |
| Path Validation | `ensureAllowedPath()` checks against `allowedDirectories` with strict prefix matching |
| Blocked Commands | `ensureCommandAllowed()` rejects `rm -rf`, `del /f /q`, `format`, `shutdown` |
| Confirmation | Optional user confirmation before tool execution |
| Safe Storage | OS keyring encryption (DPAPI / Keychain / libsecret) for API keys |
| Skill Integrity | SHA-256 checksums; version history (`skillVersions`, max 500 entries) |
| Audit Logging | `RotatingLogger` �?10 MB/file, 5 files/day, 7-day retention |

---

## 12. Plugin System

```ts
interface PluginInfo {
  id: string; name: string; version: string;
  description: string; enabled: boolean; config: Record<string, unknown>;
}
```

Plugins are stored in `appStore.installedPlugins` and can register tools via the `pluginTools` mapping (`Record<string, string[]>` �?plugin ID �?tool names). At runtime, `getPluginTools()` merges plugin tools into the available tool set.

**Extension points:** new tools (via `pluginTools`), new skills (`type: 'marketplace'`), channel connectors (`ChannelConfig`), custom AI providers (OpenAI-compatible `ProviderConfig`).

---

## 13. Channel Integration

External platforms (Slack, Discord, Telegram, custom) connect via an Express webhook server running in the main process.

```
Platform �?HTTP webhook �?Main Process (Express) �?channel:message event �?Renderer/AI �?channel:sendMessage �?Platform
```

```ts
interface ChannelConfig {
  id: string; platform: 'slack' | 'discord' | 'telegram' | 'custom';
  name: string; token?: string; webhookUrl?: string; enabled: boolean;
}
```

Health is monitored via the `channelHealth` store. Agents can interact programmatically using the `builtin-channels` skill.

---

## 14. Testing

### Unit Tests (Vitest)

Setup: `jsdom` environment, globals enabled, pattern `src/**/*.{test,spec}.{ts,tsx}`, coverage thresholds (lines 8%, functions 5%, branches 5%).

```bash
npm run test          # Watch mode
npm run test:run      # Single run
npm run test:coverage # With v8 coverage
```

### End-to-End Tests (Playwright)

Setup: Chromium only, base URL `localhost:5173`, auto-start dev server (120 s timeout), retries 0 locally / 2 in CI.

```bash
npm run test:e2e      # Run end-to-end tests
npm run test:e2e:ui   # Playwright UI
```

---

## 15. CI/CD & Release

### Test Workflow (`test.yml`) �?on push or pull request to `main`/`develop`

- **Test** job: lint �?type-check �?unit tests �?upload coverage (Codecov) �?Node 20.x & 22.x, Ubuntu
- **Build** job: build �?package �?upload artifacts (7 days) �?Ubuntu/Windows/macOS, Node 22.x

### Release Workflow (`release.yml`) �?triggered on GitHub release creation

Builds and uploads platform installers: `.AppImage`/`.deb`/`.rpm` (Linux), `.exe`/`.msi` (Windows), `.dmg`/`.zip` (macOS), plus `latest-*.yml` metadata.

**Auto-updater:** electron-builder GitHub provider; `updater:check` queries the latest release on startup.

---

## 16. Development Guide

### Setup

```bash
git clone https://github.com/fandych/suora.git && cd suora
npm install
npm run dev    # Electron + HMR
```

### Adding a Feature

1. Define types in `src/types/index.ts`
2. Add state/actions in `appStore.ts`; bump version and add migration
3. Implement logic in `src/services/`
4. Build components in `src/components/`; extract hooks to `src/hooks/`
5. Register the route in `App.tsx` if needed
6. Add i18n keys for all 10 languages

### Adding an AI Provider

Add a case in `aiService.ts �?initializeProvider()` with the SDK factory and default base URL, then add UI in the models page. Test with `testConnection()`.

### Adding a Tool

```ts
// src/services/tools.ts
my_tool: tool({
  description: 'Does something',
  inputSchema: z.object({ input: z.string() }),
  execute: async ({ input }) => {
    return JSON.stringify(await window.electron.invoke('my:channel', input))
  },
})
```

If the tool requires OS access: add an IPC handler in `electron/main.ts` and add the channel to the whitelist in `electron/preload.ts`.

### Conventions

- `@` path alias for all imports · prefer `window.electron.invoke()` over Node APIs · Zod schemas for tool inputs · Tailwind `@theme` tokens for new styles

---

## 17. API Reference

### Store Actions (key subset)

```ts
addSession(session) / updateSession(id, data) / removeSession(id)
addAgent(agent) / updateAgent(id, data) / removeAgent(id)
addSkill(skill) / removeSkill(id)
setProviderConfigs(configs: ProviderConfig[])
recordModelUsage(modelId, promptTokens, completionTokens)
recordAgentPerformance(agentId, responseTimeMs, tokens, isError?)
addChannelMessage(msg) / clearChannelMessages(channelId?)
addInstalledPlugin(plugin) / updateInstalledPlugin(id, data) / removeInstalledPlugin(id)
setTheme(mode) / setLocale(locale) / setEmailConfig(config)
```

### File Storage

```ts
fileStateStorage.getItem(name): Promise<string | null>
fileStateStorage.setItem(name, value): void
fileStateStorage.removeItem(name): void
readCached(name): string | null      // Synchronous, from in-memory cache
writeCached(name, value): void       // Cache + async IPC save
```

### IPC Bridge (renderer side)

```ts
await window.electron.invoke('fs:readFile', path)
await window.electron.invoke('shell:exec', command)
await window.electron.invoke('email:send', { to, subject, body })
window.electron.on('timer:fired', (event, timer) => { ... })
window.electron.on('channel:message', (event, msg) => { ... })
```

### Built-in Agents

| Agent | ID | Key Skills |
|-------|----|-----------|
| Assistant | `default-assistant` | All 18 skills |
| Code Expert | `builtin-code-expert` | git, code-analysis, filesystem, shell |
| Writer | `builtin-writer` | filesystem, web, utilities, memory |
| Researcher | `builtin-researcher` | web, browser, filesystem, memory |
| Data Analyst | `builtin-data-analyst` | filesystem, shell, utilities, code-analysis |
| DevOps Engineer | `builtin-devops` | shell, filesystem, system-management, git |
| Product Manager | `builtin-product-manager` | web, browser, utilities, channels |
| Translator | `builtin-translator` | web, utilities |
| Security Specialist | `builtin-security` | filesystem, shell, git, code-analysis |

---

*Last updated: 2025*
