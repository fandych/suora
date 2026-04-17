# Suora 朔枢

> 基于 Electron + React + Vercel AI SDK 的本地 AI 工作台，支持多模型、多 Agent、技能系统、定时任务与渠道集成。

---

## 目录

- [项目简介](#项目简介)
- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [核心模块](#核心模块)
  - [多模型支持](#多模型支持)
  - [Agent 系统](#agent-系统)
  - [技能系统](#技能系统)
  - [记忆管理](#记忆管理)
  - [渠道集成](#渠道集成)
  - [定时任务](#定时任务)
  - [Pipeline 流水线](#pipeline-流水线)
  - [外部目录](#外部目录)
  - [数据导入导出](#数据导入导出)
- [配置说明](#配置说明)
- [开发指南](#开发指南)
- [文档](#文档)
- [License](#license)

---

## 项目简介

**Suora（朔枢）** 是一款面向开发者与知识工作者的本地 AI 工作台。它将多家 AI 提供商的大语言模型统一管理，并通过 Agent 与技能系统将 AI 能力扩展为可执行的自动化流程。支持通过微信、飞书、钉钉等移动端直接与桌面 AI 助手对话，实现跨设备无缝协作。

---

## 功能特性

| 功能 | 描述 |
|------|------|
| 🤖 **多模型支持** | 统一管理 Anthropic、OpenAI、Google 等多家提供商的 LLM |
| 🎯 **Agent 系统** | 内置 10+ 专业 Agent，支持自定义系统提示、技能组合与温度调节 |
| 🛠️ **技能系统** | 14+ 内置工具，覆盖文件系统、Shell、Git、Web、代码分析等场景 |
| 💾 **记忆管理** | 短期记忆（最近 100 条对话上下文）+ 长期记忆（持久化知识库） |
| 📱 **渠道集成** | 支持微信（企业微信）、飞书、钉钉作为消息输入渠道 |
| ⏰ **定时任务** | 支持单次、间隔、Cron 三种定时模式，自动触发 Agent 执行 |
| 🔀 **Pipeline** | 多步骤流水线编排，串联多个 Agent 完成复杂任务 |
| 📂 **外部目录** | 从文件系统加载自定义技能/Agent，支持跨机器共享配置 |
| 📤 **数据导入导出** | 导出完整配置（Agent、技能、会话、Provider），支持迁移与备份 |
| 🔐 **安全存储** | API Key 加密存储，Context Isolation 保障渲染进程安全 |
| 🌐 **国际化** | 内置多语言支持框架（i18n） |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 41 |
| 前端框架 | React 19 + Vite 6 |
| 样式 | Tailwind CSS 4 |
| 状态管理 | Zustand 5 |
| AI 集成 | Vercel AI SDK 6（支持 Anthropic / OpenAI / Google） |
| 构建工具 | electron-vite 5 + Electron Builder 26 |
| 语言 | TypeScript 5.8 |
| 测试 | Vitest 4 + Playwright |
| 图标 | Iconify |

---

## 项目结构

```
suora/
├── electron/
│   ├── main.ts              # Electron 主进程
│   ├── preload.ts           # 预加载脚本（IPC 桥接）
│   ├── channelService.ts    # 渠道 Webhook 服务
│   ├── dingtalkStream.ts    # 钉钉 Stream 模式支持
│   ├── fsUtils.ts           # 文件系统工具
│   └── logger.ts            # 主进程日志
├── src/
│   ├── App.tsx              # 应用根组件（三列布局）
│   ├── components/
│   │   ├── agents/          # Agent 管理界面
│   │   ├── channels/        # 渠道集成界面
│   │   ├── chat/            # 对话界面
│   │   ├── models/          # 模型管理界面
│   │   ├── pipeline/        # Pipeline 编排界面
│   │   ├── settings/        # 全局设置界面
│   │   ├── skills/          # 技能管理界面
│   │   └── timer/           # 定时任务界面
│   ├── hooks/               # 自定义 React Hooks
│   ├── services/            # 核心业务逻辑
│   │   ├── aiService.ts     # AI SDK 封装（多 Provider）
│   │   ├── agentPipelineService.ts  # Pipeline 执行引擎
│   │   ├── customSkillRuntime.ts    # 自定义技能运行时
│   │   ├── channelMessageHandler.ts # 渠道消息处理
│   │   ├── fileStorage.ts   # 持久化存储
│   │   └── mcpSystem.ts     # MCP 协议支持
│   ├── store/
│   │   └── appStore.ts      # 全局状态（Zustand）
│   └── types/               # TypeScript 类型定义
├── resources/icons/         # 应用图标资源（1x/2x/3x）
├── docs/                    # 文档目录
├── e2e/                     # E2E 测试（Playwright）
├── electron.vite.config.ts  # electron-vite 构建配置
├── tailwind.config.ts       # Tailwind CSS 配置
└── package.json
```

---

## 快速开始

### 前置要求

- Node.js 18+
- npm

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

同时启动 Vite 开发服务器与 Electron，支持热重载。

### 构建

```bash
# 构建所有进程
npm run build

# 打包为可分发安装包
npm run package

# 仅打包 Windows
npm run package:win
```

### 代码检查

```bash
npm run lint        # ESLint
npm run type-check  # TypeScript 类型检查
```

### 测试

```bash
npm run test          # 运行单元测试（Vitest watch 模式）
npm run test:run      # 单次运行
npm run test:coverage # 生成覆盖率报告
npm run test:e2e      # E2E 测试（Playwright）
```

---

## 核心模块

### 多模型支持

通过 Vercel AI SDK 统一封装多家提供商：

| Provider | 示例模型 |
|----------|---------|
| Anthropic | claude-opus-4-5, claude-sonnet-4-5 |
| OpenAI | gpt-4o, o3 |
| Google | gemini-2.0-flash, gemini-2.5-pro |
| OpenAI Compatible | 任何兼容 OpenAI API 的自托管服务 |

模型以 `provider:modelName` 格式标识（如 `anthropic:claude-sonnet-4-5`）。

在 **Models** 页面管理 API Key 与模型列表；支持为不同 Agent 单独指定模型与参数。

---

### Agent 系统

Agent 是 Suora 的核心执行单元，每个 Agent 由以下要素组成：

- **系统提示**：定义角色与行为规范
- **技能组**：赋予 Agent 可调用的工具集合
- **模型参数**：temperature、maxTokens 等
- **记忆与学习**：autoLearn 开关，决定是否自动积累长期记忆

#### 内置专业 Agent

| Agent | 温度 | 专长 |
|-------|------|------|
| 🧑‍💻 Code Expert | 0.5 | 代码审查、调试、性能优化 |
| ✍️ Writer | 0.8 | 内容创作、文档编写、文案润色 |
| 📚 Researcher | 0.6 | 研究调查、信息综合、事实核查 |
| 📊 Data Analyst | 0.5 | 数据处理、统计分析、趋势洞察 |
| 🚀 DevOps Engineer | 0.4 | 部署、自动化、系统运维 |
| 🛡️ Security Auditor | 0.3 | 安全审计、漏洞分析 |

---

### 技能系统

技能（Skill）是工具（Tool）的集合，Agent 通过组合技能获得不同能力。

#### 内置技能分类

| 分类 | 技能 | 工具示例 |
|------|------|---------|
| 文件系统 | `builtin-filesystem` | 读写文件、列出目录、搜索 |
| Shell | `builtin-shell` | 执行命令、管道操作 |
| Git | `builtin-git` | status、diff、log、commit、add |
| Web | `builtin-web` | 搜索、HTTP 请求、内容提取 |
| 代码分析 | `builtin-code-analysis` | 结构分析、模式搜索 |
| 高级交互 | `builtin-advanced-interaction` | ask_user_question、loop_execute |
| 记忆 | `builtin-memory` | 读写短期/长期记忆 |
| 定时器 | `builtin-timer` | 创建/管理定时任务 |
| 渠道 | `builtin-channels` | 启动/停止 Webhook 服务器 |
| Todo | `builtin-todo` | 任务列表管理 |

#### 自定义技能

在 **Skills** 页面创建自定义技能，支持：
- 自定义工具描述与参数 Schema
- 代码运行时（沙箱执行 JavaScript）
- 从外部目录（`~/.agents/skills`）加载

---

### 记忆管理

```
短期记忆 (Short-term Memory)
  └─ 最近 100 条对话上下文
  └─ 自动传入 AI 请求作为上下文

长期记忆 (Long-term Memory)
  └─ 持久化知识与偏好
  └─ 可手动添加或由 Agent 自动学习
  └─ 存储于本地工作区文件
```

---

### 渠道集成

通过内置 Express Webhook 服务器接收来自移动端的消息，支持：

| 平台 | 验证方式 | 说明 |
|------|---------|------|
| 飞书 (Feishu) | Verification Token + Encrypt Key | 支持加密消息与 URL 验证 |
| 钉钉 (DingTalk) | HMAC-SHA256 签名 | 支持 Stream 长连接模式 |
| 企业微信 (WeChat Work) | Token + AES 加密 | 支持 echostr 验证 |

**架构流程：**

```
移动端 App → Webhook HTTP POST → Channel Service
  → 签名验证 → Message Handler → Agent 处理
  → AI 响应 → 回复平台 API → 移动端显示
```

**快速配置：**

1. 在 **Channels** 页面添加渠道配置，填写 appId、appSecret 等平台凭证
2. 在 **Settings → Channels** 中启动 Webhook 服务器（默认端口 `3000`）
3. 将 `http://your-ip:3000/webhook/{platform}/{channel-id}` 填入对应平台后台

详见 [渠道集成文档](./docs/CHANNEL_INTEGRATION.md)。

---

### 定时任务

支持三种定时模式：

| 类型 | 示例 | 描述 |
|------|------|------|
| **Once** | `2026-05-01 09:00` | 单次在指定时间执行 |
| **Interval** | 每 30 分钟 | 按固定间隔重复执行 |
| **Cron** | `0 9 * * 1-5` | 标准 Cron 表达式 |

**常用 Cron 示例：**

```bash
0 9 * * 1-5    # 工作日早 9 点
0 */2 * * *    # 每 2 小时
*/15 * * * *   # 每 15 分钟
0 0 1 * *      # 每月 1 日零点
```

触发动作支持：**发送系统通知** 或 **向指定 Agent 发送提示词**。

---

### Pipeline 流水线

Pipeline 将多个 Agent 步骤串联，实现复杂的自动化流程：

- 可视化编排多步骤执行顺序
- 支持步骤间数据传递（上一步输出作为下一步输入）
- 内置错误处理与重试机制
- Pipeline 可保存并复用

---

### 外部目录

从文件系统动态加载技能与 Agent 定义：

**默认扫描路径：**
- `~/.agents/skills` — 用户技能目录
- `~/.agents/agents` — 用户 Agent 目录
- `~/.claude/skills` — Claude 技能目录
- `~/.claude/agents` — Claude Agent 目录

**技能定义文件格式（JSON）：**

```json
{
  "id": "my-custom-skill",
  "name": "My Custom Skill",
  "description": "技能描述",
  "type": "custom",
  "enabled": true,
  "tools": [
    {
      "id": "tool-1",
      "name": "Tool Name",
      "description": "工具描述",
      "params": []
    }
  ],
  "icon": "⚡"
}
```

加载的资源在界面上通过 Badge 标识来源（`builtin` / `.agents` / `.claude`）。

---

### 数据导入导出

在 **Settings → Data** 中：

- **导出**：将自定义 Agent、技能、会话记录、Provider 配置、外部目录设置打包为 JSON 文件
- **导入**：从导出文件还原数据（合并模式，不覆盖现有数据）
- **清除历史**：永久删除所有聊天记录（不影响 Agent 与技能配置）

**导出文件结构：**

```json
{
  "version": "1.0",
  "exportedAt": "2026-01-01T00:00:00.000Z",
  "agents": [...],
  "skills": [...],
  "sessions": [...],
  "providerConfigs": [...],
  "externalDirectories": [...]
}
```

---

## 配置说明

### API Key 配置

在 **Settings → Models** 中为每个 Provider 配置 API Key：

| Provider | 环境变量参考 | 官方文档 |
|----------|------------|---------|
| Anthropic | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| OpenAI | `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) |
| Google AI | `GOOGLE_API_KEY` | [aistudio.google.com](https://aistudio.google.com) |

API Key 在本地加密存储，不会上传至任何服务器。

### Electron 安全配置

- `contextIsolation: true` — 渲染进程隔离
- 所有 Node.js API 通过 `preload.ts` 的 IPC 桥接访问，渲染进程不直接访问 Node.js

---

## 开发指南

### 添加新模型

```typescript
import { useAppStore } from '@/store/appStore'

useAppStore.getState().addModel({
  id: 'anthropic:claude-opus-4-5',
  name: 'Claude Opus 4.5',
  provider: 'anthropic',
})
```

### 调用 AI 服务（流式）

```typescript
import { streamResponse } from '@/services/aiService'

for await (const chunk of streamResponse(modelId, messages, systemPrompt)) {
  console.log(chunk)
}
```

### 访问全局状态

```typescript
import { useAppStore } from '@/store/appStore'

function MyComponent() {
  const { models, selectedModel, setSelectedModel } = useAppStore()
}
```

### 新增功能的推荐流程

1. 在 `src/types/` 中定义类型
2. 在 `src/store/appStore.ts` 中添加状态与 action
3. 在 `src/services/` 中实现业务逻辑
4. 在 `src/components/` 中构建界面组件
5. 在 `src/hooks/` 中封装复杂逻辑为自定义 Hook

### 构建输出目录

| 进程 | 输出目录 | 模块格式 |
|------|---------|---------|
| Main | `out/main/` | ESM |
| Preload | `out/preload/` | CJS |
| Renderer | `out/renderer/` | — |

---

## 文档

| 文档 | 描述 |
|------|------|
| [CLAUDE.md](./CLAUDE.md) | 架构说明与开发指南（供 AI 助手参考） |
| [FEATURES.md](./FEATURES.md) | 完整功能说明 |
| [docs/CHANNEL_INTEGRATION.md](./docs/CHANNEL_INTEGRATION.md) | 渠道集成配置指南 |
| [docs/requirements.md](./docs/requirements.md) | 产品需求文档 |
| [docs/technical/](./docs/technical/) | 多语言技术文档 |
| [docs/user/](./docs/user/) | 多语言用户指南 |

---

## License

MIT
