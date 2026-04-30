# Suora Feature Reference

This document summarizes the end-user visible capabilities that are implemented in the current codebase.

## Workbench Modules

Suora currently ships with these primary modules:

| Module | What users can do |
| --- | --- |
| Chat | Run multi-turn conversations with selectable agents and models, send attachments, review tool calls, branch conversations, pin messages, retry failures, and trigger pipelines from chat |
| Documents | Organize markdown documents into groups and folders, edit with WYSIWYG tools, render Mermaid and math, search notes, inspect backlinks, and view a relationship graph |
| Pipeline | Design saved multi-step agent pipelines with variables, budgets, retries, conditions, history, and Mermaid previews |
| Models | Configure providers, test connectivity, enable models, tune per-model parameters, and compare available models |
| Agents | Create, duplicate, test, export, import, and version agents with custom prompts, tool policy, memory, and model routing |
| Skills | Manage installed skills, browse registry skills, edit SKILL.md-based skills, add registry sources, and import/export skill bundles |
| Timer | Schedule one-time, interval, or cron jobs that notify, prompt an agent, or run a saved pipeline |
| Channels | Connect chat platforms, assign reply agents, choose webhook or stream transport, and inspect runtime status, messages, users, health, and debug data |
| MCP | Configure Model Context Protocol servers and track their connection state |
| Settings | Manage appearance, security, voice, shortcuts, data, logs, onboarding, runtime metrics, and crash logs |

## AI Provider Support

The current model configuration layer supports these provider types:

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
- Generic OpenAI-compatible endpoints

Provider configurations support API keys, custom base URLs, connectivity tests, enabled model lists, and per-model `temperature` / `maxTokens` settings.

## Built-in Agents

The current store initializes these built-in agents:

| Agent | Positioning |
| --- | --- |
| Assistant | General-purpose default assistant |
| Code Expert | Implementation, debugging, refactoring, builds, tests, and code review |
| Writing Strategist | Drafting, rewriting, structure, summaries, and polished copy |
| Research Analyst | Research, source comparison, synthesis, and uncertainty tracking |
| Security Auditor | Threat review, permissions, secrets, and safe implementation guidance |
| Data Analyst | Data interpretation, SQL, metrics, and experiment analysis |
| DevOps Expert | CI/CD, deployment, infrastructure, automation, and operational troubleshooting |

Agents support custom prompts, model binding, temperature, max turns, permissions mode, allow/deny tool lists, auto-learn, local memories, testing, duplication, import/export, and version snapshots.

## Skills and Extensibility

The implemented skill workflow includes:

- Installed skill management
- Registry browsing and install previews
- Source management for skill registries
- `SKILL.md` editing with metadata, content, and preview tabs
- Import from a single markdown file or a complete skill folder
- Export as markdown or zip archive
- Auto-loading from workspace and external directories

External directory loading supports both `skills` and `agents` directories.

## Chat Experience

The current chat UI supports:

- Multi-session chat with tabs and session list
- Session-level model and agent overrides
- Image, file, and audio attachments
- Streaming responses
- Tool-call timelines and output previews
- Markdown rendering with KaTeX and fenced code blocks
- Inline citations
- Message edit, delete, pin, feedback, branch, and retry flows
- Read-aloud for assistant answers when speech synthesis is available
- A command palette for quick navigation and opening entities
- Chat commands for saved pipelines such as `/pipeline list` and `/pipeline run`

## Documents and Knowledge Work

The document workbench currently supports:

- Document groups
- Nested folders and documents
- Rich markdown editing
- Mermaid diagrams and math blocks
- Search and filtering
- Backlinks and references
- Document graph visualization
- Attaching document context to chats

## Automation

### Pipelines

Saved pipelines support:

- Multiple agent steps
- Retry count and backoff strategy
- Timeout per step
- Output transforms
- Named exported variables
- `runIf` conditions
- Run budgets for time, tokens, and step count
- Execution history with step-level usage and status

### Timers

Timers support:

- Once schedules
- Interval schedules
- Cron schedules
- Notify actions
- Agent prompt actions
- Saved pipeline actions
- Retry and missed-run policy metadata

## Channel Integrations

The `ChannelPlatform` type currently includes:

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

Channel configuration supports webhook and stream transport modes, auto-reply, per-channel agent routing, chat allowlists, message history, user tracking, health status, and debug views.

## Settings, Security, and Data

Implemented settings sections are:

- General
- Security
- Voice
- Shortcuts
- Data
- Logs
- System

Key user-visible security and operations features:

- Secure OS-backed API key storage with in-memory fallback when secure storage is unavailable
- Filesystem sandbox modes
- Allowed directory allowlist
- Blocked shell command patterns
- Optional confirmation before every tool call
- Environment variable manager with secret masking
- Proxy configuration
- SMTP email configuration and test connection
- Data export/import for agents, skills, sessions, provider configs, and external directories
- History retention and destructive cleanup actions
- Runtime metrics and crash log viewer

## Notes on Scope

This document intentionally tracks what is visible in the current implementation. Older docs that mention unsupported agent lists, legacy settings paths, or fewer channel platforms should be considered outdated.