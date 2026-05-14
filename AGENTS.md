# AGENTS.md

Shared guidance for coding agents working in this repository. Keep this file and `CLAUDE.md` aligned on implementation-backed facts.

## Project Snapshot

**Suora (朔枢)** is an Electron-based AI workbench, not a single-chat toy app. The user-facing surface spans chat, documents, pipelines, model/provider management, agents, skills, timers, channels, MCP integrations, and settings.

Core stack:

- Electron 41 with electron-vite 5
- React 19 with React Router 7
- Tailwind CSS 4
- Zustand 5 persisted application state
- Vercel AI SDK 6
- TypeScript 5
- Vitest, Testing Library, and Playwright

## Current Product Surface

Top-level routes are defined in `src/App.tsx`:

- `/chat`
- `/documents`
- `/pipeline`
- `/models/:view` with `/models -> /models/providers`
- `/agents`
- `/skills`
- `/timer`
- `/channels`
- `/mcp`
- `/settings/:section` with `/settings -> /settings/general`

Current settings sections are defined in `src/components/settings/SettingsLayout.tsx`:

- `general`
- `security`
- `voice`
- `shortcuts`
- `data`
- `logs`
- `system`

Useful subviews to remember when editing navigation or docs:

- Models: `providers`, `models`, `compare`

## Primary Anchors

Start from the owning implementation instead of broad exploration.

- `src/App.tsx`: actual route surface, lazy-loaded module entry points, secure-storage warning wiring
- `src/store/appStore.ts`: canonical persisted state, built-in agents, import/export scope, global module state
- `src/store/slices/modelConfigSlice.ts`: provider presets, tool-security defaults, model catalog syncing
- `src/services/aiService.ts`: provider initialization, validation, client caching, streaming, error classification
- `src/services/agentPipelineService.ts`: pipeline execution lifecycle and step behavior
- `src/services/pipelineChatCommands.ts`: chat-driven pipeline command parsing
- `src/services/skillRegistry.ts`: SKILL.md parsing, serialization, load/save behavior
- `src/services/skillMarketplace.ts`: registry browsing and install/uninstall flows
- `src/services/documents.ts`: document tree persistence and graph behavior
- `src/services/channelMessageHandler.ts`: renderer-side channel runtime behavior
- `src/services/mcpSystem.ts`: MCP server configuration and status handling
- `src/components/settings/SettingsLayout.tsx`: settings sections and layout contract
- `package.json`: supported scripts and dependency versions

## Architecture Guardrails

### State and Persistence

The app uses a single persisted Zustand store rooted in `src/store/appStore.ts`, with feature slices under `src/store/slices/`. Treat store changes as cross-module changes by default.

Important persisted domains include:

- chat sessions and tabs
- documents, folders, groups, and graph-like document nodes
- provider configs and enabled model catalogs
- agents, versions, memories, and performance stats
- skills, registry sources, and imported bundles
- pipelines and execution history
- timers and timer runtime metadata
- channels, message history, users, tokens, and health
- notifications
- MCP server config and status
- UI preferences and workspace-scoped settings
- plugin metadata, external directories, proxy, email, and environment variables

### Models and Providers

Runtime provider initialization in `src/services/aiService.ts` currently supports:

- `anthropic`
- `openai`
- `google`
- `ollama`
- `deepseek`
- `zhipu`
- `minimax`
- `groq`
- `together`
- `fireworks`
- `perplexity`
- `cohere`
- `openai-compatible`

Current UI/provider preset reality is narrower and split across files:

- `src/store/slices/modelConfigSlice.ts` seeds presets for OpenAI, Anthropic, Google Gemini, Ollama, DashScope, Kimi, and generic OpenAI-compatible
- `src/components/models/ProviderEditor.tsx` currently exposes provider type selection for `openai`, `anthropic`, `google`, `ollama`, and `openai-compatible`

Document runtime support and UI exposure separately. Do not collapse them into one list.

### Agents

Built-in agents are defined in `src/store/appStore.ts`:

- Assistant
- Agent builder
- Pipeline builder
- Timer builder
- Document editor
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

Agent behavior is richer than a prompt preset. Preserve fields like skill bindings, tool allow/deny lists, permission mode, memories, response style, and max turn limits.

### Skills

The skills system is prompt-based and centered on `SKILL.md` files.

Important rules:

- skills are not the same as the built-in tool registry
- `SKILL.md` content is parsed and serialized by `skillRegistry.ts`
- installed, browse, and registry-source management are first-class UI flows
- local/project/user/registry-backed skills all exist in the current product surface

Do not reintroduce stale assumptions that each skill directly implements a tool.

### Pipelines, Timers, Channels, and MCP

- Pipelines are a real runtime feature with step execution, retries, timeouts, `runIf`, output transforms, exported variables, and saved execution history
- Timers can trigger desktop notifications, agent prompts, and saved pipelines
- Channels are first-class modules, not side demos
- MCP configuration and status are part of the persisted workspace state and the `/mcp` route

Channel platform coverage currently includes:

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

### Electron Security

When touching Electron-facing code, keep these constraints intact:

- `contextIsolation` stays enabled
- renderer code does not reach Node.js APIs directly
- privileged operations go through `electron/preload.ts` and `electron/main.ts`
- secure-storage failures must still surface clear warnings to the renderer
- filesystem, shell, and tool restrictions must not be bypassed casually

## Working Rules

When implementing changes:

1. Start from the owning route, service, or store domain.
2. Update shared types in `src/types/` when changes cross module boundaries.
3. Add store actions only when the data truly belongs in persisted global state.
4. Prefer feature-local services in `src/services/` for runtime behavior.
5. Keep Electron main/preload changes in sync.
6. Add focused tests when a nearby test surface already exists.
7. Update docs when routes, providers, built-in agents, settings sections, or security behavior change.
8. After any code change, validate against the GitHub Actions `test` job in `.github/workflows/test.yml`, matching its Node 22.x environment and steps as closely as practical before handing off. Do not claim the work is complete if that workflow-level validation has not been run or if a step is still blocked.

When editing documentation, prefer implementation-backed facts over inherited prose. The most drift-prone items in this repo are:

- route counts and redirect targets
- provider support versus provider presets
- built-in agent names
- settings sections
- test totals or coverage claims
- IPC/tool counts

Only write exact counts after revalidating them from code or commands.

## Common Commands

Install:

```bash
npm install
```

Development:

```bash
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
npm run package
```

Code quality and tests:

```bash
npm run lint
npm run type-check
npm run test
npm run test:ui
npm run test:run
npm run test:coverage
npm run test:e2e
npm run test:e2e:ui
```

## Testing Notes

- Vitest covers renderer and Electron slices where `*.test.*` and `*.spec.*` files already exist
- Playwright is currently renderer-focused smoke coverage against the Vite app, not full Electron window automation
- For targeted work, prefer the narrowest relevant validation first, then widen only if needed
- For any code-editing task, the final validation bar is the current GitHub Actions `test` job in `.github/workflows/test.yml` on Node 22.x: start from `npm ci` when dependencies or the lockfile could affect results, then run `npm run lint`, `npm run type-check`, `npm run test:run`, `npm run test:coverage`, `npm audit --audit-level=moderate`, Playwright browser setup as needed for `npm run test:e2e`, and `npm run build`
- If the local environment prevents one of those workflow steps from running, report the exact blocked step and reason explicitly instead of implying that the Actions test flow should pass

## Notes

- Use the `@` alias for renderer imports
- Tailwind CSS v4 styling is driven through the current Vite/Electron setup and `src/index.css`
- External directory loading exists for both agents and skills
- A plugin runtime exists in services/store, but it is still a supporting subsystem rather than a primary top-level route