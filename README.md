<p align="center">
	<img src="resources/logo.svg" alt="Suora logo" width="104" />
</p>

<h1 align="center">Suora</h1>

<p align="center">
	<strong>A local-first desktop AI workbench.</strong>
</p>

<p align="center">
	Home · Chat · Documents · Models · Agents · Skills · Pipeline · Timer · Channels · MCP · Settings
</p>

<p align="center">
	<a href="https://fandych.github.io/suora/"><img alt="Docs" src="https://img.shields.io/badge/docs-homepage-0f766e?style=flat-square" /></a>
	<a href="https://github.com/fandych/suora/releases"><img alt="Release" src="https://img.shields.io/github/v/release/fandych/suora?display_name=tag&style=flat-square" /></a>
	<a href="https://github.com/fandych/suora/releases"><img alt="Platforms" src="https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-c86a3a?style=flat-square" /></a>
</p>

<p align="center">
	<a href="https://fandych.github.io/suora/"><strong>Docs</strong></a>
	·
	<a href="https://github.com/fandych/suora/releases"><strong>Releases</strong></a>
	·
	<a href="https://github.com/fandych/suora/blob/main/FEATURES.md"><strong>Features</strong></a>
	·
	<a href="https://github.com/fandych/suora/blob/main/docs/technical/TECHNICAL_DOC_EN.md"><strong>Technical Docs</strong></a>
</p>

## What Suora Is

Suora is an Electron-based AI workbench for local knowledge work, automation, and integrations.

## Current Product Surface

| Module | Current role |
| --- | --- |
| Home | Product landing surface for readiness, recent work, next actions, and AI SDK preview |
| Chat | Conversations, attachments, tool calls, and pipeline commands |
| Documents | Local notes, folders, backlinks, source-aware graph insights, and chat context |
| Models | Provider setup, model enablement, testing, and compare |
| Agents | Built-in and custom agents with testing and versioning |
| Skills | Installed skills, registry browsing, `SKILL.md` editing, and import/export |
| Pipeline | Multi-step agent workflows with history and Mermaid preview |
| Timer | Once / interval / cron schedules |
| Channels | External messaging integrations and reply routing |
| MCP | MCP server configuration |
| Settings | Preferences, security, data, knowledge, plugins, logs, external sources, automation, and system diagnostics |

## Why It Feels Different

- local-first desktop workspace instead of a browser-only shell
- chat, documents, automation, and integrations in one app
- multi-provider model strategy with BYOK and local-model support
- built-in agents, skills, pipelines, timers, channels, and MCP as real product modules

## Get Started

### Download

Get the latest build from:

- <https://github.com/fandych/suora/releases/latest>

### Run from source

```bash
npm install
npm run dev
```

### First useful setup order

1. Configure at least one model in `Models`
2. Review readiness and next actions in `Home`
3. Start a conversation in `Chat`
4. Create a local knowledge area in `Documents`
5. Add automation in `Pipeline` and `Timer`
6. Connect external channels only when needed

## Documentation Map

The repo now keeps a smaller maintained documentation set:

| Doc | Purpose |
| --- | --- |
| [FEATURES.md](./FEATURES.md) | Short capability index |
| [docs/user/USER_GUIDE_ZH.md](./docs/user/USER_GUIDE_ZH.md) | Primary Chinese user guide |
| [docs/user/USER_GUIDE_EN.md](./docs/user/USER_GUIDE_EN.md) | Primary English user guide |
| [docs/technical/TECHNICAL_DOC_ZH.md](./docs/technical/TECHNICAL_DOC_ZH.md) | Primary Chinese technical reference |
| [docs/technical/TECHNICAL_DOC_EN.md](./docs/technical/TECHNICAL_DOC_EN.md) | Primary English technical reference |
| [docs/LLM_WIKI_CAPABILITIES.md](./docs/LLM_WIKI_CAPABILITIES.md) | LLM Wiki-inspired document intelligence capability reference |
| [docs/TESTING.md](./docs/TESTING.md) | Testing and validation notes |
| [docs/CHANNEL_INTEGRATION.md](./docs/CHANNEL_INTEGRATION.md) | Channel setup and runtime notes |
| [docs/requirements.md](./docs/requirements.md) | Scope and requirements baseline |

GitHub Pages is built from `website/` with Docusaurus and publishes `website/build`.

## Development

### Common commands

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

## Experimental AI SDK Harnesses

Suora now includes project-level experimental AI SDK harness runners. These are repository tooling entrypoints and do not change the default in-app chat or agent runtime.

```bash
# Dry-run mode: reads the real repo, but edits stay in memory
npm run harness:pi -- "Summarize the architecture of this repository."

# Explicitly allow writes back into the real workspace
npm run harness:pi:write -- "Update README wording and keep the diff minimal."

# Remote Codex harness against a sandboxed snapshot of this workspace
npm run harness:codex -- "Inspect src/services/aiService.ts and summarize the architecture."

# Remote Claude Code harness against a sandboxed snapshot of this workspace
npm run harness:claude-code -- "Read README.md and propose the smallest documentation cleanup."
```

Notes:

- The runner lives in `scripts/harness-pi.mjs`.
- The remote runner lives in `scripts/harness-remote.mjs`.
- Dry-run mode mounts the workspace through `OverlayFs`, so file edits are discarded after the session.
- Write mode mounts the workspace through `ReadWriteFs`, so Pi can persist file changes.
- The Codex and Claude Code runners copy a filtered snapshot of the workspace into a Vercel sandbox; they do not write back into the local repo.
- Authentication comes from environment variables supported by the Pi harness, such as `AI_GATEWAY_API_KEY`, `VERCEL_OIDC_TOKEN`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`.
- Bridge-backed harnesses remain separate from the main chat pipeline. Suora's renderer chat currently streams through `src/services/aiService.ts` with AI SDK 6 model providers and replayed `ModelMessage[]` history, while harness adapters own their own runtime session and resume state.

## Security Notes

- API keys prefer OS-backed secure storage
- if secure storage is unavailable, keys remain in memory only
- filesystem access can be sandboxed
- tool execution can require confirmation

## License

MIT
