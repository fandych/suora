# Suora User Guide

This guide is based on the current implementation in the codebase. It focuses on what Suora can do today, not on older plans or historical documentation.

After the documentation cleanup, `docs/user/USER_GUIDE_EN.md` and `docs/user/USER_GUIDE_ZH.md` are the long-lived primary user manuals. Focused references for testing, channels, and product scope live in `docs/TESTING.md`, `docs/CHANNEL_INTEGRATION.md`, and `docs/requirements.md`.

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

### Install from packaged releases

If you are not running from source, start from the latest GitHub release:

1. Open <https://github.com/fandych/suora/releases/latest>
2. Pick the right package for your OS
3. Launch the app and configure at least one model provider in Models before using the rest of the workbench

### Onboarding

On first launch, Suora shows a 5-step onboarding flow:

1. Welcome
2. Configure a Model Provider
3. Meet Your Agents
4. Explore Skills
5. You're All Set

If you skip it, you can replay it later from `Settings -> System`.

### Recommended first-time setup order

1. Configure one cloud provider or local Ollama endpoint in **Models**
2. Choose a default model and agent in **Chat**
3. Enable the skills you actually need in **Skills**
4. Create at least one document group in **Documents**
5. Add automation later in **Pipeline** and **Timer**
6. Connect external messaging platforms only when you need them in **Channels**

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
- Pipeline builder
- Timer builder
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
- source-aware related-note expansion
- graph view with bridges, sparse clusters, gaps, and unexpected-link insights
- using selected documents as chat context

Recommended flow:

1. group notes by project or domain
2. build folder structure under each group
3. use backlinks and references to keep related material connected
4. select the right documents as chat context before asking for help

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

## 8. Channels, MCP, and Settings

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

### Settings, Security, and Data

The current settings sections are:

- General
- Security
- Voice
- Shortcuts
- Data
- Logs
- System

Important settings capabilities include:

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

The current implementation tries to store API keys in OS-backed secure storage first. If the system keyring is unavailable or encryption fails, Suora warns that keys remain in memory only and must be re-entered after restart.

## 9. Common workflows

### Bring local notes into chat

1. organise notes in Documents
2. open Chat and pick the model and agent for the task
3. attach the relevant documents as context
4. ask for summaries, drafting, analysis, or execution help

### Turn repeated work into a pipeline

1. create a pipeline with multiple agent steps
2. configure retries, `runIf`, timeouts, and exported variables
3. save it and run it from the UI, from chat, or from a timer

### Connect an external channel

1. create a channel in Channels
2. assign the reply agent
3. fill in credentials and webhook or stream settings
4. validate the runtime in the Health and Debug panels

## 10. Troubleshooting

### Model calls fail or return nothing

- check API key, base URL, and connectivity in Models
- if you use Ollama, confirm the local endpoint is running
- retry the provider test before debugging the chat flow

### API keys disappear after restart

- Secure Storage / OS keyring may be unavailable
- in that case Suora keeps keys in memory only and asks you to re-enter them after restart

### Channels do not receive messages

- confirm the channel is enabled
- confirm the reply agent still exists
- re-check webhook URL, signing keys, and allowed chats

## 11. Related references

- [Technical documentation](../technical/TECHNICAL_DOC_EN.md)
- [Testing guide](../TESTING.md)
- [Channel integration guide](../CHANNEL_INTEGRATION.md)
- [Product scope and requirements baseline](../requirements.md)
