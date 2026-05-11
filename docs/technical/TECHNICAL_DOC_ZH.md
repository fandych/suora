# Suora 技术文档

本文档基于当前仓库实现编写，用作贡献者和维护者的代码对齐型架构参考。

文档清理后，本文件与 `docs/technical/TECHNICAL_DOC_EN.md` 是长期维护的主技术文档；测试、渠道与产品范围等专题内容分别放在 `docs/TESTING.md`、`docs/CHANNEL_INTEGRATION.md` 与 `docs/requirements.md`。

## 1. 系统概览

Suora 是一个基于 Electron 的本地 AI 工作台。当前版本由以下工作模块组成：

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

应用采用本地优先设计。用户状态、会话、文档树、Agent 配置、模型配置以及大部分运行元数据都通过 IPC 驱动的持久化层写入本地。

## 2. 运行时架构

运行时分为三层：

| 层 | 职责 |
| --- | --- |
| Electron 主进程 | 负责文件系统、网络抓取辅助、Secure Storage、Shell、渠道服务和 IPC 处理 |
| 预加载桥接层 | 在 context isolation 下暴露白名单式 `window.electron` API |
| React 渲染层 | 渲染工作台 UI，使用 Zustand 管理状态，并编排 AI、文档、流水线、渠道和设置 |

渲染层使用 Hash Router，并对各功能模块进行懒加载。

### 当前顶层路由

| 路由 | 模块 |
| --- | --- |
| `/chat` | 聊天工作台 |
| `/documents` | 文档工作台 |
| `/pipeline` | Agent 流水线编辑与执行历史 |
| `/models/:view` | 提供商、模型和比较视图 |
| `/agents` | Agent 管理 |
| `/skills/:view` | 已安装、浏览和技能源视图 |
| `/timer` | 定时器与调度管理 |
| `/channels` | 消息渠道集成 |
| `/mcp` | 集成与 MCP 配置 |
| `/settings/:section` | 设置分区 |

### 当前设置分区

- `general`
- `security`
- `voice`
- `shortcuts`
- `data`
- `logs`
- `system`

## 3. 仓库结构

当前仓库围绕 Electron 外壳和按功能组织的 React 应用展开：

```text
electron/
  main.ts          Electron 主进程与 IPC handlers
  preload.ts       上下文隔离 preload bridge
  channelService.ts
  database.ts

src/
  App.tsx          路由启动与全局初始化
  main.tsx         渲染进程入口
  index.css        全局主题 token 与 UI 样式
  components/      功能模块与共享 UI
  hooks/           React hooks
  services/        AI、存储、i18n、流水线、渠道、文档等服务
  store/           Zustand store 与 slices
  types/           共享应用类型

docs/
  user/            用户文档
  technical/       技术参考文档

e2e/
  Playwright 端到端测试
```

### 当前保留的文档结构

```text
README.md                         仓库入口与发布说明
docs/
  user/USER_GUIDE_ZH.md          中文主用户文档
  user/USER_GUIDE_EN.md          英文主用户文档
  technical/TECHNICAL_DOC_ZH.md  中文主技术文档
  technical/TECHNICAL_DOC_EN.md  英文主技术文档
  CHANNEL_INTEGRATION.md         渠道专题
  TESTING.md                     测试专题
  requirements.md                产品范围与需求基线
website/docs/                    GitHub Pages / Docusaurus 公开文档页
```

这次清理的目标是把长期维护入口收敛到少数几个明确文档，避免继续积累一次性报告、历史专项审计和无人维护的多语言副本。

## 4. 技术栈

| 领域 | 技术 |
| --- | --- |
| 桌面壳层 | Electron 41 |
| 前端 | React 19 |
| 构建工具 | Vite 6 + electron-vite 5 |
| 样式系统 | Tailwind CSS 4 |
| 状态管理 | Zustand 5 |
| 语言 | TypeScript 5.9 |
| AI 运行时 | Vercel AI SDK 6 |
| 单元测试 | Vitest |
| 端到端测试 | Playwright |

## 5. 应用状态模型

Suora 使用 `src/store/appStore.ts` 中的单一持久化 Zustand Store 协调整个工作台状态。

### 主要状态域

- 会话与聊天标签
- 文档、文件夹和文档组
- 模型与提供商配置
- Agent、Agent 记忆、Agent 版本和性能统计
- 技能、技能版本和外部技能源
- 流水线与执行元数据
- 定时器
- 渠道、渠道健康状态、用户、历史与 token
- 通知
- MCP 服务器配置与状态
- 主题、语言、字体大小、强调色和当前模块等 UI 偏好

### 当前导入导出覆盖

数据设置页当前导入导出以下内容：

- 自定义 Agent
- 自定义技能
- 所有会话
- 提供商配置
- 外部目录配置

## 6. 模型与 AI 服务层

AI 集成位于 `src/services/aiService.ts`。

### 当前提供商支持

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
- OpenAI 兼容端点

### 运行时支持与 UI 暴露要分开理解

维护提供商相关文档时，要把三件事区分开：

1. `src/services/aiService.ts` 中的运行时支持面
2. store 中的提供商预设与模型同步逻辑
3. 模型设置界面中真正暴露给用户的编辑类型

不要把这三层直接合并成同一张“提供商列表”。

### AI 服务职责

- 校验模型配置
- 按提供商身份、API Key 与 Base URL 初始化并缓存客户端
- 对网络错误和提供商错误进行分类
- 生成普通文本回复
- 在多步工具调用循环中流式返回结果

### 当前流事件类型

- `text-delta`
- `tool-call`
- `tool-result`
- `tool-error`
- `finish-step`
- `usage`
- `error`

## 7. Agent 与技能系统

### 当前内置 Agent

- Assistant
- Pipeline builder
- Timer builder
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

### Agent 模型

当前 `Agent` 类型包含：

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

这意味着 Suora 的 Agent 不只是提示词模板，还包含路由、工具限制和记忆行为。

### 技能模型

当前技能系统是基于提示词的能力包，而不是底层工具注册。当前支持：

- 已安装技能列表
- 技能注册表浏览
- 技能源管理
- `SKILL.md` 编辑与预览
- 导入单个技能文件
- 导入整个技能目录
- 导出为 markdown 或 zip
- 管理与 `SKILL.md` 同目录的资源树

当前代码注释和界面行为强调了一点：内置工具仍由工具系统提供，技能则负责增加领域知识、提示词和打包资源。

### 关键实现锚点

维护 Agent / Skill 相关说明时，优先核对：

- `src/store/appStore.ts`
- `src/services/skillRegistry.ts`
- `src/services/skillMarketplace.ts`
- `src/components/skills/SkillsLayout.tsx`

## 8. 文档、流水线与定时器

### 文档模块

当前文档工作台支持：

- 文档组
- 嵌套文件夹
- Markdown 文档
- Mermaid 渲染
- 数学公式渲染
- 反向链接与引用
- 文档搜索
- 图谱视图
- 将选中文档作为聊天上下文

### 流水线模块

当前流水线模块支持：

- 多步骤 Agent 工作流
- 步骤重试与退避策略
- 步骤级超时
- `runIf` 条件执行
- 输出变换与变量导出
- 总时长、总 Token、步数预算限制
- Mermaid 预览与源码导出
- 执行历史与步骤详情
- 保存、导入、导出

聊天层也支持 `/pipeline` 命令，用于列出、运行、查看状态、读取历史和取消已保存流水线。

### 定时器模块

当前定时器类型：

- `Once`
- `Interval`
- `Cron`

当前定时器动作：

- 桌面通知
- 执行 Agent Prompt
- 执行已保存流水线

## 9. Channels 与 MCP

### 渠道平台

当前 `ChannelPlatform` 支持：

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

### 渠道行为

当前渠道编辑器支持：

- webhook 或 stream 传输方式
- 每个渠道绑定一个回复 Agent
- 自动回复开关
- 允许聊天白名单
- 消息历史
- 用户列表
- 健康状态面板
- 调试面板

### MCP

当前集成模块提供 MCP 服务器管理，包括：

- 服务器配置
- 连接状态追踪
- 将 MCP 能力接入 Agent 执行链路

### Electron 安全边界

维护 Electron 相关说明时，要保留这些事实：

- `contextIsolation` 保持启用
- renderer 不直接暴露 Node.js 特权接口
- 特权能力通过 `electron/preload.ts` 与 `electron/main.ts` 暴露
- Secure Storage 不可用时必须向 UI 明确提示

## 10. IPC 与安全模型

Suora 保持 Electron 的 context isolation，并通过 preload bridge 转发特权操作。

### 当前主要安全特征

- 渲染进程不直接访问 Node.js API
- preload 仅暴露白名单式 invoke/on/send 接口
- secure storage 失败会在 UI 中显示警告
- 文件系统访问可以进入 sandbox 模式
- 用户可配置允许目录
- 可屏蔽危险 shell 模式
- 工具执行前可要求确认

### Secure Storage 行为

应用会优先尝试将 API key 写入操作系统安全存储。如果 secure storage 不可用或加密失败，界面会提示这些 key 仅保存在内存中，重启后需要重新输入。

## 11. UI 主题、国际化、构建与测试

### 主题与偏好

渲染层在 `src/index.css` 中使用共享 token 主题系统，并通过 `useTheme` 等 hook 应用偏好。当前支持：

- 浅色 / 深色 / 跟随系统主题
- 字号
- 代码字体
- 强调色
- 语言

当前默认主题模式为 `system`。

### 当前语言集合

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

### 常用开发命令

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

### 当前测试覆盖方向

从当前仓库可见，测试已经覆盖以下方向：

- Electron preload 行为
- 存储工具
- Onboarding UI
- 技能编辑器行为
- marketplace 与 skill registry 流程
- 主题 hooks
- 数据库辅助函数
- Playwright 冒烟链路

### 文档与站点验证建议

- 如果修改的是仓库 Markdown，至少要检查链接和交叉引用是否仍然成立
- 如果修改了 `website/` 下的 Docusaurus 页面，应该额外验证站点构建
- Playwright 目前主要验证 renderer 冒烟路径，不应把它写成完整 Electron 窗口自动化

## 12. 维护建议

如果你在这个仓库里更新技术文档，请优先写“代码已经实现的事实”，不要沿用历史方案描述。尤其建议直接对照：

- `src/App.tsx` 中的真实路由
- `src/store/appStore.ts` 中的真实内置 Agent
- `src/services/aiService.ts` 中的真实提供商类型
- `src/components/settings/SettingsLayout.tsx` 中的真实设置分区

除非刚刚核对过代码，否则不要在文档里写死 IPC 通道数、工具总数这类容易漂移的数字。

另外，当前主文档维护策略是：

- 主用户文档只保留中英文两份
- 主技术文档只保留中英文两份
- 专题文档只保留仍在被引用、且确有维护价值的少量文件
