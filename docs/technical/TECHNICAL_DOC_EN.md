# Suora Technical Documentation

This document describes the current implementation in the repository. It is intended as a code-backed architecture reference for contributors and maintainers.

## 1. System Overview

Suora is an Electron desktop workbench built around a React renderer and a privileged Electron main process. The current product surface is organized into these major workbench areas:

- Chat
- Documents
- Pipeline
- Models
- Agents
- Skills
- Timer
- Channels
- MCP
- Settings

The application is local-first. User state, agent configuration, model configuration, document trees, sessions, and most operational metadata are stored on disk through an IPC-backed persistence layer.

## 2. Runtime Architecture

The runtime is split into three layers.

| Layer | Responsibility |
| --- | --- |
| Electron main process | Owns native capabilities such as filesystem access, network fetch helpers, secure storage integration, shell access, channel runtime, and IPC handlers |
| Preload bridge | Exposes a whitelist-based `window.electron` API under context isolation |
| React renderer | Renders the workbench UI, holds user state in Zustand, and orchestrates AI, documents, pipelines, channels, and settings |

The renderer is routed with a hash router and lazy-loads feature modules.

### Current top-level routes

| Route | Module |
| --- | --- |
| `/chat` | Chat workspace |
| `/documents` | Document workspace |
| `/pipeline` | Agent pipeline editor and execution history |
| `/models/:view` | Provider, model, and compare views |
| `/agents` | Agent manager |
| `/skills/:view` | Installed, browse, and sources skill views |
| `/timer` | Timer and schedule management |
| `/channels` | Messaging channel integrations |
| `/mcp` | Integrations and MCP configuration |
| `/settings/:section` | Settings sections |

### Current settings sections

- `general`
- `security`
- `voice`
- `shortcuts`
- `data`
- `logs`
- `system`

## 3. Repository Layout

The current repository layout is centered on an Electron shell and a feature-organized React application.

```text
electron/
  main.ts          Electron main process and IPC handlers
  preload.ts       Context-isolated preload bridge
  channelService.ts
  database.ts

src/
  App.tsx          Router bootstrap and global initialization
  main.tsx         Renderer entry
  index.css        Global theme tokens and UI styles
  components/      Feature modules and shared UI
  hooks/           React hooks
  services/        AI, storage, i18n, pipelines, channels, documents
  store/           Zustand store and slices
  types/           Shared application types

docs/
  user/            End-user documentation
  technical/       Technical references

e2e/
  Playwright end-to-end tests
```

## 4. Technology Stack

| Area | Technology |
| --- | --- |
| Desktop shell | Electron 41 |
| Frontend | React 19 |
| Build tooling | Vite 6 + electron-vite 5 |
| Styling | Tailwind CSS 4 |
| State | Zustand 5 |
| Language | TypeScript 5.8 |
| AI runtime | Vercel AI SDK 6 |
| Unit testing | Vitest |
| End-to-end testing | Playwright |

## 5. Application State Model

Suora uses a single persisted Zustand store in `src/store/appStore.ts`. The store coordinates feature state for the entire workbench.

### Important state domains

- Sessions and chat tabs
- Documents, folders, and document groups
- Models and provider configurations
- Agents, agent memories, agent versions, and performance stats
- Skills, skill versions, and external skill sources
- Pipelines and pipeline execution metadata
- Timers
- Channels, channel health, users, history, and tokens
- Notifications
- MCP server configuration and status
- UI preferences such as theme, locale, font size, accent color, and active module

### Persisted behavior

The store persists through the application's file-backed storage services instead of relying only on browser storage. The data settings flow currently exports and imports:

- custom agents
- custom skills
- all sessions
- provider configurations
- external directory settings

## 6. Model and AI Service Layer

The AI integration lives in `src/services/aiService.ts`.

### Current provider support

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

### Key responsibilities of the AI service

- validate model configuration before use
- initialize provider clients and cache them by provider identity, key, and base URL
- classify provider and network failures into retryable and non-retryable buckets
- generate standard text responses
- stream responses with tool calls through a multi-step loop

### Current streamed event types

- `text-delta`
- `tool-call`
- `tool-result`
- `tool-error`
- `finish-step`
- `usage`
- `error`

## 7. Agents and Skills

### Built-in agents

The current store seeds one general assistant plus six specialized agents.

- Assistant
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

### Agent model

The `Agent` type currently includes:

- `systemPrompt`
- `modelId`
- `skills`
- `temperature`
- `maxTokens`
- `maxTurns`
- `responseStyle`
- `allowedTools`
- `disallowedTools`
- `permissionMode`
- `memories`
- `autoLearn`

This means Suora agents are not just prompt presets. They also carry routing, tool-constraint, and memory behavior.

### Skill model

Skills are prompt-based capability packages rather than low-level tool registrations. The current skill system supports:

- installed skills
- registry browsing
- skill source management
- `SKILL.md` authoring and preview
- importing a single skill file
- importing a whole skill folder
- exporting as markdown or zip
- bundled resource trees next to `SKILL.md`

The current code comments and UI behavior make an important distinction: built-in tools remain available through the tool system, while skills add domain-specific instructions and packaged resources.

## 8. Documents, Pipelines, and Timers

### Documents

The documents module is a real local knowledge workspace. The current implementation includes:

- document groups
- nested folders
- markdown documents
- Mermaid rendering
- math rendering
- backlinks and references
- document search
- graph view
- document context selection for chat

### Pipelines

The pipeline module currently implements multi-step agent workflows with:

- step-based execution
- retries and backoff strategies
- per-step timeouts
- conditional execution with `runIf`
- output transforms and exported variables
- execution budgets for total duration, tokens, and step count
- execution history and step-level details
- save, import, and export flows

The chat layer also supports `/pipeline` commands for listing, running, checking status, reading history, and cancelling saved pipelines.

### Timers

The timer module currently supports three schedule types:

- `Once`
- `Interval`
- `Cron`

And three action types:

- desktop notification
- agent prompt execution
- saved pipeline execution

## 9. Channels and MCP

### Channel platforms

The current `ChannelPlatform` surface supports:

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

### Channel behavior

The current channel editor supports:

- webhook or stream transport
- one reply agent per channel
- auto-reply enablement
- allowed chat lists
- message history
- user lists
- health panels
- debug panels

### MCP

The integrations module currently exposes MCP server management, including:

- server configuration
- connection status tracking
- integration of MCP capability into agent execution

## 10. IPC and Security Model

Suora keeps Electron context isolation enabled and routes privileged operations through the preload bridge.

### Main security characteristics

- renderer code does not directly access Node.js APIs
- preload exposes an allowlisted invoke/on/send surface
- secure-storage failures are surfaced to the UI as warnings
- filesystem access can be sandboxed
- users can configure allowed directories
- dangerous shell patterns can be blocked
- tool execution can require confirmation before running

### Secure storage behavior

The application first attempts to store sensitive data such as API keys in operating-system-backed secure storage. If secure storage is unavailable or encryption fails, the UI warns that keys remain in memory only and must be re-entered after restart.

## 11. User Interface and Theming

The renderer uses a shared tokenized theme system in `src/index.css` and preference hooks such as `useTheme`.

### Current preference dimensions

- light, dark, or system theme
- font size
- code font
- accent color
- locale

The default UI preference theme is currently `system`.

## 12. Internationalization

The application includes built-in locale support through `src/services/i18n.ts` and `src/hooks/useI18n.ts`.

### Current locale set

- English
- Chinese
- Japanese
- Korean
- French
- German
- Spanish
- Portuguese
- Russian
- Arabic

The localization layer is used throughout navigation, settings, empty states, onboarding, and feature-specific labels.

## 13. Build, Run, and Test

### Common development commands

```bash
npm install
npm run dev
npm run build
npm run preview
npm run package
npm run lint
npm run type-check
npm run test:run
npm run test:e2e
```

### Current testing coverage

The repository contains both unit and UI-oriented tests. Based on the present workspace, tests cover areas such as:

- Electron preload behavior
- storage utilities
- onboarding UI
- skill editor behavior
- marketplace and skill registry flows
- theme hooks
- database helpers
- Playwright end-to-end smoke coverage

## 14. Contributor Notes

If you update architecture documentation in this repository, prefer code-backed statements over aspirational wording. In particular:

- document actual routes from `src/App.tsx`
- document actual built-in agents from `src/store/appStore.ts`
- document actual provider types from `src/services/aiService.ts`
- document actual settings sections from `src/components/settings/SettingsLayout.tsx`
- avoid hard-coding counts for IPC channels or tools unless they are freshly verified

That keeps the technical documentation aligned with the implementation rather than with historical drafts.