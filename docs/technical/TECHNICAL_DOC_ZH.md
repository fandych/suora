# Suora �?技术文�?

> 一款基�?Electron 的智能桌面应用程序，支持多模型、智能代理、技能系统、记忆管理和插件架构�?

## 目录

1. [架构概述](#1-架构概述)
2. [项目结构](#2-项目结构)
3. [技术栈](#3-技术栈)
4. [构建系统](#4-构建系统)
5. [状态管理](#5-状态管�?
6. [AI 服务层](#6-ai-服务�?
7. [技�?工具系统](#7-技能工具系�?
8. [国际化系统](#8-国际化系�?
9. [记忆系统](#9-记忆系统)
10. [IPC 通信](#10-ipc-通信)
11. [安全架构](#11-安全架构)
12. [插件系统](#12-插件系统)
13. [渠道集成](#13-渠道集成)
14. [测试](#14-测试)
15. [CI/CD 与发布](#15-cicd-与发�?
16. [开发指南](#16-开发指�?
17. [API 参考](#17-api-参�?

---

## 1. 架构概述

```
┌───────────────────────────────────────────────────────�?
�?                  Electron Shell                      �?
�?                                                      �?
�? ┌─────────────�? IPC�?8 个通道�? ┌────────────�?  �?
�? │主进程        │◄───────────────────►│  渲染进程   �?  �?
�? �?(Node.js)   �? preload 桥接       �?(React 19)  �? �?
�? �?            �?                     �?            �? �?
�? │�?IPC 处理�?�?                     │�?Zustand 5  �? �?
�? │�?文件 I/O   �?                     │�?AI SDK 6   �? �?
�? │�?Shell 执行 �?                     │�?工具       �? �?
�? │�?SMTP 邮件  �?                     │�?路由       �? �?
�? │�?日志记录   �?                     │�?Tailwind 4 �? �?
�? └─────────────�?                     └────────────�? �?
�?       �? contextIsolation: true            �?        �?
�?       └──────── Preload (preload.ts) ──────�?        �?
�?             window.electron.invoke/on/send            �?
└───────────────────────────────────────────────────────�?
```

- **主进�?* (`electron/main.ts`) �?拥有 `BrowserWindow`；通过 IPC 处理器处理所有操作系统级别的操作（文件系统、Shell、剪贴板、SMTP、定时器、浏览器自动化）�?
- **预加载脚�?* (`electron/preload.ts`) �?隔离的上下文，通过 `contextBridge.exposeInMainWorld('electron', ...)` 暴露 68 �?IPC 通道的白名单�?
- **渲染进程** (`src/`) �?�?Vite 6 打包的单�?React 19 应用，使�?Zustand 5 进行状态管理，通过 Vercel AI SDK 6 接入 AI，通过预加载桥接访问操作系统功能�?

---

## 2. 项目结构

```
src/
├── App.tsx                  # React Router�? 个路由）
├── index.css                # Tailwind @theme 令牌（深�?浅色�?
├── store/appStore.ts        # Zustand 全局状态（版本 12�?
├── services/
�?  ├── aiService.ts         # 多供应商 AI 集成
�?  ├── tools.ts             # 18 个技能类别，42+ 个工�?
�?  ├── i18n.ts              # 10 种语言翻译（约 910 个键�?
�?  ├── fileStorage.ts       # 基于 IPC �?JSON 持久�?+ 缓存
�?  ├── voiceInteraction.ts  # Web Speech API（语音识�?语音合成�?
�?  └── logger.ts            # 渲染进程 �?主进程日志转�?
├── hooks/
�?  ├── useI18n.ts           # 翻译 Hook
�?  └── useTheme.ts          # 主题/强调�?字体 Hook
├── components/              # 按功能组织的 React 组件
├── types/index.ts           # 共享 TypeScript 接口
└── test/setup.ts            # Vitest 配置

electron/
├── main.ts                  # 主进程，IPC 处理器，SMTP，更新器
├── preload.ts               # 上下文隔离桥接（68 个通道�?
└── logger.ts                # RotatingLogger（~/.suora/logs�?
```

**构建输出�?* `out/main/`（ESM）�?`out/preload/`（CJS）�?`out/renderer/`（SPA）�?`dist/`（安装包�?

---

## 3. 技术栈

| 层级 | 技�?| 版本 |
|------|------|------|
| 桌面 | Electron | 41.x |
| 前端 | React | 19.2 |
| 打包工具 | Vite + electron-vite | 6.0 + 5.0 |
| 样式 | Tailwind CSS | 4.2 |
| 状态管�?| Zustand | 5.0 |
| AI SDK | Vercel AI SDK (`ai`) | 6.0 |
| 语言 | TypeScript | 5.8+ |
| 路由 | React Router | 7.x |
| 校验 | Zod | 4.x |
| 邮件 | nodemailer | 8.x |
| HTTP/WS | Express 5 + ws 8 | �?|
| 打包 | electron-builder | 26.x |
| 测试 | Vitest 4.x + Playwright 1.58 | �?|

**AI 供应商包�?* `@ai-sdk/anthropic`、`@ai-sdk/openai`、`@ai-sdk/google-vertex`、`@ai-sdk/openai-compatible`（用�?Ollama、DeepSeek、Groq、Together、Fireworks、Perplexity、Cohere、Zhipu、MiniMax 及自定义端点）�?

---

## 4. 构建系统

�?`electron.vite.config.ts` 中定义了三个构建目标�?

| 目标 | 入口 | 输出 | 格式 |
|------|------|------|------|
| Main | `electron/main.ts` | `out/main/` | ESM |
| Preload | `electron/preload.ts` | `out/preload/` | CJS |
| Renderer | `index.html` | `out/renderer/` | SPA |

渲染进程使用 `@vitejs/plugin-react` + `@tailwindcss/vite`，路径别�?`@` �?`./src`，开发服务器监听 `127.0.0.1:5173`（严格端口）�?

| 命令 | 说明 |
|------|------|
| `npm run dev` | Electron + Vite 开发服务器，支持热模块替换（HMR�?|
| `npm run build` | 生产构建（全部三个目标） |
| `npm run package` | 构建 + electron-builder 打包（NSIS/DMG/AppImage�?|

**electron-builder 目标平台�?* Windows（NSIS + 便携版）、macOS（DMG + ZIP）、Linux（AppImage + DEB + RPM）�?

---

## 5. 状态管�?

使用单一 Zustand Store，配�?`persist` 中间件，�?IPC 文件存储提供后端支持�?

**Store 名称�?* `suora-store` · **版本�?* 12 · **后端�?* `~/.suora/data/`

### 核心状态切�?

| 切片 | 关键字段 |
|------|----------|
| 会话 | `sessions`、`activeSessionId`、`openSessionTabs` |
| 代理 | `agents`、`selectedAgent`、`agentPerformance`、`agentVersions` |
| 模型 | `providerConfigs`、`globalModels`、`modelUsageStats` |
| 技�?| `skills`、`pluginTools`、`skillVersions` |
| 记忆 | `globalMemories` |
| 安全 | `toolSecurity`（允许的目录、屏蔽的命令、确认机制） |
| 外观 | `theme`、`fontSize`、`codeFont`、`accentColor`、`bubbleStyle`、`locale` |
| 渠道 | `channelConfigs`、`channelMessages`、`channelTokens`、`channelHealth` |
| 插件 | `installedPlugins` |
| 邮件 | `emailConfig`（SMTP�?|

### 持久化流�?

```
Zustand �?fileStateStorage 适配�?�?IPC (store:load/save/remove) �?~/.suora/data/*.json
```

内存中的 `Map` 缓存通过 `readCached()`/`writeCached()` 实现同步读取。首次加载时，适配器检查文件存储，回退�?`localStorage`（迁移），然后进行缓存�?

### 迁移（版�?1 �?12�?

v2：代理记忆、技能工�?· v3：`toolSecurity` 默认�?· v5：`workspacePath` · v7：将 `providerConfigs` �?Record 迁移�?Array · v8：默认关闭确�?· v9：`globalMemories`，回填记忆作用域 · v10：渠道、插件、语言、代理、引�?· v11：`pluginTools`、`skillVersions` · v12：`emailConfig`

---

## 6. AI 服务�?

供应商实例按 `${providerId}:${apiKey}:${baseUrl}` 键进行缓存�?

### 支持的供应商�?3+�?

Anthropic �?OpenAI 使用各自原生 SDK 包。所有其他供应商使用 `@ai-sdk/openai-compatible`，并配置了预设的基础 URL（Google �?`generativelanguage.googleapis.com`，Ollama �?`localhost:11434/v1`，DeepSeek、Groq、Together、Fireworks、Perplexity、Cohere、Zhipu、MiniMax 或自定义端点）�?

### 核心函数

```ts
validateModelConfig(model): { valid: boolean; error?: string }
initializeProvider(providerType, apiKey, baseUrl?, providerId?): void
testConnection(providerType, apiKey, baseUrl, modelId): Promise<{ success; error?; latency? }>
generateResponse(modelId, messages, systemPrompt?): Promise<string>
streamResponseWithTools(model, messages, tools, systemPrompt?, maxSteps?): AsyncGenerator<AppStreamEvent[]>
```

### 流式事件

`text-delta` · `tool-call` · `tool-result` · `tool-error` · `finish-step` · `usage` · `error`

工具调用在多步循环中执行（默认最�?20 步，`toolChoice: 'auto'`）�?

---

## 7. 技�?工具系统

### 18 个内置技�?

| 技�?ID | 工具（示例） |
|---------|-------------|
| `builtin-filesystem` | `list_dir`、`read_file`、`write_file`、`search_files`、`copy_file`、`move_file`、`stat_file` |
| `builtin-shell` | `shell`（Unix 上为 bash，Windows 上为 PowerShell�?|
| `builtin-web` | `web_search`（DuckDuckGo）、`fetch_webpage` |
| `builtin-utilities` | `get_current_time`、`parse_json`、`generate_uuid` |
| `builtin-todo` | `list_todos`、`add_todo`、`update_todo`、`delete_todo` |
| `builtin-timer` | `list_timers`、`create_timer`、`update_timer`、`delete_timer` |
| `builtin-memory` | `search_memory`、`add_memory` |
| `builtin-browser` | `browser_navigate`、`browser_screenshot`、`browser_evaluate`、`browser_click`、`browser_fill_form` |
| `builtin-agent-comm` | `send_agent_message`、`broadcast_agent_message` |
| `builtin-event-automation` | `register_event_trigger`、`trigger_event` |
| `builtin-self-evolution` | `create_agent_memory`、`update_skill_description` |
| `builtin-file-attachment` | `analyze_image_attachment`、`save_attachment` |
| `builtin-git` | `git_exec` |
| `builtin-code-analysis` | `analyze_code`、`suggest_refactoring` |
| `builtin-advanced-interaction` | `send_persistent_message`、`request_user_input` |
| `builtin-channels` | `channel_send_message`、`channel_read_message` |
| `builtin-email` | `send_email` |
| `builtin-system-management` | `get_system_info`、`read_clipboard`、`write_clipboard`、`notify`、`take_screenshot` |

### 工具注册

```ts
import { tool } from 'ai'
import { z } from 'zod'

export const builtinToolDefs: ToolSet = {
  list_dir: tool({
    description: 'List files and directories',
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => { /* IPC 调用 */ },
  }),
}
```

函数：`registerTools()`、`getToolsForSkills(skillIds)`、`buildToolSet()`、`getCustomToolsFromSkill()`、`getPluginTools()`�?

技能可以从市场安装（官方或私有注册表，通过 Store 中的 `marketplace` 设置控制）�?

---

## 8. 国际化系�?

**10 种语言�?* en · zh · ja · ko · fr · de · es · pt · ru · ar（每种语言�?910 个键�?

```ts
import { useI18n } from '@/hooks/useI18n'
const { t } = useI18n()
t('chat.send')  // 语言环境感知的翻�?
```

**关键命名空间�?* `nav.*`、`chat.*`、`agents.*`、`skills.*`、`models.*`、`settings.*`、`channels.*`、`common.*`、`onboarding.*`

**回退链：** 当前语言 �?英语 �?提供的回退�?�?原始键�?

**添加新语言�?* (1) �?`AppLocale` 类型中添加语言代码�?2) �?`i18n.ts` 中添加翻译映射；(3) 在设置中添加 UI 选项�?

---

## 9. 记忆系统

| 级别 | 作用�?| 限制 | 持久�?|
|------|--------|------|--------|
| 短期 | 按会�?| 100 �?| 仅在会话生命周期�?|
| 长期 | 全局 | 无限�?| Store 中的 `globalMemories` |
| 向量 | 全局 | 无限�?| `search_memory`/`add_memory` 工具 |

```ts
interface AgentMemoryEntry {
  id: string; content: string; type: string;     // 'fact'�?preference'�?context'
  scope: 'session' | 'global'; createdAt: number; source?: string;
}
```

启用 `autoLearn: true` 的代理会通过 `builtin-self-evolution` 技能自动持久化事实信息�?

---

## 10. IPC 通信

**67 �?invoke 通道**（请�?响应）�?**1 �?send 通道**（`app:ready`）�?**6 �?on 通道**（事件）

### Preload 桥接

```ts
window.electron.invoke(channel, ...args): Promise<unknown>  // 白名单中的通道；未知通道抛出异常
window.electron.on(channel, listener): void                  // 白名单中的通道；其他通道静默忽略
window.electron.send(channel, ...args): void                 // 白名单中的通道；其他通道静默忽略
```

### 通道索引

| 类别 | 通道 |
|------|------|
| 文件系统 | `fs:listDir`、`fs:readFile`、`fs:readFileRange`、`fs:writeFile`、`fs:deleteFile`、`fs:editFile`、`fs:searchFiles`、`fs:moveFile`、`fs:copyFile`、`fs:stat`、`fs:watch:start`、`fs:watch:stop` |
| Shell | `shell:exec`、`shell:openUrl` |
| 网络 | `web:search`、`web:fetch` |
| 浏览�?| `browser:navigate`、`browser:screenshot`、`browser:evaluate`、`browser:extractLinks`、`browser:extractText`、`browser:fillForm`、`browser:click` |
| 剪贴�?| `clipboard:read`、`clipboard:write` |
| 定时�?| `timer:list`、`timer:create`、`timer:update`、`timer:delete`、`timer:history` |
| Store | `store:load`、`store:save`、`store:remove` |
| 安全存储 | `safe-storage:encrypt`、`safe-storage:decrypt`、`safe-storage:isAvailable` |
| 系统 | `system:getDefaultWorkspacePath`、`system:ensureDirectory`、`system:info`、`system:notify`、`system:screenshot` |
| 渠道 | `channel:start/stop/status/register`、`channel:getWebhookUrl`、`channel:sendMessage`、`channel:sendMessageQueued`、`channel:getAccessToken`、`channel:healthCheck`、`channel:debugSend` |
| 邮件 | `email:send`、`email:test` |
| 更新�?| `updater:check`、`updater:getVersion` |
| 日志 | `log:write` |
| 其他 | `app:setAutoStart`、`app:getAutoStart`、`deep-link:getProtocol`、`crash:report/getLogs/clearLogs`、`perf:getMetrics` |

**事件通道�?* `timer:fired`、`channel:message`、`fs:watch:changed`、`app:update`、`updater:available`、`deep-link`

---

## 11. 安全架构

| 措施 | 详情 |
|------|------|
| `nodeIntegration` | `false` �?渲染进程中不使用 Node.js |
| `contextIsolation` | `true` �?隔离�?JavaScript 上下�?|
| IPC 白名�?| 68 个通道；未知通道抛出异常或静默忽�?|
| 路径验证 | `ensureAllowedPath()` 通过严格前缀匹配检�?`allowedDirectories` |
| 屏蔽命令 | `ensureCommandAllowed()` 拒绝 `rm -rf`、`del /f /q`、`format`、`shutdown` |
| 确认机制 | 工具执行前可选的用户确认 |
| 安全存储 | 操作系统密钥环加密（DPAPI / Keychain / libsecret）用�?API 密钥 |
| 技能完整�?| SHA-256 校验和；版本历史（`skillVersions`，最�?500 条记录） |
| 审计日志 | `RotatingLogger` �?每文�?10 MB，每�?5 个文件，保留 7 �?|

---

## 12. 插件系统

```ts
interface PluginInfo {
  id: string; name: string; version: string;
  description: string; enabled: boolean; config: Record<string, unknown>;
}
```

插件存储�?`appStore.installedPlugins` 中，可以通过 `pluginTools` 映射（`Record<string, string[]>` �?插件 ID �?工具名称）注册工具。在运行时，`getPluginTools()` 将插件工具合并到可用工具集中�?

**扩展点：** 新工具（通过 `pluginTools`）、新技能（`type: 'marketplace'`）、渠道连接器（`ChannelConfig`）、自定义 AI 供应商（兼容 OpenAI �?`ProviderConfig`）�?

---

## 13. 渠道集成

外部平台（Slack、Discord、Telegram、自定义）通过在主进程中运行的 Express Webhook 服务器进行连接�?

```
平台 �?HTTP webhook �?主进程（Express）→ channel:message 事件 �?渲染进程/AI �?channel:sendMessage �?平台
```

```ts
interface ChannelConfig {
  id: string; platform: 'slack' | 'discord' | 'telegram' | 'custom';
  name: string; token?: string; webhookUrl?: string; enabled: boolean;
}
```

通过 `channelHealth` Store 监控健康状态。代理可以使�?`builtin-channels` 技能以编程方式进行交互�?

---

## 14. 测试

### 单元测试（Vitest�?

配置：`jsdom` 环境，启�?globals，匹配模�?`src/**/*.{test,spec}.{ts,tsx}`，覆盖率阈值（�?8%，函�?5%，分�?5%）�?

```bash
npm run test          # 监听模式
npm run test:run      # 单次运行
npm run test:coverage # 使用 v8 覆盖�?
```

### 端到端测试（Playwright�?

配置：仅 Chromium，基础 URL `localhost:5173`，自动启动开发服务器�?20 秒超时），本�?0 次重�?/ CI �?2 次重试�?

```bash
npm run test:e2e      # 运行端到端测�?
npm run test:e2e:ui   # Playwright UI
```

---

## 15. CI/CD 与发�?

### 测试工作流（`test.yml`）�?推送或拉取请求�?`main`/`develop` 时触�?

- **Test** 作业：lint �?类型检�?�?单元测试 �?上传覆盖率（Codecov）�?Node 20.x �?22.x，Ubuntu
- **Build** 作业：构�?�?打包 �?上传产物�? 天）�?Ubuntu/Windows/macOS，Node 22.x

### 发布工作流（`release.yml`）�?�?GitHub 创建发布时触�?

构建并上传各平台安装包：`.AppImage`/`.deb`/`.rpm`（Linux）、`.exe`/`.msi`（Windows）、`.dmg`/`.zip`（macOS），以及 `latest-*.yml` 元数据�?

**自动更新器：** electron-builder GitHub 供应商；`updater:check` 在启动时查询最新版本�?

---

## 16. 开发指�?

### 环境搭建

```bash
git clone https://github.com/fandych/suora.git && cd suora
npm install
npm run dev    # Electron + HMR
```

### 添加功能

1. �?`src/types/index.ts` 中定义类�?
2. �?`appStore.ts` 中添加状�?动作；升级版本号并添加迁�?
3. �?`src/services/` 中实现逻辑
4. �?`src/components/` 中构建组件；�?Hook 提取�?`src/hooks/`
5. 如需要，�?`App.tsx` 中注册路�?
6. 为所�?10 种语言添加 i18n �?

### 添加 AI 供应�?

�?`aiService.ts �?initializeProvider()` 中添加分支，配置 SDK 工厂和默认基础 URL，然后在模型页面添加 UI。使�?`testConnection()` 进行测试�?

### 添加工具

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

如果工具需要操作系统访问权限：�?`electron/main.ts` 中添�?IPC 处理器，并在 `electron/preload.ts` 中将通道添加到白名单�?

### 开发规�?

- 所有导入使�?`@` 路径别名 · 优先使用 `window.electron.invoke()` 而非 Node API · 工具输入使用 Zod 模式 · 新样式使�?Tailwind `@theme` 令牌

---

## 17. API 参�?

### Store 动作（关键子集）

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

### 文件存储

```ts
fileStateStorage.getItem(name): Promise<string | null>
fileStateStorage.setItem(name, value): void
fileStateStorage.removeItem(name): void
readCached(name): string | null      // 同步，从内存缓存读取
writeCached(name, value): void       // 缓存 + 异步 IPC 保存
```

### IPC 桥接（渲染进程侧�?

```ts
await window.electron.invoke('fs:readFile', path)
await window.electron.invoke('shell:exec', command)
await window.electron.invoke('email:send', { to, subject, body })
window.electron.on('timer:fired', (event, timer) => { ... })
window.electron.on('channel:message', (event, msg) => { ... })
```

### 内置代理

| 代理 | ID | 核心技�?|
|------|----|----------|
| 助手 | `default-assistant` | 全部 18 个技�?|
| 代码专家 | `builtin-code-expert` | git、code-analysis、filesystem、shell |
| 写作�?| `builtin-writer` | filesystem、web、utilities、memory |
| 研究�?| `builtin-researcher` | web、browser、filesystem、memory |
| 数据分析�?| `builtin-data-analyst` | filesystem、shell、utilities、code-analysis |
| DevOps 工程�?| `builtin-devops` | shell、filesystem、system-management、git |
| 产品经理 | `builtin-product-manager` | web、browser、utilities、channels |
| 翻译�?| `builtin-translator` | web、utilities |
| 安全专家 | `builtin-security` | filesystem、shell、git、code-analysis |

---

*最后更新：2025*
