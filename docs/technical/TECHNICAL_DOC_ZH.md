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
| `/skills` | 已安装技能与本地外部技能来源 |
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
- `knowledge`
- `events`
- `external-dirs`
- `plugins`
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
  LLM_WIKI_CAPABILITIES.md       LLM Wiki 风格文档智能能力参考
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

### 实验性 Harness 运行时

仓库现在还包含一个实验性的 AI SDK Harness 入口：`scripts/harness-pi.mjs`。

- 它使用 `@ai-sdk/harness`、`@ai-sdk/harness-pi` 和 `@ai-sdk/sandbox-just-bash`。
- 它会把当前工作区挂载到 just-bash sandbox 的 `/workspace`。
- dry-run 模式使用 `OverlayFs`，因此编辑只保存在临时内存层，不会写回真实仓库。
- write 模式使用 `ReadWriteFs`，因此 Harness 的文件修改会真正落到工作区。

仓库还包含 bridge-backed adapter 的远程 runner：`scripts/harness-remote.mjs`。

- `npm run harness:codex`
- `npm run harness:claude-code`

这些远程 runner 使用 `@ai-sdk/sandbox-vercel`，并会在 harness 启动前把经过过滤的工作区快照复制到 sandbox 会话中。

这个集成目前被刻意放在主渲染层聊天链路之外。

原因是：

- 当前聊天产品路径仍建立在 `src/services/aiService.ts` 的 AI SDK 6 model provider 调用之上。
- `src/hooks/useAIChat.ts` 当前仍以可重放的 `ModelMessage[]` 历史或 OpenAI response-chain continuation 方式驱动对话。
- Harness Adapter 是基于 `HarnessAgent` 的“自带会话状态”的运行时，依赖 adapter 管理的 turn state、resume state 和 continuation state，而不是普通的无状态 provider 调用。
- 当前安装进来的 harness 包还会自带一套 `ai@7` 运行时子树，因此不能把它直接当成现有 AI SDK 6 服务层里的普通 provider 使用。

因此，当前仓库把 Harness 视为独立的实验性项目级工具能力，而不是直接暴露到标准的模型设置 UI 中。

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
- 基于来源信息扩展相关笔记
- 图谱视图，并提示桥接节点、稀疏簇、知识缺口和意外连接
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
- 运行时记录实际执行引擎和 workflow fallback 原因
- 保存、导入、导出

聊天层也支持 `/pipeline` 命令，用于列出、运行、查看状态、读取历史和取消已保存流水线。

#### 流水线执行引擎路由

流水线执行路由位于 `src/services/workflowPipelineExecutor.ts`。当前接受 `auto`、`legacy` 和 `workflow` 三种执行引擎值。解析顺序是：显式传入的 `executionEngine`、按触发来源划分的环境变量、全局环境变量，最后默认回退到 `legacy`。

触发来源环境变量包括 `PIPELINE_EXECUTION_ENGINE_MANUAL`、`PIPELINE_EXECUTION_ENGINE_CHAT` 和 `PIPELINE_EXECUTION_ENGINE_TIMER`；渲染侧也接受对应的 `VITE_PIPELINE_EXECUTION_ENGINE_*` 形式。全局默认值使用 `PIPELINE_EXECUTION_ENGINE` 或 `VITE_PIPELINE_EXECUTION_ENGINE`。

如果选择了 Workflow 路径但 workflow executor 尚未接入，或 workflow executor 执行抛错，Suora 会回退到 legacy executor。执行运行时快照会记录 `executionEngine`，并在需要时记录 `executionFallbackReason`，以便 Pipeline 历史和通知展示降级信息。

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

### 组件库

工作台组件基于项目内的 shadcn/ui 配置与 Base UI 原语库构建。通用原语位于 `src/components/ui/`，面向业务的按钮、弹窗、下拉菜单和表单封装位于 `src/components/shared/`。这些组件统一消费工作台主题 token（`--color-surface-*`、`--color-text-*`、`--color-accent` 等），因此可正确响应深色/浅色模式和强调色变化。

设置面板和表单控件的共享适配层位于：
- `src/components/ui/` — shadcn/Base UI 原语
- `src/components/shared/` — 业务层封装与兼容层
- `src/components/settings/panelUi.tsx` — 设置面板构建块
- `src/components/shared/form-controls.tsx` — 共享表单层

### 深色模式实现

工作台使用反转类策略进行主题切换：
- **深色模式（默认）**：`<html>` 上同时存在 `dark` 类，不存在 `light` 类
- **浅色模式**：添加 `light` 类，移除 `dark` 类

`dark` 类由 Tailwind 的 `dark:` 变体（通过 `src/index.css` 中的 `@custom-variant dark (&:where(.dark, .dark *))` 配置）所需。`light` 类驱动 `src/index.css` 中浅色模式的 CSS 变量覆盖。`useTheme` 同时切换两个类。

### 主题与偏好

渲染层在 `src/index.css` 中使用共享 token 主题系统，并通过 `useTheme` 等 hook 应用偏好。当前支持：

- 浅色 / 深色 / 跟随系统主题
- 字号
- 代码字体
- 强调色（Settings 界面当前共 9 个命名选项：强蓝、探戈粉、深橘、柠檬黄、波斯绿、绿松石蓝、天际蓝、海洋青、玫瑰灰褐；持久化层中的 `default` 也会映射到强蓝）
- 语言

当前默认主题模式为 `system`。

### 强调色系统

强调色系统由 `src/theme/accentPresets.ts` 管理，并由 `useTheme.ts` 应用。`default` 现在对应 Strong Blue（`#0024D3`），并且仍然通过显式写入 CSS 变量来应用，不依赖 CSS 层叠默认值。当前命名预设包括：

- `strong-blue` → `#0024D3`
- `tango-pink` → `#F06473`
- `dark-tangerine` → `#F58C35`
- `lemon-curry` → `#F5D34C`
- `persian-green` → `#00B48F`
- `turquoise` → `#00A8BF`
- `skyline-blue` → `#00A9EB`
- `oceanic-teal` → `#008CB7`
- `rose-taupe` → `#954F72`

为兼容旧持久化状态，`default` 仍然保留并解析到与 `strong-blue` 相同的强蓝值，但不再作为 Settings 界面里的重复选项显示。

这些预设只会覆盖强调色相关变量（`--t-accent`、`--t-accent-hover`、`--t-accent-glow`、`--t-accent-soft`、`--t-accent-secondary`、`--t-accent-rgb`），不会替换 `src/index.css` 中当前的黑 / 灰白 / 白中性表面基底。

### 当前表面基线

最近一轮工作台精修后，渲染层全局主题已经收敛为更安静的视觉基线：

- 深色模式使用黑色与石墨灰表面层级
- 浅色模式使用白色与灰白色表面层级
- `src/index.css` 中重复的后置主题覆盖和过重装饰渐变已被移除或显著减弱
- 共享 workbench hero、detail、sidebar 与 empty-state 类统一降低了阴影与强调强度

因此在描述当前 UI 主题时，应表述为“中性表面优先、主题色负责强调”，而不是“整页带色背景主题”。

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
