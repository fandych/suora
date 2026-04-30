# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

**Suora (朔枢)** is an Electron-based AI workbench. The current codebase is centered on a desktop workbench with dedicated modules for chat, documents, pipelines, models, agents, skills, timers, channel integrations, MCP servers, and settings.

It is not just a single chat shell. When you make changes, assume the user-facing surface spans multiple workspaces and that many features share the same persisted state.

### Technology Stack

- **Desktop**: Electron 41 + electron-vite 5
- **Frontend**: React 19 + Vite 6 + React Router
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand 5
- **AI Runtime**: Vercel AI SDK 6
- **Language**: TypeScript 5
- **Testing**: Vitest + Testing Library + Playwright
- **Packaging**: Electron Builder 26

## Current Product Surface

Top-level routes are defined in `src/App.tsx` and currently include:

- `/chat`
- `/documents`
- `/pipeline`
- `/models/:view`
- `/agents`
- `/skills/:view`
- `/timer`
- `/channels`
- `/mcp`
- `/settings/:section`

Current settings sections are:

- `general`
- `security`
- `voice`
- `shortcuts`
- `data`
- `logs`
- `system`

## Repository Layout

```text
src/
  App.tsx                       router bootstrap and global initialization
  main.tsx                      renderer entry
  index.css                     theme tokens and global UI styles
  components/                   feature UIs grouped by module
    agents/
    channels/
    chat/
    documents/
    integrations/
    layout/
    models/
    pipeline/
    settings/
    skills/
    timer/
  hooks/                        reusable React hooks
  services/                     runtime and persistence logic
  store/                        persisted Zustand store and slices
    appStore.ts
    slices/
  types/                        shared application types
  utils/                        parsing, path, and serialization helpers

electron/
  main.ts                       Electron main process and privileged IPC
  preload.ts                    allowlisted renderer bridge
  channelService.ts             channel-side runtime helpers
  database.ts                   local persistence helpers

docs/                           user, technical, and topic docs
e2e/                            Playwright smoke tests
```

## Key Code Anchors

Use these files as the most reliable implementation anchors when updating code or docs:

| File | Why it matters |
| --- | --- |
| `src/App.tsx` | Real route surface, startup listeners, secure-storage warning wiring |
| `src/store/appStore.ts` | Canonical persisted app state, built-in agents, import/export scope |
| `src/services/aiService.ts` | Provider support, validation, client caching, streaming events |
| `src/services/agentPipelineService.ts` | Pipeline execution behavior and step lifecycle |
| `src/services/pipelineChatCommands.ts` | Chat-driven pipeline command parsing |
| `src/services/skillRegistry.ts` | `SKILL.md` parsing, loading, and serialization |
| `src/services/skillMarketplace.ts` | Registry browsing and install flows |
| `src/services/documents.ts` | Document tree and content persistence behavior |
| `src/services/channelMessageHandler.ts` | Renderer-side channel runtime behavior |
| `src/services/mcpSystem.ts` | MCP server configuration and connection handling |
| `src/components/settings/SettingsLayout.tsx` | Current settings sections and layout contract |
| `package.json` | Supported scripts, build targets, and dependency versions |

## Architecture Notes

### 1. State Management

The app uses a single persisted Zustand store rooted in `src/store/appStore.ts`, with some structure split into `src/store/slices/`.

Important state domains include:

- chat sessions and tabs
- documents, folders, and document groups
- provider configs and enabled models
- agents, agent memories, versions, and performance stats
- skills, registry sources, and imported bundles
- pipelines and execution history
- timers and timer runtime metadata
- channels, channel history, users, and health
- notifications
- MCP server config and status
- UI preferences and workspace-scoped settings
- external directories, environment variables, email, and proxy settings

### 2. AI Integration

`src/services/aiService.ts` is the provider abstraction layer. It currently supports:

- Anthropic
- OpenAI
- Google
- Ollama
- DeepSeek
- Zhipu
- MiniMax
- Groq
- Together AI
- Fireworks
- Perplexity
- Cohere
- OpenAI-compatible endpoints

The service is responsible for validation, provider/client caching, error classification, and streaming tool-aware responses.

### 3. Agents

Built-in agents are defined in the store and currently include:

- Assistant
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

Agent behavior is richer than a plain prompt preset. Current agent config includes model routing, skills, tool allow/deny lists, permission mode, memories, response style, and token/turn limits.

### 4. Skills

The current skills system is prompt-based and centered on `SKILL.md` files.

Important rules:

- skills are not the same thing as the built-in tool registry
- `SKILL.md` content is treated as capability instructions and resources
- registry browsing, local import/export, and directory loading are all first-class flows

When changing the skills system, keep it aligned with `skillRegistry.ts`, `skillMarketplace.ts`, the `Skill` types, and the current skills UI rather than older “tool-per-skill” documentation.

### 5. Pipelines and Automation

Pipelines are a core runtime feature, not just documentation or mock UI. The current implementation supports multi-step agent execution, retries, timeouts, `runIf`, output transforms, exported variables, and execution history.

Timers can currently trigger:

- desktop notifications
- agent prompts
- saved pipelines

### 6. Channels and MCP

Channels and MCP are both first-class workbench modules.

Current channel platform coverage includes:

- WeChat Work
- WeChat Official Account
- WeChat Mini Program
- Feishu / Lark
- DingTalk
- Slack
- Telegram
- Discord
- Microsoft Teams
- Custom channels

MCP support currently includes server configuration, connection status tracking, and integration into agent execution.

### 7. Security Model

Keep these constraints intact when editing Electron-facing code:

- `contextIsolation` must remain enabled
- renderer code should not directly access Node.js APIs
- privileged operations must be routed through `electron/preload.ts` and `electron/main.ts`
- secure-storage failures must surface clear user warnings
- filesystem and tool execution restrictions must not be bypassed casually

## Common Development Tasks

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build and Package

```bash
npm run build
npm run preview
npm run package
```

### Code Quality and Tests

```bash
npm run lint
npm run type-check
npm run test:run
npm run test:coverage
npm run test:e2e
```

## Testing Notes

- Vitest covers `src/**/*.{test,spec}.{ts,tsx}` and `electron/**/*.{test,spec}.{ts,tsx}`.
- Playwright currently runs renderer-focused smoke coverage against a Vite server on `http://localhost:5173`.
- Do not describe the current Playwright setup as full Electron-window automation unless the config changes to launch Electron directly.

## Contributor Guidance

### When Adding a New Feature

1. Start from the owning route, service, or store domain instead of adding disconnected helpers.
2. Update shared types in `src/types/` when the feature crosses module boundaries.
3. Add or extend store actions only when the data truly belongs in persisted global state.
4. Prefer feature-local services in `src/services/` for execution logic.
5. Add focused tests for the touched slice when a test surface already exists.
6. Update docs if you change routes, providers, built-in agents, settings sections, or security behavior.

### When Touching Electron APIs

- Keep `electron/main.ts` and `electron/preload.ts` in sync.
- Expose only the smallest renderer API surface needed.
- Preserve warning behavior around secure storage, logging, and permission-sensitive flows.

### When Touching Skills or Agents

- Keep `SKILL.md` parsing and serialization compatible with the current skills editor.
- Avoid reintroducing stale assumptions that every skill directly defines a tool implementation.
- Use the built-in agent list and current store types as the source of truth.

### When Updating Documentation

Prefer implementation-backed anchors over inherited prose. The most drift-prone facts in this repo are:

- route counts
- provider lists
- built-in agent names
- settings sections
- test totals and coverage numbers
- IPC/tool counts

Only write exact counts when you have just revalidated them from code or commands.

## Notes

- Use the `@` alias for renderer imports.
- Tailwind CSS v4 is configured through the current Vite/Electron toolchain and `src/index.css` token usage.
- External directory loading exists for both agents and skills.
- A plugin runtime exists in services/store, but it is not the primary top-level workbench surface. Treat it as a supporting subsystem unless the active UI clearly exposes it.
