# Suora �?User Guide

Welcome to **Suora**, an AI-powered desktop application that brings multi-model intelligence, automation, and extensibility to your daily workflow. This guide covers everything you need to get started and make the most of the app.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Getting Started](#getting-started)
4. [Chat](#chat)
5. [AI Models](#ai-models)
6. [Agents](#agents)
7. [Skills](#skills)
8. [Timer & Scheduling](#timer--scheduling)
9. [Channels](#channels)
10. [Settings](#settings)
11. [Knowledge Base & Memory](#knowledge-base--memory)
12. [Security & Privacy](#security--privacy)
13. [Keyboard Shortcuts](#keyboard-shortcuts)
14. [Troubleshooting](#troubleshooting)
15. [FAQ](#faq)

---

## Introduction

Suora is a cross-platform Electron application that lets you interact with leading AI models—Anthropic Claude, OpenAI GPT, Google Gemini, and more—through a unified chat interface. Beyond simple conversations, it offers intelligent agents tailored for coding, writing, research, and DevOps; a rich skill system for file operations, browser automation, email, and git; scheduled tasks; messaging-platform integrations; and a persistent memory system so your AI remembers context across sessions.

Whether you are a developer looking for a coding co-pilot, a writer seeking creative assistance, or a power user who wants to automate routine tasks, Suora adapts to your needs.

---

## Installation

### System Requirements

| Platform | Minimum Version |
|----------|----------------|
| Windows  | Windows 10 or later |
| macOS    | macOS 11 (Big Sur) or later |
| Linux    | Ubuntu 20.04 / Fedora 34 or equivalent |

### Download

1. Visit the **GitHub Releases** page of the Suora repository.
2. Download the installer for your platform:
   - **Windows** �?`.exe` installer
   - **macOS** �?`.dmg` disk image
   - **Linux** �?`.AppImage` or `.deb` package
3. Run the installer and follow the on-screen prompts.

### Build from Source

```bash
git clone https://github.com/fandych/suora.git
cd suora
npm install
npm run build
npm run package
```

---

## Getting Started

When you launch the app for the first time, a **5-step onboarding wizard** guides you through initial setup:

1. **Welcome** �?A brief introduction to the application.
2. **Configure a Model Provider** �?Enter your API key for at least one provider (e.g., OpenAI, Anthropic).
3. **Meet Your Agents** �?Preview the built-in specialized agents.
4. **Explore Skills** �?See the capabilities available to your agents.
5. **You're All Set!** �?Start chatting immediately.

> You can skip the wizard and configure everything later from **Settings**.

---

## Chat

The chat interface is the core of Suora.

### Starting a New Chat

- Click the **�?* button in the sidebar or press `Ctrl + N` (`Cmd + N` on macOS).
- Each chat is an independent session with its own history.

### Sending Messages

- Type your message and press **Enter** to send.
- Use **Shift + Enter** for a new line inside a message.
- Attach images or files with the attachment button.

### Message Features

- **Streaming responses** �?AI replies appear token-by-token in real time.
- **Markdown rendering** �?Code blocks with syntax highlighting, tables, lists, and more.
- **Tool execution indicators** �?When the AI calls a skill, you see status icons: pending (�?, running (�?, success (�?, error (�?, along with execution duration.
- **Feedback** �?Rate any assistant message with 👍 or 👎.
- **Token usage** �?Each response shows the number of tokens consumed.
- **Voice input** �?Press `Ctrl + Shift + V` to dictate a message.

### Command Palette

Press `Ctrl + K` to open the command palette for quick navigation, switching agents, toggling skills, and more.

---

## AI Models

Suora supports a wide range of AI providers.

### Supported Providers

| Provider | Example Models |
|----------|---------------|
| Anthropic | Claude 3.5 Sonnet, Claude 3 Opus |
| OpenAI | GPT-4o, GPT-4 Turbo |
| Google Vertex AI | Gemini 1.5 Pro, Gemini 1.5 Flash |
| Ollama | Llama 3, Mistral (local) |
| DeepSeek | DeepSeek Coder, DeepSeek Chat |
| Groq | Mixtral, LLaMA (fast inference) |
| Together AI | Various open-source models |
| Fireworks AI | Various open-source models |
| Perplexity | Sonar models |
| Cohere | Command R+ |
| OpenAI-compatible | Any compatible endpoint |

### Adding a Provider

1. Go to **Settings �?Model Providers**.
2. Click **Add Provider** and choose a provider type.
3. Enter your **API key** and optionally set a **base URL**.
4. Click **Test Connection** to verify.
5. Select the models you want to use.

### Per-Model Configuration

Each model can have custom **temperature** (creativity) and **max tokens** (response length) settings.

---

## Agents

Agents are specialized AI personas with distinct system prompts, skill sets, and response styles.

### Built-in Agents

| Agent | Best For | Temperature |
|-------|----------|-------------|
| 🤖 Assistant | General tasks | 0.7 |
| 🧑‍�?Code Expert | Code review, debugging | 0.5 |
| ✍️ Writer | Articles, documentation | 0.8 |
| 📚 Researcher | Research, fact-checking | 0.6 |
| 📊 Data Analyst | Datasets, trends | 0.5 |
| 🚀 DevOps Engineer | CI/CD, automation | 0.4 |
| 🛡�?Security Auditor | Vulnerability scanning | 0.3 |
| 🌐 Translator | Translation, proofreading | 0.3 |
| 📱 Product Manager | PRDs, user stories | 0.6 |

### Creating a Custom Agent

1. Navigate to the **Agents** panel.
2. Click **Create Agent**.
3. Set a **name**, **system prompt**, **response style** (concise / balanced / detailed), and **temperature**.
4. Assign the skills the agent should have access to.
5. Save.

Agents also support **auto-learning**: they can store insights into memory during conversations.

---

## Skills

Skills are tools that agents can invoke during conversations.

### Built-in Skill Categories (18+)

| Category | Examples |
|----------|---------|
| 📁 File System | Read, write, edit, search, copy, move files |
| 🖥�?Shell | Execute shell commands |
| 🌐 Web | Search the web, fetch pages, open URLs |
| 🔧 Utilities | Clipboard, notifications, screenshots, system info |
| 📋 Todo | Manage todo lists |
| �?Timer | Create and manage timers |
| 🧠 Memory | Store, search, and manage memories |
| 🌍 Browser Automation | Navigate, click, fill forms, extract text |
| 🤝 Agent Communication | Delegate tasks between agents |
| �?Event Automation | File-change and schedule triggers |
| 🧬 Self-Evolution | Create and improve skills dynamically |
| 📎 Attachments | Read file attachments |
| 🔀 Git | Status, diff, log, commit, stage |
| 🔬 Code Analysis | Analyze structure, find patterns |
| 🎯 Advanced Interaction | Interactive prompts, loop execution |
| 📱 Channels | Start/stop webhook servers, send messages |
| 📧 Email | Send SMTP emails |
| ⚙️ System Management | Switch models/sessions, manage plugins |

### Enabling / Disabling Skills

Open **Settings �?Skills** or use the command palette (`Ctrl + K`) to toggle individual skills. Disabling a skill prevents all agents from invoking it.

### Marketplace

Browse community-contributed skills from the **Skills Marketplace** and install them with one click. Custom skills are loaded from external directories such as `~/.agents/skills`.

---

## Timer & Scheduling

Automate recurring tasks by creating timers.

### Timer Types

| Type | Description | Example |
|------|-------------|---------|
| **Once** | Fire once at a specific date/time | "Remind me at 3 PM today" |
| **Interval** | Repeat every N minutes | Every 30 minutes |
| **Cron** | Advanced recurring schedule | `0 9 * * 1-5` (9 AM weekdays) |

### Creating a Timer

1. Open the **Timer** panel.
2. Click **Add Timer**.
3. Choose the timer type and configure the schedule.
4. Set the action: **Notify** (desktop notification) or **Prompt Agent** (run a prompt).
5. Save. The app shows the next 5 upcoming execution times as a preview.

### Cron Expression Reference

```
┌───────────── minute (0-59)
�?┌───────────── hour (0-23)
�?�?┌───────────── day of month (1-31)
�?�?�?┌───────────── month (1-12)
�?�?�?�?┌───────────── day of week (0-6, Sun=0)
�?�?�?�?�?
* * * * *
```

Common examples:
- `*/15 * * * *` �?Every 15 minutes
- `0 */2 * * *` �?Every 2 hours
- `30 8 * * 1` �?Monday at 8:30 AM
- `0 0 1 * *` �?Midnight on the 1st of each month

---

## Channels

Connect Suora to messaging platforms for automated responses.

### Supported Platforms

- **WeChat** �?China's leading messaging app
- **Feishu (Lark)** �?Bytedance's collaboration suite
- **DingTalk** �?Alibaba's enterprise messenger

### Setting Up a Channel

1. Go to **Channels** in the sidebar.
2. Select a platform and enter the required credentials (App ID, App Secret, Verification Token, Encryption Key).
3. Choose **Webhook** or **Stream** connection mode.
4. Enable **Auto-Reply** if you want the AI to respond automatically.
5. Optionally restrict to specific chat groups.

The app displays connection health, latency, and message history (up to 500 messages).

---

## Settings

Access settings via the gear icon in the sidebar.

### General

- **Theme** �?Light, Dark, or System (follows OS preference).
- **Language** �?English, 中文, 日本�? 한국�? Français, Deutsch, Español, Português, Русский, العربية.
- **Auto-Start** �?Launch Suora when your computer starts.
- **Auto-Save** �?Automatically save chat sessions.
- **Workspace** �?Choose a directory for application data.

### Appearance

- **Font Size** �?Small, Medium, Large.
- **Code Font** �?Fira Code, JetBrains Mono, Source Code Pro, Cascadia Code, Consolas, or Default.
- **Bubble Style** �?Default, Minimal, Bordered, Glassmorphism.
- **Accent Color** �?Pick a highlight color for the UI.

### Voice

- **Enable Voice** �?Toggle speech recognition and synthesis.
- **Language** �?BCP 47 code (e.g., `en-US`, `zh-CN`).
- **Speech Rate / Pitch / Volume** �?Fine-tune the voice output.
- **Auto-Send** �?Automatically send the message after speech recognition completes.

### Proxy

- **Enable Proxy** �?Route traffic through an HTTP, HTTPS, or SOCKS5 proxy.
- Configure **host**, **port**, and optional authentication.

### Email (SMTP)

- Configure an SMTP server to send emails via the Email skill.
- Fields: host, port, secure (TLS/STARTTLS), username, password, sender name, and sender address.

### Data Management

- **History Retention** �?Number of days to keep chat history (0 = unlimited).
- **Clear History** �?Delete all chat sessions.
- **Export / Import** �?Back up and restore agents, skills, sessions, and providers as a JSON file.

---

## Knowledge Base & Memory

Suora features a layered memory system that gives your AI persistent context.

### Memory Types

| Type | Purpose |
|------|---------|
| Insight | Important findings or conclusions |
| Preference | User preferences and personalization |
| Correction | Mistakes to avoid |
| Knowledge | General facts |

### Memory Scopes

- **Session** �?Exists only within the current chat session.
- **Global** �?Persists across all sessions and agents.

### Using Memory

Agents can automatically store and recall memories during conversations. You can also manage memory manually:

- **Store** �?Save a fact via the `memory_store` skill.
- **Search** �?Semantic search across all memories with `memory_search`.
- **List** �?Filter by type or scope with `memory_list`.
- **Delete** �?Remove entries with `memory_delete`.

### Vector Memory

For advanced use cases, Suora includes an in-memory vector index that enables semantic similarity search across your knowledge base.

---

## Security & Privacy

### Tool Execution Policies

- **Allowed Directories** �?Restrict file operations to a whitelist of directories.
- **Blocked Commands** �?Dangerous commands (`rm -rf`, `format`, `shutdown`, etc.) are blocked by default.
- **Confirmation Prompts** �?Optionally require user approval before any tool executes.

### Skill Integrity

- Skills are verified with **SHA-256 hashes** and cryptographic signatures.
- The audit system detects dangerous code patterns such as `eval()`, `Function()`, and `require()`.

### Audit Logging

Every tool execution is logged with:
- Timestamp, tool name, status, and duration
- Input/output data
- Error and blocked-command records

The audit log stores up to 10,000 entries and can be exported as JSON. A dashboard shows execution statistics for the last 24 hours.

---

## Keyboard Shortcuts

| Action | Windows / Linux | macOS |
|--------|----------------|-------|
| New Chat | `Ctrl + N` | `Cmd + N` |
| Command Palette | `Ctrl + K` | `Cmd + K` |
| Send Message | `Enter` | `Enter` |
| New Line | `Shift + Enter` | `Shift + Enter` |
| Voice Input | `Ctrl + Shift + V` | `Cmd + Shift + V` |
| Toggle Sidebar | `Ctrl + B` | `Cmd + B` |
| Close Panel | `Escape` | `Escape` |

All shortcuts are customizable in **Settings �?Keyboard Shortcuts**.

---

## Troubleshooting

### The app doesn't start

- Make sure your system meets the minimum requirements.
- On Linux, verify the AppImage has execute permissions: `chmod +x Suora.AppImage`.
- Check the application logs in `~/.suora/logs/`.

### AI responses are empty or fail

- Confirm your API key is valid in **Settings �?Model Providers**.
- Click **Test Connection** to diagnose connectivity issues.
- If you are behind a corporate firewall, configure a proxy in **Settings �?Proxy**.

### Skills are not executing

- Verify the skill is enabled in **Settings �?Skills**.
- Check **Security �?Allowed Directories** if a file operation is being blocked.
- Review the **Audit Log** for error details.

### Timer doesn't fire

- Ensure the timer is toggled **on**.
- Verify your cron expression using the preview panel (it shows the next 5 runs).
- The app must be running for timers to execute (check frequency: every 15 seconds).

### High memory usage

- Reduce **History Retention** in Settings.
- Clear old chat sessions.
- Disable unused skills and agents.

---

## FAQ

**Q: Is my data sent to third-party servers?**
A: Conversations are sent only to the AI provider you configure (e.g., OpenAI, Anthropic). No data is sent to the Suora team.

**Q: Can I use local models?**
A: Yes. Add an **Ollama** provider and point it to your local Ollama instance.

**Q: How do I reset the app?**
A: Delete the `~/.suora/` directory and relaunch the app.

**Q: Can I use multiple AI providers at the same time?**
A: Absolutely. Add as many providers as you like and switch between models mid-conversation.

**Q: Where are my chat sessions stored?**
A: Locally on your computer in the workspace directory (default: `~/.suora/`).

**Q: How do I create a custom skill?**
A: Use the **Self-Evolution** skill (`skill_create`) to dynamically generate new skills, or place a skill definition file in `~/.agents/skills/`.

**Q: Is there a mobile version?**
A: Suora is currently available for Windows, macOS, and Linux only.

**Q: How do I report a bug?**
A: Open an issue on the GitHub repository with reproduction steps and your system information.

---

*Thank you for using Suora! If you have suggestions or feedback, we'd love to hear from you on GitHub.*
