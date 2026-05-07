# Suora Feature Index

This file is the shortest implementation-backed capability map for the current product. For detailed usage and architecture, continue to the primary manuals in `docs/`.

## Product Shape

Suora is a local-first desktop AI workbench, not a single-chat shell. The current app ships these first-class modules:

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

## Core Workbench Capabilities

| Area | Current capability surface |
| --- | --- |
| Chat | Multi-session conversations, attachments, model/agent switching, tool-call visibility, branching, retry, citations, read-aloud, and command-palette entry points |
| Documents | Local document groups, nested folders, markdown editing, Mermaid, math, search, backlinks, graph view, related-note expansion, and chat context attachment |
| Pipeline | Saved multi-step agent workflows with retries, timeouts, budgets, `runIf`, output transforms, exported variables, history, and Mermaid preview |
| Models | Provider configuration, connectivity testing, enabled model lists, per-model parameters, and compare view |
| Agents | Built-in and custom agents with prompts, model binding, tool policy, skills, memories, testing, import/export, duplication, and version snapshots |
| Skills | Installed-skill management, registry browsing, `SKILL.md` editing, source management, import/export, and auto-loading from workspace or external directories |
| Timer | Once, interval, and cron schedules that can notify, prompt an agent, or run a saved pipeline |
| Channels | Messaging-channel configuration with webhook/stream transport, reply-agent routing, allowlists, history, users, health, and debug panels |
| MCP | MCP server configuration and connection-state tracking |
| Settings | General, security, voice, shortcuts, data, logs, and system sections |

## Providers and Agents

### Runtime provider support

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

### Built-in agents

- Assistant
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

## Automation and Integration

### Pipelines and timers

- Chat can trigger saved pipelines with `/pipeline` commands
- Timers support once / interval / cron scheduling
- Timer actions include desktop notifications, agent prompts, and saved pipelines

### Channel platforms

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

## Security and Data

- API keys prefer OS-backed secure storage
- If secure storage is unavailable, keys stay in memory only
- Filesystem access can be sandboxed
- Allowed directories and blocked shell patterns are configurable
- Tool execution can require confirmation
- Data import/export covers agents, skills, sessions, provider configs, and external directories

## Read Next

- [User guide (ZH)](./docs/user/USER_GUIDE_ZH.md)
- [User guide (EN)](./docs/user/USER_GUIDE_EN.md)
- [Technical docs (ZH)](./docs/technical/TECHNICAL_DOC_ZH.md)
- [Technical docs (EN)](./docs/technical/TECHNICAL_DOC_EN.md)
- [Testing guide](./docs/TESTING.md)
- [Channel guide](./docs/CHANNEL_INTEGRATION.md)
