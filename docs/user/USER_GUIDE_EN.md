# Suora User Guide

This guide is based on the current implementation in the codebase. It focuses on what Suora can do today, not on older plans or historical documentation.

## 1. What Suora Is

Suora is a local AI workbench. The current app is not just a chat window; it is a multi-module desktop workspace built around chat, documents, models, agents, skills, pipelines, timers, channels, MCP servers, and settings.

You can use it to:

- run everyday conversations and task execution with different models
- route work to specialized agents for coding, writing, research, security, data, and DevOps
- keep a local document workspace and attach document context to chats
- build multi-step agent pipelines and run them manually or on a schedule
- connect external messaging platforms so the desktop assistant can answer inbound messages

## 2. Install and First Launch

### Requirements

- Windows, macOS, or Linux desktop environment
- Node.js 18+ when running from source
- npm

### Run from source

```bash
npm install
npm run dev
```

### Onboarding

On first launch, Suora shows a 5-step onboarding flow:

1. Welcome
2. Configure a Model Provider
3. Meet Your Agents
4. Explore Skills
5. You're All Set

If you skip it, you can replay it later from `Settings -> System`.

## 3. Workbench Map

The current top-level modules are:

| Module | What it does |
| --- | --- |
| Chat | Multi-session chat, agent/model switching, attachments, and tool-call visibility |
| Documents | Local document groups, folders, backlinks, and graph view |
| Pipeline | Multi-step agent workflow design and execution |
| Models | Provider setup, model enablement, connection testing, and comparison |
| Agents | Built-in and custom agent management, testing, import/export, and versioning |
| Skills | Installed skills, registry browsing, and `SKILL.md` editing |
| Timer | One-time, interval, and cron schedules |
| Channels | Messaging platform integrations and reply routing |
| MCP | Model Context Protocol server configuration |
| Settings | Preferences, security, data, logs, and diagnostics |

## 4. Chat Workflow

The current chat experience includes:

- multiple sessions and tabs
- per-session agent and model selection
- image, file, and audio attachments
- streaming responses
- markdown, code block, and math rendering
- tool call timelines and status display
- retry for failed assistant responses
- message edit, delete, pin, and branch actions
- feedback on assistant answers
- read-aloud for assistant output
- inline citations

### Working shortcuts

- `Ctrl/Cmd + K`: open the command palette
- `Enter`: send a message
- `Shift + Enter`: insert a new line in the chat input
- `Escape`: close the command palette or dialogs
- `Ctrl/Cmd + S`: save in the document editor

### Command Palette

The command palette can jump directly to:

- sessions
- documents
- agents
- skills
- models
- settings
- channels
- timers
- MCP
- pipeline

## 5. Models and Providers

The current provider layer supports:

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

### What the Models module currently supports

- adding provider configurations
- using provider presets
- entering API keys and custom base URLs
- testing provider connectivity
- enabling or disabling individual models
- tuning `temperature` and `maxTokens` per model
- viewing enabled models in a dedicated list
- comparing available models in the Compare view

If you use Ollama, the default local endpoint is `http://localhost:11434/v1`.

## 6. Agents and Skills

### Built-in agents

- Assistant
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

### Custom agent capabilities

The current agent editor supports:

- custom name, avatar, color, and system prompt
- model binding
- skill assignment
- temperature, max turns, and response style
- allow and deny tool lists
- auto-learn
- import, export, duplicate
- version snapshots and restore
- test chat directly in the agent module

### Skills module capabilities

The current skills flow supports:

- viewing installed skills
- enabling or disabling skills
- editing `SKILL.md`
- browsing registry skills
- previewing registry installs before installation
- adding and managing skill sources
- importing a single skill file
- importing a full skill folder
- exporting a skill as markdown or zip

Skills can also be auto-loaded from the workspace and external directories.

## 7. Documents, Pipelines, and Timers

### Documents

The Documents module currently supports:

- document groups
- nested folders
- markdown documents
- Mermaid diagrams
- math blocks
- document search
- backlinks and references
- graph view
- using selected documents as chat context

### Pipelines

The Pipeline module currently supports:

- multi-step agent workflows
- step retries and backoff strategies
- per-step timeouts
- conditional execution with `runIf`
- output transforms and exported variables
- budgets for total duration, total tokens, and step count
- Mermaid preview and source export
- execution history and step details
- save, import, and export flows

Chat also supports `/pipeline` commands such as:

- `/pipeline list`
- `/pipeline run <name-or-id>`
- `/pipeline status`
- `/pipeline history <name-or-id>`
- `/pipeline cancel`

### Timers

The current timer types are:

- Once
- Interval
- Cron

The current timer actions are:

- desktop notification
- run an agent prompt
- run a saved pipeline

## 8. Channels and MCP

### Supported channel platforms

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

### What the Channels module currently supports

- webhook or stream transport
- assigning one reply agent per channel
- auto-reply on or off
- allowed chat allowlist
- message history
- tracked user list
- health view
- debug view

### MCP

The MCP module is currently used to:

- add server configurations
- edit server configurations
- inspect connection state
- expose MCP-backed capability to agents

## 9. Settings, Security, and Data

The current settings sections are:

- General
- Security
- Voice
- Shortcuts
- Data
- Logs
- System

### Important settings capabilities

- theme, locale, fonts, and accent color
- auto-start
- proxy configuration
- SMTP email settings and connection test
- environment variable manager
- tool confirmation policy
- filesystem sandbox mode
- allowed directory list
- blocked shell command patterns
- voice-related preferences
- shortcut mapping management
- import and export
- retention policy
- logs and crash history
- runtime metrics
- replay onboarding

### API keys and secure storage

The current implementation tries to store API keys in OS-backed secure storage first.

If the system keyring is unavailable or encryption fails, Suora warns that:

- keys remain in memory only
- keys must be re-entered after restart

Do not document the current behavior as guaranteed encrypted disk persistence in every environment.

### What data export currently includes

Current exports include:

- custom agents
- custom skills
- all sessions
- provider configurations
- external directory settings

## 10. Troubleshooting

### Model connection fails

Check these in order:

1. the API key is valid
2. the base URL matches the provider
3. at least one model is enabled
4. proxy settings are not blocking the request
5. the Models view connection test passes

### A channel receives no messages

Check these in order:

1. the channel is enabled
2. the reply agent still exists and is enabled
3. the local channel server is running for webhook channels
4. the platform callback URL exactly matches the Suora URL
5. the current chat is not blocked by `allowedChats`
6. the Health or Debug panel shows no credential error

### A skill does not seem active

Check these in order:

1. the skill is enabled
2. the required skill is assigned to the agent
3. the skill was imported into the current workspace or external directory
4. the skill content is valid `SKILL.md`

### A timer does not fire

Check these in order:

1. the timer is enabled
2. the cron expression is valid
3. the target agent or pipeline still exists
4. the desktop app is running

## 11. Recommended First Session

If you are new to the current build, this order works well:

1. add a provider and enable a model in `Models`
2. review the built-in agents in `Agents`
3. start your first conversation in `Chat`
4. create a document group in `Documents`
5. save a two-step or three-step workflow in `Pipeline`
6. schedule it from `Timer`
7. configure `Channels` or `MCP` only after the local workflow feels stable